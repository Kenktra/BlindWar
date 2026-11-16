import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import cors from 'cors';
import express, { type Request, type Response } from 'express';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import {
  CARD_DOSSIERS,
  CHARACTER_DOSSIERS,
  MECHANIC_DOSSIERS,
  RULE_SECTIONS,
  TUTORIAL_SCENARIOS,
  type CardPlayPayload,
  type CharacterType,
  type Coord,
  type CustomRulesetConfig,
  type MoveCandidateKind,
  type PlacementEntry,
} from '../../shared/src/index.js';
import {
  AuthService,
  PasswordRateLimitError,
  authenticateSession,
  verifySessionToken,
} from './auth/authService.js';
import {
  BlindWarDatabase,
  resolveAccountRole,
  toPublicProfile,
  type StoredUserRecord,
} from './database/db.js';
import { resolveDataFilePath } from './database/dataPaths.js';
import { BlindWarP2PMesh } from './p2p/p2pMesh.js';
import { GameRoomManager, type ManagedRoom } from './rooms/roomManager.js';

export interface BlindWarServerInstance {
  readonly app: express.Express;
  readonly httpServer: http.Server;
  readonly io: SocketIOServer;
  readonly db: BlindWarDatabase;
  readonly authService: AuthService;
  readonly roomManager: GameRoomManager;
  readonly p2pMesh: BlindWarP2PMesh;
  readonly close: () => Promise<void>;
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length).trim();
}

export async function createBlindWarServer(options?: {
  diskFilePath?: string;
  /** Fichier de sauvegarde des salles en cours (`null` pour désactiver). */
  roomsSnapshotFilePath?: string | null;
  /** Activer ou désactiver le réseau P2P décentralisé (activé par défaut sauf dans les tests unitaires). */
  enableP2P?: boolean;
}): Promise<BlindWarServerInstance> {
  const db = new BlindWarDatabase({ diskFilePath: options?.diskFilePath });
  await db.initSchema();

  const authService = new AuthService(db);
  const roomsSnapshotFilePath =
    options?.roomsSnapshotFilePath !== undefined
      ? options.roomsSnapshotFilePath
      : options?.diskFilePath
        ? `${options.diskFilePath}.rooms.json`
        : resolveDataFilePath('active-rooms.json');
  const roomManager = new GameRoomManager(db, { snapshotFilePath: roomsSnapshotFilePath });
  let p2pMeshRef: BlindWarP2PMesh | null = null;

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '512kb' }));

  // Simple per-IP request rate limiter (§19: Protection contre les requêtes répétées abusives)
  const ipWindowCounter = new Map<string, { count: number; resetAt: number }>();
  app.use((req, res, next) => {
    const ip = req.ip ?? 'local';
    const now = Date.now();
    const entry = ipWindowCounter.get(ip);
    if (!entry || now > entry.resetAt) {
      ipWindowCounter.set(ip, { count: 1, resetAt: now + 10_000 });
      next();
      return;
    }
    entry.count += 1;
    if (entry.count > 150) {
      res.status(429).json({ error: 'Trop de requêtes, veuillez patienter.' });
      return;
    }
    next();
  });

  // --- REST API Endpoints ---

  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { username, password, avatarBadge } = req.body as {
        username?: string;
        password?: string;
        avatarBadge?: string;
      };
      if (!username || !password) {
        res.status(400).json({ error: 'Nom d’utilisateur et mot de passe requis.' });
        return;
      }
      const result = await authService.register(username, password, avatarBadge);
      p2pMeshRef?.broadcastDatabaseSync();
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Erreur d’inscription.' });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body as { username?: string; password?: string };
      if (!username || !password) {
        res.status(400).json({ error: 'Identifiants requis.' });
        return;
      }
      const result = await authService.login(username, password);
      res.json(result);
    } catch (err) {
      res.status(401).json({ error: err instanceof Error ? err.message : 'Connexion refusée.' });
    }
  });

  const requireActiveUser = async (
    req: Request,
    res: Response,
  ): Promise<StoredUserRecord | null> => {
    const token = extractBearerToken(req);
    const session = token ? verifySessionToken(token) : null;
    if (!session) {
      res.status(401).json({ error: 'Non authentifié.' });
      return null;
    }
    const authCtx = await authenticateSession(db, token);
    if (!authCtx) {
      // Distinguer compte suspendu vs session révoquée/expirée
      const userById = await db.findUserById(session.userId);
      if (userById && userById.accountStatus === 'suspended') {
        res.status(403).json({
          error: userById.suspendedReason
            ? `Ce compte est suspendu : ${userById.suspendedReason}`
            : 'Ce compte est actuellement suspendu.',
        });
        return null;
      }
      res.status(401).json({ error: 'Session expirée ou révoquée. Reconnectez-vous.' });
      return null;
    }
    return authCtx.user;
  };

  const requireAdmin = async (
    req: Request,
    res: Response,
  ): Promise<StoredUserRecord | null> => {
    const user = await requireActiveUser(req, res);
    if (!user) {
      return null;
    }
    if (resolveAccountRole(user.username) !== 'admin') {
      res.status(403).json({ error: 'Accès refusé : droits administrateur requis.' });
      return null;
    }
    return user;
  };

  app.get('/api/auth/me', async (req: Request, res: Response) => {
    const user = await requireActiveUser(req, res);
    if (!user) return;
    res.json({ profile: toPublicProfile(user) });
  });

  app.post('/api/auth/verify-password', async (req: Request, res: Response) => {
    try {
      const user = await requireActiveUser(req, res);
      if (!user) return;
      const { currentPassword } = req.body as { currentPassword?: string };
      if (typeof currentPassword !== 'string' || !currentPassword) {
        res.status(400).json({ error: 'Veuillez saisir votre ancien mot de passe.' });
        return;
      }
      await authService.verifyCurrentPassword(user.id, currentPassword);
      res.json({ verified: true });
    } catch (err) {
      if (err instanceof PasswordRateLimitError) {
        res.status(429).json({ error: err.message });
        return;
      }
      res.status(403).json({
        verified: false,
        error: err instanceof Error ? err.message : 'Vérification impossible.',
      });
    }
  });

  app.post('/api/auth/change-password', async (req: Request, res: Response) => {
    try {
      const user = await requireActiveUser(req, res);
      if (!user) return;
      const { currentPassword, newPassword, confirmPassword } = req.body as {
        currentPassword?: string;
        newPassword?: string;
        confirmPassword?: string;
      };
      if (
        typeof currentPassword !== 'string' ||
        typeof newPassword !== 'string' ||
        typeof confirmPassword !== 'string'
      ) {
        res.status(400).json({ error: 'Tous les champs de mot de passe sont requis.' });
        return;
      }
      const result = await authService.changePassword({
        userId: user.id,
        currentPassword,
        newPassword,
        confirmPassword,
      });
      p2pMeshRef?.broadcastDatabaseSync();
      res.json(result);
    } catch (err) {
      if (err instanceof PasswordRateLimitError) {
        res.status(429).json({ error: err.message });
        return;
      }
      const msg = err instanceof Error ? err.message : 'Modification du mot de passe refusée.';
      const status = msg.toLowerCase().includes('incorrect') ? 403 : 400;
      res.status(status).json({ error: msg });
    }
  });

  app.patch('/api/profile', async (req: Request, res: Response) => {
    try {
      const user = await requireActiveUser(req, res);
      if (!user) return;
      // N'autorise jamais la modification du rôle, du statut ni de l'ELO depuis /api/profile
      const {
        displayName,
        avatarBadge,
        avatarImage,
        removeAvatarImage,
        bio,
        profileBanner,
        selectedTitle,
        selectedBadge,
        preferences,
      } = req.body as Record<string, any>;
      const profile = await db.updateUserProfile(user.id, {
        displayName,
        avatarBadge,
        avatarImage,
        removeAvatarImage,
        bio,
        profileBanner,
        selectedTitle,
        selectedBadge,
        preferences,
      });
      p2pMeshRef?.broadcastDatabaseSync();
      res.json({ profile });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Mise à jour impossible.' });
    }
  });

  // ===========================================================================
  // ROUTES D'ADMINISTRATION PROTÉGÉES (exclusivement Kenktra_7003 / rôle admin)
  // ===========================================================================

  app.get('/api/admin/overview', async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const [users, matches, adminLogs] = await Promise.all([
      db.listAllUsersForAdmin(),
      db.getMatchHistoryForUser(undefined, 120),
      db.getAdminAuditLogs(120),
    ]);
    res.json({
      users,
      matches,
      adminLogs,
      storage: db.getStorageHealth(),
      activeRoomsCount: roomManager.getActiveRoomsCount(),
    });
  });

  app.get('/api/admin/users/:userId', async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const targetId = String(req.params.userId);
    const targetUser = await db.findUserById(targetId);
    if (!targetUser) {
      res.status(404).json({ error: 'Utilisateur introuvable.' });
      return;
    }
    const [matches, eloHistory] = await Promise.all([
      db.getMatchHistoryForUser(targetId, 50),
      db.getEloHistoryForUser(targetId, 50),
    ]);
    res.json({
      profile: toPublicProfile(targetUser),
      matches,
      eloHistory,
    });
  });

  app.patch('/api/admin/users/:userId/stats', async (req: Request, res: Response) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const targetId = String(req.params.userId);
      const {
        eloRating,
        wins,
        losses,
        draws,
        gamesPlayed,
        totalEliminations,
        newMechanicsStats,
        reason,
      } = req.body as Record<string, any>;
      const result = await db.adminUpdateUserStats(admin.id, targetId, {
        eloRating,
        wins,
        losses,
        draws,
        gamesPlayed,
        totalEliminations,
        newMechanicsStats,
        reason,
      });
      p2pMeshRef?.broadcastDatabaseSync();
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Modification impossible.' });
    }
  });

  app.patch('/api/admin/users/:userId/account', async (req: Request, res: Response) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const targetId = String(req.params.userId);
      const { accountStatus, suspendedReason, displayName, bio } = req.body as Record<string, any>;
      const result = await db.adminManageUserAccount(admin.id, targetId, {
        accountStatus,
        suspendedReason,
        displayName,
        bio,
      });
      p2pMeshRef?.broadcastDatabaseSync();
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Action impossible.' });
    }
  });

  app.get('/api/admin/logs', async (req: Request, res: Response) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const logs = await db.getAdminAuditLogs(150);
    res.json({ logs });
  });

  app.get('/api/leaderboard', async (_req: Request, res: Response) => {
    const leaderboard = (await db.getLeaderboard(50)).map(({ preferences: _prefs, ...pub }) => pub);
    res.json({ leaderboard });
  });

  app.get('/api/matches', async (req: Request, res: Response) => {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const matches = await db.getMatchHistoryForUser(userId, 40);
    res.json({ matches });
  });

  app.get('/api/elo-history/:userId', async (req: Request, res: Response) => {
    const userId = String(req.params.userId);
    const history = await db.getEloHistoryForUser(userId, 40);
    res.json({ history });
  });

  app.get('/api/encyclopedia', (_req: Request, res: Response) => {
    res.json({
      characters: CHARACTER_DOSSIERS,
      cards: CARD_DOSSIERS,
      rules: RULE_SECTIONS,
      mechanics: MECHANIC_DOSSIERS,
      tutorialStepsCount: TUTORIAL_SCENARIOS.length,
    });
  });

  app.get('/api/p2p/status', (_req: Request, res: Response) => {
    res.json(p2pMeshRef?.getStatus() ?? { connectedRelays: 0, knownPeersCount: 0, remotePlayersInQueue: 0 });
  });

  // Serve built client assets in production
  const distClientPath = path.resolve(process.cwd(), 'dist', 'client');
  app.use(express.static(distClientPath));

  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
  });

  /** Track active local sockets per userId so P2P messages can reach the local player's browser. */
  const localSocketIdsByUserId = new Map<string, Set<string>>();

  /**
   * Broadcast room lobby & strictly projected player views (§4.5, §19).
   * Never sends the raw `ServerMatchState` over the network!
   */
  const syncRoomToParticipants = (room: ManagedRoom): void => {
    const lobby = roomManager.getLobbySnapshot(room);
    for (const color of ['red', 'black'] as const) {
      const participant = room.players[color];
      if (!participant || !participant.socketId) {
        continue;
      }
      const view = room.matchState
        ? roomManager.getProjectedViewForUser(room, participant.userId)
        : null;

      if (participant.socketId.startsWith('p2p:')) {
        p2pMeshRef?.pushStateToRemoteParticipant(participant.socketId, room.roomId, lobby, view);
      } else {
        io.to(participant.socketId).emit('room:lobby_sync', lobby);
        if (view) {
          io.to(participant.socketId).emit('game:state_sync', view);
        }
      }
    }
    if (room.matchState?.phase === 'finished') {
      p2pMeshRef?.broadcastDatabaseSync();
    }
  };

  const p2pMesh = new BlindWarP2PMesh(
    db,
    roomManager,
    {
      deliverRemoteStateToLocalUser: (localUserId, lobby, view) => {
        const sockIds = localSocketIdsByUserId.get(localUserId);
        if (!sockIds) return;
        for (const sid of sockIds) {
          io.to(sid).emit('room:lobby_sync', lobby);
          if (view) {
            io.to(sid).emit('game:state_sync', view);
          }
        }
      },
      onLocalRoomUpdated: (room) => {
        syncRoomToParticipants(room);
      },
    },
    { enabled: options?.enableP2P ?? true },
  );
  p2pMeshRef = p2pMesh;

  io.use(async (socket, next) => {
    const authHeaderToken =
      typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : null;
    if (!authHeaderToken) {
      socket.data.verifiedSession = null;
      next();
      return;
    }
    const authCtx = await authenticateSession(db, authHeaderToken);
    if (!authCtx) {
      next(new Error('Session expirée, invalide ou compte suspendu.'));
      return;
    }
    socket.data.verifiedSession = authCtx.session;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const verifiedSession = (socket.data.verifiedSession ?? null) as
      | ReturnType<typeof verifySessionToken>
      | null;
    const isGuest = verifiedSession === null;

    // Identité invité : toujours préfixée « guest- » côté serveur, pour qu'un client ne puisse
    // jamais se faire passer pour un compte inscrit en envoyant son identifiant.
    const rawGuestId =
      typeof socket.handshake.auth?.guestId === 'string' ? socket.handshake.auth.guestId : '';
    const safeGuestSuffix = rawGuestId.replace(/^guest-/, '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
    const userId =
      verifiedSession?.userId ??
      `guest-${safeGuestSuffix.length >= 6 ? safeGuestSuffix : socket.id.replace(/[^a-zA-Z0-9]/g, '')}`;

    const rawGuestName =
      typeof socket.handshake.auth?.username === 'string' ? socket.handshake.auth.username : '';
    const safeGuestName = rawGuestName.replace(/[<>]/g, '').trim().slice(0, 24);
    const username =
      verifiedSession?.username ??
      `${safeGuestName.length >= 3 ? safeGuestName : `Commandant-${socket.id.slice(0, 4)}`} (invité)`;

    let userSockets = localSocketIdsByUserId.get(userId);
    if (!userSockets) {
      userSockets = new Set<string>();
      localSocketIdsByUserId.set(userId, userSockets);
    }
    userSockets.add(socket.id);

    socket.emit('session:identity', { userId, username, isGuest });
    socket.emit('p2p:status', p2pMesh.getStatus());

    // Check if this user has an active room to reconnect to (§12.2, §21.30)
    const reconnected = roomManager.handleReconnect(userId, socket.id);
    if (reconnected) {
      syncRoomToParticipants(reconnected.room);
    }

    socket.on(
      'room:create',
      async (
        payload: { ruleset?: Partial<CustomRulesetConfig> },
        ack?: (res: { ok: boolean; roomCode?: string; roomId?: string; error?: string }) => void,
      ) => {
        try {
          const dbUser = await db.findUserById(userId);
          const room = roomManager.createCustomRoom(
            {
              userId,
              username,
              displayName: dbUser?.displayName ?? username,
              avatarBadge: dbUser?.avatarBadge ?? '♔',
              avatarImage: dbUser?.avatarImage ?? null,
              eloRating: dbUser?.eloRating ?? 200,
              socketId: socket.id,
            },
            payload?.ruleset ?? {},
          );
          syncRoomToParticipants(room);
          ack?.({ ok: true, roomCode: room.roomCode, roomId: room.roomId });
        } catch (err) {
          ack?.({ ok: false, error: err instanceof Error ? err.message : 'Erreur création salle' });
        }
      },
    );

    socket.on(
      'room:join',
      async (
        payload: { roomCode: string },
        ack?: (res: { ok: boolean; roomId?: string; error?: string }) => void,
      ) => {
        try {
          const dbUser = await db.findUserById(userId);
          try {
            const room = roomManager.joinCustomRoomByCode(payload.roomCode, {
              userId,
              username,
              displayName: dbUser?.displayName ?? username,
              avatarBadge: dbUser?.avatarBadge ?? '♚',
              avatarImage: dbUser?.avatarImage ?? null,
              eloRating: dbUser?.eloRating ?? 200,
              socketId: socket.id,
            });
            syncRoomToParticipants(room);
            ack?.({ ok: true, roomId: room.roomId });
          } catch (localErr) {
            // Si la salle n'est pas sur ce PC, tenter de la rejoindre sur le réseau P2P décentralisé
            const joinedP2P = p2pMesh.tryJoinRemoteCustomRoom(payload.roomCode, {
              userId,
              username,
              eloRating: dbUser?.eloRating ?? 200,
            });
            if (joinedP2P) {
              ack?.({ ok: true });
              return;
            }
            throw localErr;
          }
        } catch (err) {
          ack?.({ ok: false, error: err instanceof Error ? err.message : 'Code invalide' });
        }
      },
    );

    socket.on(
      'room:update_rules',
      (
        payload: { roomId: string; ruleset: Partial<CustomRulesetConfig> },
        ack?: (res: { ok: boolean; error?: string }) => void,
      ) => {
        try {
          const room = roomManager.updateCustomRoomRules(payload.roomId, userId, payload.ruleset);
          syncRoomToParticipants(room);
          ack?.({ ok: true });
        } catch (err) {
          ack?.({ ok: false, error: err instanceof Error ? err.message : 'Action refusée' });
        }
      },
    );

    socket.on(
      'room:start',
      (
        payload: { roomId: string },
        ack?: (res: { ok: boolean; error?: string }) => void,
      ) => {
        try {
          const room = roomManager.requestStartByUser(payload.roomId, userId);
          syncRoomToParticipants(room);
          ack?.({ ok: true });
        } catch (err) {
          ack?.({ ok: false, error: err instanceof Error ? err.message : 'Démarrage impossible' });
        }
      },
    );

    socket.on(
      'room:leave',
      (_payload: unknown, ack?: (res: { ok: boolean; error?: string }) => void) => {
        try {
          if (p2pMesh.sendRemoteGameAction(userId, { kind: 'leave_room' })) {
            ack?.({ ok: true });
            return;
          }
          const result = roomManager.leaveRoom(userId);
          if (result) {
            if (result.closed) {
              // Prévenir l'invité que l'hôte a fermé la salle
              const other = result.room.players.black;
              if (other?.socketId && other.userId !== userId) {
                io.to(other.socketId).emit('room:closed', {
                  reason: 'L’hôte a fermé la salle.',
                });
              }
            } else {
              syncRoomToParticipants(result.room);
            }
          }
          ack?.({ ok: true });
        } catch (err) {
          ack?.({ ok: false, error: err instanceof Error ? err.message : 'Action refusée' });
        }
      },
    );

    socket.on(
      'matchmaking:join',
      async (
        payload: { mode: 'matchmaking_quick' | 'matchmaking_ranked' | 'matchmaking_unranked' },
        ack?: (res: { ok: boolean; matched?: boolean; roomId?: string; error?: string }) => void,
      ) => {
        try {
          const allowedModes = ['matchmaking_quick', 'matchmaking_ranked', 'matchmaking_unranked'];
          if (!payload || !allowedModes.includes(payload.mode)) {
            throw new Error('Mode de matchmaking invalide.');
          }
          const dbUser = isGuest ? null : await db.findUserById(userId);
          if (!isGuest && !dbUser) {
            throw new Error('Compte introuvable : reconnectez-vous.');
          }
          if (payload.mode === 'matchmaking_ranked' && (isGuest || !dbUser)) {
            throw new Error(
              'Compte requis : inscrivez-vous ou connectez-vous pour jouer en Matchmaking Classé.',
            );
          }
          const matchedRoom = roomManager.enqueueMatchmaking({
            userId,
            username,
            displayName: dbUser?.displayName ?? username,
            avatarBadge: dbUser?.avatarBadge ?? '♔',
            avatarImage: dbUser?.avatarImage ?? null,
            eloRating: dbUser?.eloRating ?? 200,
            socketId: socket.id,
            mode: payload.mode,
            joinedAtMs: Date.now(),
            isGuest,
          });

          if (matchedRoom) {
            syncRoomToParticipants(matchedRoom);
            ack?.({ ok: true, matched: true, roomId: matchedRoom.roomId });
          } else {
            ack?.({ ok: true, matched: false });
          }
        } catch (err) {
          ack?.({ ok: false, error: err instanceof Error ? err.message : 'Erreur matchmaking' });
        }
      },
    );

    socket.on('matchmaking:leave', (_payload?: unknown, ack?: (res: { ok: boolean }) => void) => {
      roomManager.leaveMatchmaking(userId);
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on(
      'game:place',
      async (
        payload: { roomId: string; entries: readonly PlacementEntry[] },
        ack?: (res: { ok: boolean; error?: string }) => void,
      ) => {
        try {
          if (p2pMesh.sendRemoteGameAction(userId, { kind: 'place', entries: payload.entries })) {
            ack?.({ ok: true });
            return;
          }
          const room = await roomManager.applyPlacement(payload.roomId, userId, payload.entries);
          syncRoomToParticipants(room);
          ack?.({ ok: true });
        } catch (err) {
          ack?.({ ok: false, error: err instanceof Error ? err.message : 'Placement refusé' });
        }
      },
    );

    socket.on(
      'game:move',
      async (
        payload: {
          roomId: string;
          pieceId: string;
          destination: Coord;
          preferredKind?: MoveCandidateKind;
        },
        ack?: (res: { ok: boolean; error?: string }) => void,
      ) => {
        try {
          if (
            p2pMesh.sendRemoteGameAction(userId, {
              kind: 'move',
              pieceId: payload.pieceId,
              destination: payload.destination,
              preferredKind: payload.preferredKind,
            })
          ) {
            ack?.({ ok: true });
            return;
          }
          const room = await roomManager.applyMove(
            payload.roomId,
            userId,
            payload.pieceId,
            payload.destination,
            Date.now(),
            payload.preferredKind,
          );
          syncRoomToParticipants(room);
          ack?.({ ok: true });
        } catch (err) {
          ack?.({ ok: false, error: err instanceof Error ? err.message : 'Déplacement illégal' });
        }
      },
    );

    socket.on(
      'game:mark_traqueur',
      async (
        payload: { roomId: string; traqueurPieceId: string; targetEnemyPieceId: string },
        ack?: (res: { ok: boolean; error?: string }) => void,
      ) => {
        try {
          if (
            p2pMesh.sendRemoteGameAction(userId, {
              kind: 'mark_traqueur',
              traqueurPieceId: payload.traqueurPieceId,
              targetEnemyPieceId: payload.targetEnemyPieceId,
            })
          ) {
            ack?.({ ok: true });
            return;
          }
          const room = await roomManager.applyTraqueurMark(
            payload.roomId,
            userId,
            payload.traqueurPieceId,
            payload.targetEnemyPieceId,
          );
          syncRoomToParticipants(room);
          ack?.({ ok: true });
        } catch (err) {
          ack?.({ ok: false, error: err instanceof Error ? err.message : 'Marquage refusé' });
        }
      },
    );

    socket.on(
      'game:stop_jump',
      async (
        payload: { roomId: string },
        ack?: (res: { ok: boolean; error?: string }) => void,
      ) => {
        try {
          if (p2pMesh.sendRemoteGameAction(userId, { kind: 'stop_jump' })) {
            ack?.({ ok: true });
            return;
          }
          const room = await roomManager.applyStopJumpChain(payload.roomId, userId);
          syncRoomToParticipants(room);
          ack?.({ ok: true });
        } catch (err) {
          ack?.({ ok: false, error: err instanceof Error ? err.message : 'Action refusée' });
        }
      },
    );

    socket.on(
      'game:skip_rage',
      async (
        payload: { roomId: string },
        ack?: (res: { ok: boolean; error?: string }) => void,
      ) => {
        try {
          if (p2pMesh.sendRemoteGameAction(userId, { kind: 'skip_rage' })) {
            ack?.({ ok: true });
            return;
          }
          const room = await roomManager.applySkipRage(payload.roomId, userId);
          syncRoomToParticipants(room);
          ack?.({ ok: true });
        } catch (err) {
          ack?.({ ok: false, error: err instanceof Error ? err.message : 'Action refusée' });
        }
      },
    );

    socket.on(
      'game:promote',
      async (
        payload: { roomId: string; chosenCharacter: CharacterType },
        ack?: (res: { ok: boolean; error?: string }) => void,
      ) => {
        try {
          if (
            p2pMesh.sendRemoteGameAction(userId, {
              kind: 'promote',
              chosenCharacter: payload.chosenCharacter,
            })
          ) {
            ack?.({ ok: true });
            return;
          }
          const room = await roomManager.applyPromotion(
            payload.roomId,
            userId,
            payload.chosenCharacter,
          );
          syncRoomToParticipants(room);
          ack?.({ ok: true });
        } catch (err) {
          ack?.({ ok: false, error: err instanceof Error ? err.message : 'Promotion refusée' });
        }
      },
    );

    socket.on(
      'game:play_card',
      async (
        payload: { roomId: string; cardPayload: CardPlayPayload },
        ack?: (res: { ok: boolean; error?: string }) => void,
      ) => {
        try {
          if (
            p2pMesh.sendRemoteGameAction(userId, {
              kind: 'play_card',
              cardPayload: payload.cardPayload,
            })
          ) {
            ack?.({ ok: true });
            return;
          }
          const room = await roomManager.applyCard(payload.roomId, userId, payload.cardPayload);
          syncRoomToParticipants(room);
          ack?.({ ok: true });
        } catch (err) {
          ack?.({ ok: false, error: err instanceof Error ? err.message : 'Carte refusée' });
        }
      },
    );

    socket.on(
      'game:draw_offer',
      async (
        payload: { roomId: string },
        ack?: (res: { ok: boolean; error?: string }) => void,
      ) => {
        try {
          if (p2pMesh.sendRemoteGameAction(userId, { kind: 'draw_offer' })) {
            ack?.({ ok: true });
            return;
          }
          const room = await roomManager.applyMutualDraw(payload.roomId, userId);
          syncRoomToParticipants(room);
          ack?.({ ok: true });
        } catch (err) {
          ack?.({ ok: false, error: err instanceof Error ? err.message : 'Action refusée' });
        }
      },
    );

    socket.on(
      'game:resign',
      async (
        payload: { roomId: string },
        ack?: (res: { ok: boolean; error?: string }) => void,
      ) => {
        try {
          if (p2pMesh.sendRemoteGameAction(userId, { kind: 'resign' })) {
            ack?.({ ok: true });
            return;
          }
          const room = await roomManager.applyResign(payload.roomId, userId);
          syncRoomToParticipants(room);
          ack?.({ ok: true });
        } catch (err) {
          ack?.({ ok: false, error: err instanceof Error ? err.message : 'Action refusée' });
        }
      },
    );

    socket.on('disconnect', () => {
      const set = localSocketIdsByUserId.get(userId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) localSocketIdsByUserId.delete(userId);
      }
      const room = roomManager.handleDisconnect(userId, Date.now(), socket.id);
      if (room) {
        syncRoomToParticipants(room);
      }
    });
  });

  // Periodic authoritative clock, reconnection & matchmaking tick every 1000ms
  const intervalId = setInterval(() => {
    const nowMs = Date.now();
    io.emit('p2p:status', p2pMesh.getStatus(nowMs));
    // Retente l'appariement (fenêtre ELO qui s'élargit avec l'attente en Classé)
    for (const room of roomManager.tryMatchQueues(nowMs)) {
      syncRoomToParticipants(room);
    }
    // Informe les joueurs en file de leur temps d'attente / fenêtre ELO
    for (const candidate of roomManager.getQueuedCandidates()) {
      const status = roomManager.getQueueStatus(candidate.userId, nowMs);
      if (status) {
        io.to(candidate.socketId).emit('matchmaking:status', status);
      }
    }
    void roomManager.tickAllActiveRooms(nowMs).then((rooms) => {
      for (const room of rooms) {
        syncRoomToParticipants(room);
      }
    });
  }, 1000);

  const close = async (): Promise<void> => {
    clearInterval(intervalId);
    p2pMesh.dispose();
    roomManager.dispose();
    await new Promise<void>((resolve) => {
      io.close(() => {
        httpServer.close(() => resolve());
      });
    });
  };

  return {
    app,
    httpServer,
    io,
    db,
    authService,
    roomManager,
    p2pMesh,
    close,
  };
}

// Start standalone server when executed directly
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('server/src/index.ts')) {
  const port = Number(process.env.PORT ?? 3001);
  void createBlindWarServer().then(({ app, httpServer, roomManager }) => {
    let publicTunnelUrl: string | null = null;
    app.get('/api/tunnel-url', (_req, res) => {
      res.json({ publicTunnelUrl });
    });

    httpServer.listen(port, () => {
      console.log(`[BLIND WAR Server] Autorité temps réel démarrée sur http://localhost:${port}`);
      // Adresses à donner aux joueurs du même réseau local (Wi-Fi / Ethernet)
      const lanAddresses = Object.values(os.networkInterfaces())
        .flat()
        .filter((iface): iface is os.NetworkInterfaceInfo =>
          Boolean(iface && iface.family === 'IPv4' && !iface.internal),
        )
        .map((iface) => `http://${iface.address}:${port}`);
      if (lanAddresses.length > 0) {
        console.log(`[BLIND WAR Server] Joueurs du même réseau : ${lanAddresses.join('  |  ')}`);
      }

      // Démarre automatiquement un tunnel HTTPS public (contourne le pare-feu Windows pour Mobile 4G/5G/Wi-Fi)
      const cfPath = path.join(
        process.env.LOCALAPPDATA ?? '',
        'Programs',
        'cloudflared',
        'cloudflared.exe',
      );
      if (fs.existsSync(cfPath)) {
        const cfProc = spawn(
          cfPath,
          ['tunnel', '--url', `http://localhost:${port}`, '--no-autoupdate'],
          { stdio: ['ignore', 'pipe', 'pipe'] },
        );
        const handleChunk = (chunk: Buffer) => {
          const text = chunk.toString('utf8');
          const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
          if (match && !publicTunnelUrl) {
            publicTunnelUrl = match[0];
            console.log('');
            console.log('============================================================================');
            console.log(`📱 LIEN MOBILE & AMIS (Wi-Fi / 4G / 5G) : ${publicTunnelUrl}`);
            console.log('   Ouvrez ce lien sur n\'importe quel téléphone (iPhone/Android) ou PC !');
            console.log('============================================================================');
            console.log('');
          }
        };
        cfProc.stdout.on('data', handleChunk);
        cfProc.stderr.on('data', handleChunk);
        process.on('exit', () => {
          cfProc.kill();
        });
      }
    });
    const shutdown = () => {
      roomManager.dispose();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
}
