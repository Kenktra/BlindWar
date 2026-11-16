import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  OFFICIAL_RECONNECT_GRACE_MS,
  OFFICIAL_RULESET_CONFIG,
  createMatchState,
  createZeroNewMechanicsStats,
  executePieceMove,
  finalizePlacementOnTimerExpired,
  forfeitByDisconnectionTimeout,
  markTraqueurTarget,
  migrateLegacyMatchState,
  playCard,
  projectMatchStateForViewer,
  proposeOrAcceptMutualDraw,
  resignMatch,
  selectSoldierPromotion,
  skipBerserkerRageMove,
  stopCavalierJumpChain,
  submitPlayerPlacement,
  tickMatchClock,
  type CardPlayPayload,
  type CharacterType,
  type ClientMatchView,
  type Coord,
  type CustomRulesetConfig,
  type EloUpdateResult,
  type GameMode,
  type MoveCandidateKind,
  type PlacementEntry,
  type PlayerColor,
  type ServerMatchState,
} from '../../../shared/src/index.js';
import type { BlindWarDatabase } from '../database/db.js';
import { atomicWriteTextFileSync } from '../database/dataPaths.js';

export interface RoomParticipant {
  readonly userId: string;
  readonly username: string;
  readonly displayName?: string;
  readonly avatarBadge?: string;
  readonly avatarImage?: string | null;
  eloRating: number;
  socketId: string | null;
  connected: boolean;
  disconnectedAtMs: number | null;
  readyInLobby: boolean;
}

export interface ManagedRoom {
  readonly roomId: string;
  readonly roomCode: string;
  readonly mode: GameMode;
  readonly isPrivateCustom: boolean;
  ruleset: CustomRulesetConfig;
  players: {
    red: RoomParticipant | null;
    black: RoomParticipant | null;
  };
  matchState: ServerMatchState | null;
  prepStartedAtMs: number | null;
  prepDeadlineMs: number | null;
  startedAtIso: string | null;
  persistedResult: boolean;
  eloResult?: EloUpdateResult | null;
}

export interface RoomLobbySnapshot {
  readonly roomId: string;
  readonly roomCode: string;
  readonly mode: GameMode;
  readonly isPrivateCustom: boolean;
  readonly ruleset: CustomRulesetConfig;
  readonly redPlayer: {
    readonly userId: string;
    readonly username: string;
    readonly displayName?: string;
    readonly avatarBadge?: string;
    readonly avatarImage?: string | null;
    readonly eloRating: number;
    readonly ready: boolean;
    readonly connected: boolean;
  } | null;
  readonly blackPlayer: {
    readonly userId: string;
    readonly username: string;
    readonly displayName?: string;
    readonly avatarBadge?: string;
    readonly avatarImage?: string | null;
    readonly eloRating: number;
    readonly ready: boolean;
    readonly connected: boolean;
  } | null;
  readonly matchStarted: boolean;
  readonly prepRemainingSeconds: number | null;
  readonly eloResult?: EloUpdateResult | null;
}

export interface QueueCandidate {
  readonly userId: string;
  readonly username: string;
  readonly displayName?: string;
  readonly avatarBadge?: string;
  readonly avatarImage?: string | null;
  readonly eloRating: number;
  readonly socketId: string;
  readonly mode: 'matchmaking_quick' | 'matchmaking_ranked' | 'matchmaking_unranked';
  readonly joinedAtMs: number;
  /** Joueur invité (sans compte). Les invités sont refusés en Matchmaking Classé. */
  readonly isGuest?: boolean;
}

/** Fenêtre ELO initiale en Matchmaking Classé (± points). */
export const RANKED_INITIAL_ELO_WINDOW = 100;
/** Élargissement de la fenêtre ELO toutes les 10 secondes d'attente. */
export const RANKED_ELO_WINDOW_STEP = 50;
export const RANKED_ELO_WINDOW_STEP_INTERVAL_MS = 10_000;
/** Fenêtre ELO maximale (atteinte après ~3 minutes d'attente). */
export const RANKED_MAX_ELO_WINDOW = 1_000;
/** Durée de conservation d'une salle terminée avant suppression de la mémoire. */
export const FINISHED_ROOM_RETENTION_MS = 5 * 60 * 1000;

export function computeRankedEloWindow(joinedAtMs: number, nowMs: number): number {
  const waitedSteps = Math.max(
    0,
    Math.floor((nowMs - joinedAtMs) / RANKED_ELO_WINDOW_STEP_INTERVAL_MS),
  );
  return Math.min(
    RANKED_MAX_ELO_WINDOW,
    RANKED_INITIAL_ELO_WINDOW + waitedSteps * RANKED_ELO_WINDOW_STEP,
  );
}

interface RoomsSnapshotFile {
  readonly savedAtMs: number;
  readonly rooms: ManagedRoom[];
}

export class GameRoomManager {
  private readonly roomsById = new Map<string, ManagedRoom>();
  private readonly roomIdByCode = new Map<string, string>();
  private readonly activeRoomByUserId = new Map<string, string>();
  private readonly finishedAtMsByRoomId = new Map<string, number>();
  private readonly queues: Record<
    'matchmaking_quick' | 'matchmaking_ranked' | 'matchmaking_unranked',
    QueueCandidate[]
  > = {
    matchmaking_quick: [],
    matchmaking_ranked: [],
    matchmaking_unranked: [],
  };
  private readonly snapshotFilePath: string | null;
  private snapshotTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly db: BlindWarDatabase,
    options?: { snapshotFilePath?: string | null },
  ) {
    this.snapshotFilePath = options?.snapshotFilePath ?? null;
    this.restoreSnapshot();
  }

  // ---------------------------------------------------------------------------
  // Persistance des salles en cours (survit à un redémarrage du serveur)
  // ---------------------------------------------------------------------------

  private restoreSnapshot(nowMs: number = Date.now()): void {
    if (!this.snapshotFilePath) {
      return;
    }
    const staleTmp = `${this.snapshotFilePath}.tmp`;
    if (fs.existsSync(staleTmp)) {
      try {
        fs.unlinkSync(staleTmp);
      } catch {
        // Ignore locked temp file
      }
    }
    if (!fs.existsSync(this.snapshotFilePath)) {
      return;
    }
    try {
      const raw = fs.readFileSync(this.snapshotFilePath, 'utf-8');
      const parsed = JSON.parse(raw) as RoomsSnapshotFile;
      const downtimeMs = Math.max(0, nowMs - parsed.savedAtMs);

      for (const room of parsed.rooms) {
        if (room.matchState?.phase === 'finished') {
          continue;
        }
        // Les joueurs doivent se reconnecter : délai de grâce de 60 s à partir du redémarrage
        for (const color of ['red', 'black'] as const) {
          const p = room.players[color];
          if (p) {
            p.connected = false;
            p.socketId = null;
            p.disconnectedAtMs = nowMs;
          }
        }
        // Le temps d'arrêt du serveur n'est décompté à personne
        if (room.prepDeadlineMs !== null) {
          room.prepDeadlineMs += downtimeMs;
        }
        if (room.matchState) {
          room.matchState = migrateLegacyMatchState(room.matchState);
          if (room.matchState.clock.lastTickTimestampMs !== null) {
            room.matchState = {
              ...room.matchState,
              clock: { ...room.matchState.clock, lastTickTimestampMs: nowMs },
            };
          }
        }

        this.roomsById.set(room.roomId, room);
        this.roomIdByCode.set(room.roomCode, room.roomId);
        if (room.players.red) this.activeRoomByUserId.set(room.players.red.userId, room.roomId);
        if (room.players.black) this.activeRoomByUserId.set(room.players.black.userId, room.roomId);
      }
    } catch {
      // Snapshot corrompu : on repart d'un état vide sans bloquer le démarrage
    }
  }

  /** Écrit (avec un léger anti-rebond) les salles non terminées sur disque. */
  private scheduleSnapshot(): void {
    if (!this.snapshotFilePath || this.snapshotTimer) {
      return;
    }
    this.snapshotTimer = setTimeout(() => {
      this.snapshotTimer = null;
      this.writeSnapshotNow();
    }, 500);
    this.snapshotTimer.unref?.();
  }

  writeSnapshotNow(): void {
    if (!this.snapshotFilePath) {
      return;
    }
    const rooms = [...this.roomsById.values()].filter(
      (r) => r.matchState?.phase !== 'finished',
    );
    if (rooms.length === 0 && !fs.existsSync(this.snapshotFilePath)) {
      return;
    }
    const payload: RoomsSnapshotFile = { savedAtMs: Date.now(), rooms };
    try {
      atomicWriteTextFileSync(this.snapshotFilePath, JSON.stringify(payload), {
        createBackup: false,
      });
    } catch {
      // Écriture impossible : la partie continue en mémoire
    }
  }

  dispose(): void {
    if (this.snapshotTimer) {
      clearTimeout(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    this.writeSnapshotNow();
  }

  // ---------------------------------------------------------------------------
  // Garde-fous d'appartenance aux salles
  // ---------------------------------------------------------------------------

  /**
   * Un joueur ne peut avoir qu'une seule partie à la fois.
   * - Partie lancée et non terminée -> refus.
   * - Salle personnalisée pas encore lancée -> il la quitte automatiquement.
   */
  private prepareUserForNewRoom(userId: string): void {
    const current = this.getActiveRoomForUser(userId);
    if (!current) {
      return;
    }
    if (current.matchState && current.matchState.phase !== 'finished') {
      throw new Error(`Vous avez déjà une partie en cours. Terminez-la avant d'en lancer une autre.`);
    }
    if (!current.matchState) {
      this.leaveRoom(userId);
    } else {
      this.activeRoomByUserId.delete(userId);
    }
  }

  /**
   * Quitter une salle personnalisée avant son lancement.
   * L'hôte qui part ferme la salle ; l'invité qui part libère sa place.
   * Retourne la salle mise à jour (ou null si elle a été fermée / introuvable).
   */
  leaveRoom(userId: string): { readonly room: ManagedRoom; readonly closed: boolean } | null {
    const room = this.getActiveRoomForUser(userId);
    if (!room) {
      return null;
    }
    if (room.matchState && room.matchState.phase !== 'finished') {
      throw new Error(`La partie a commencé : utilisez « Abandonner » pour la quitter.`);
    }
    this.activeRoomByUserId.delete(userId);

    if (room.matchState) {
      return { room, closed: false };
    }

    if (room.players.red?.userId === userId) {
      // L'hôte ferme la salle
      if (room.players.black) {
        this.activeRoomByUserId.delete(room.players.black.userId);
      }
      this.roomsById.delete(room.roomId);
      this.roomIdByCode.delete(room.roomCode);
      this.scheduleSnapshot();
      return { room, closed: true };
    }

    if (room.players.black?.userId === userId) {
      room.players.black = null;
    }
    this.scheduleSnapshot();
    return { room, closed: false };
  }

  /** Démarrage demandé par un joueur : seul l'hôte (Rouge) d'une salle privée peut lancer. */
  requestStartByUser(roomId: string, userId: string, nowMs: number = Date.now()): ManagedRoom {
    const room = this.roomsById.get(roomId);
    if (!room) {
      throw new Error(`Salle introuvable.`);
    }
    const color = this.getPlayerColorInRoom(room, userId);
    if (!color) {
      throw new Error(`Vous ne faites pas partie de cette salle.`);
    }
    if (room.isPrivateCustom && color !== 'red') {
      throw new Error(`Seul l'hôte de la salle peut lancer la partie.`);
    }
    return this.startMatchInRoom(roomId, nowMs);
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    do {
      code = 'BW-';
      for (let i = 0; i < 4; i += 1) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (this.roomIdByCode.has(code));
    return code;
  }

  createCustomRoom(
    host: {
      userId: string;
      username: string;
      displayName?: string;
      avatarBadge?: string;
      avatarImage?: string | null;
      eloRating: number;
      socketId: string | null;
    },
    customRuleset: Partial<CustomRulesetConfig> = {},
  ): ManagedRoom {
    this.prepareUserForNewRoom(host.userId);
    this.leaveMatchmaking(host.userId);
    const roomId = `room-${crypto.randomUUID().slice(0, 8)}`;
    const roomCode = this.generateRoomCode();
    const ruleset: CustomRulesetConfig = {
      ...OFFICIAL_RULESET_CONFIG,
      ...customRuleset,
    };

    const room: ManagedRoom = {
      roomId,
      roomCode,
      mode: 'online_custom',
      isPrivateCustom: true,
      ruleset,
      players: {
        red: {
          userId: host.userId,
          username: host.username,
          displayName: host.displayName,
          avatarBadge: host.avatarBadge,
          avatarImage: host.avatarImage,
          eloRating: host.eloRating,
          socketId: host.socketId,
          connected: true,
          disconnectedAtMs: null,
          readyInLobby: true,
        },
        black: null,
      },
      matchState: null,
      prepStartedAtMs: null,
      prepDeadlineMs: null,
      startedAtIso: null,
      persistedResult: false,
    };

    this.roomsById.set(roomId, room);
    this.roomIdByCode.set(roomCode, roomId);
    this.activeRoomByUserId.set(host.userId, roomId);
    this.scheduleSnapshot();
    return room;
  }

  joinCustomRoomByCode(
    roomCode: string,
    guest: {
      userId: string;
      username: string;
      displayName?: string;
      avatarBadge?: string;
      avatarImage?: string | null;
      eloRating: number;
      socketId: string | null;
    },
  ): ManagedRoom {
    const normalized = roomCode.trim().toUpperCase();
    const roomId = this.roomIdByCode.get(normalized);
    if (!roomId) {
      throw new Error(`Code de salle introuvable (${normalized}).`);
    }
    const room = this.roomsById.get(roomId)!;

    if (room.players.red?.userId === guest.userId) {
      room.players.red.socketId = guest.socketId;
      room.players.red.connected = true;
      room.players.red.disconnectedAtMs = null;
      return room;
    }

    if (room.players.black && room.players.black.userId !== guest.userId) {
      throw new Error(`Cette salle est déjà complète.`);
    }
    if (room.matchState !== null && room.players.black?.userId !== guest.userId) {
      throw new Error(`Cette partie a déjà commencé.`);
    }

    if (this.activeRoomByUserId.get(guest.userId) !== room.roomId) {
      this.prepareUserForNewRoom(guest.userId);
    }
    this.leaveMatchmaking(guest.userId);

    room.players.black = {
      userId: guest.userId,
      username: guest.username,
      displayName: guest.displayName,
      avatarBadge: guest.avatarBadge,
      avatarImage: guest.avatarImage,
      eloRating: guest.eloRating,
      socketId: guest.socketId,
      connected: true,
      disconnectedAtMs: null,
      readyInLobby: true,
    };
    this.activeRoomByUserId.set(guest.userId, room.roomId);
    this.scheduleSnapshot();
    return room;
  }

  updateCustomRoomRules(
    roomId: string,
    actorUserId: string,
    customRuleset: Partial<CustomRulesetConfig>,
  ): ManagedRoom {
    const room = this.roomsById.get(roomId);
    if (!room || !room.isPrivateCustom) {
      throw new Error(`Salle personnalisée introuvable.`);
    }
    if (room.players.red?.userId !== actorUserId) {
      throw new Error(`Seul l'hôte de la salle peut modifier les règles.`);
    }
    if (room.matchState !== null) {
      throw new Error(`Impossible de modifier les règles après le lancement de la partie.`);
    }

    room.ruleset = {
      ...room.ruleset,
      ...customRuleset,
    };
    this.scheduleSnapshot();
    return room;
  }

  startMatchInRoom(roomId: string, nowMs: number = Date.now()): ManagedRoom {
    const room = this.roomsById.get(roomId);
    if (!room) {
      throw new Error(`Salle introuvable.`);
    }
    if (!room.players.red || !room.players.black) {
      throw new Error(`Deux joueurs sont requis pour démarrer la partie.`);
    }
    if (room.matchState !== null) {
      return room;
    }

    room.matchState = createMatchState(room.roomId, room.mode, room.ruleset);
    room.prepStartedAtMs = nowMs;
    room.prepDeadlineMs = nowMs + room.ruleset.prepDurationSeconds * 1000;
    room.startedAtIso = new Date(nowMs).toISOString();
    this.scheduleSnapshot();
    return room;
  }

  /**
   * Entrée dans une file de matchmaking (§12.3).
   * - Classé : réservé aux joueurs inscrits ; appariement avec l'adversaire le plus proche
   *   en ELO, dans une fenêtre de ±100 qui s'élargit de 50 points toutes les 10 s d'attente.
   * - Rapide / Non classé : premier adversaire disponible.
   * Si aucun adversaire compatible n'est disponible, le joueur reste en file ; le tick serveur
   * (`tryMatchQueues`) retente l'appariement chaque seconde.
   */
  enqueueMatchmaking(candidate: QueueCandidate): ManagedRoom | null {
    if (
      candidate.mode === 'matchmaking_ranked' &&
      (candidate.isGuest === true || candidate.userId.startsWith('guest-'))
    ) {
      throw new Error(
        'Compte requis : inscrivez-vous ou connectez-vous pour jouer en Matchmaking Classé.',
      );
    }

    this.prepareUserForNewRoom(candidate.userId);
    // Remove from any existing queue first
    this.leaveMatchmaking(candidate.userId);
    const queue = this.queues[candidate.mode];
    const nowMs = candidate.joinedAtMs;

    let partnerIdx = -1;
    if (candidate.mode === 'matchmaking_ranked') {
      let bestDiff = Infinity;
      const candidateWindow = computeRankedEloWindow(candidate.joinedAtMs, nowMs);
      for (let i = 0; i < queue.length; i += 1) {
        const diff = Math.abs(queue[i].eloRating - candidate.eloRating);
        const allowed = Math.max(candidateWindow, computeRankedEloWindow(queue[i].joinedAtMs, nowMs));
        if (diff <= allowed && diff < bestDiff) {
          bestDiff = diff;
          partnerIdx = i;
        }
      }
    } else if (queue.length > 0) {
      partnerIdx = 0;
    }

    if (partnerIdx >= 0) {
      const [partner] = queue.splice(partnerIdx, 1);
      return this.createMatchmakingRoom(partner, candidate, nowMs);
    }

    queue.push(candidate);
    return null;
  }

  /**
   * Retente l'appariement des joueurs en attente (élargissement progressif de la fenêtre ELO
   * en Classé). Retourne les nouvelles salles créées.
   */
  tryMatchQueues(nowMs: number = Date.now()): ManagedRoom[] {
    const created: ManagedRoom[] = [];
    for (const mode of Object.keys(this.queues) as (keyof typeof this.queues)[]) {
      let paired = true;
      while (paired) {
        paired = false;
        const queue = this.queues[mode];
        if (queue.length < 2) break;

        let bestPair: [number, number] | null = null;
        let bestDiff = Infinity;
        for (let i = 0; i < queue.length; i += 1) {
          for (let j = i + 1; j < queue.length; j += 1) {
            if (queue[i].userId === queue[j].userId) continue;
            const diff = Math.abs(queue[i].eloRating - queue[j].eloRating);
            const allowed =
              mode === 'matchmaking_ranked'
                ? Math.max(
                    computeRankedEloWindow(queue[i].joinedAtMs, nowMs),
                    computeRankedEloWindow(queue[j].joinedAtMs, nowMs),
                  )
                : Infinity;
            if (diff <= allowed && diff < bestDiff) {
              bestDiff = diff;
              bestPair = [i, j];
            }
          }
        }

        if (bestPair) {
          const [i, j] = bestPair;
          const first = queue[i];
          const second = queue[j];
          this.queues[mode] = queue.filter((_, idx) => idx !== i && idx !== j);
          created.push(this.createMatchmakingRoom(first, second, nowMs));
          paired = true;
        }
      }
    }
    return created;
  }

  /** Position et fenêtre ELO actuelles d'un joueur en file (pour l'affichage client). */
  getQueueStatus(
    userId: string,
    nowMs: number = Date.now(),
  ): { mode: QueueCandidate['mode']; waitingSeconds: number; playersInQueue: number; eloWindow: number | null } | null {
    for (const mode of Object.keys(this.queues) as (keyof typeof this.queues)[]) {
      const entry = this.queues[mode].find((c) => c.userId === userId);
      if (entry) {
        return {
          mode,
          waitingSeconds: Math.max(0, Math.floor((nowMs - entry.joinedAtMs) / 1000)),
          playersInQueue: this.queues[mode].length,
          eloWindow:
            mode === 'matchmaking_ranked' ? computeRankedEloWindow(entry.joinedAtMs, nowMs) : null,
        };
      }
    }
    return null;
  }

  /** Liste des joueurs actuellement en file (userId + socketId). */
  getQueuedCandidates(): readonly QueueCandidate[] {
    return [
      ...this.queues.matchmaking_quick,
      ...this.queues.matchmaking_ranked,
      ...this.queues.matchmaking_unranked,
    ];
  }

  /** Liste des codes de salles personnalisées en attente d'un second joueur (pour l'annonce P2P). */
  getOpenCustomRoomCodes(): readonly string[] {
    const codes: string[] = [];
    for (const room of this.roomsById.values()) {
      if (room.isPrivateCustom && room.matchState === null && !room.players.black) {
        codes.push(room.roomCode);
      }
    }
    return codes;
  }

  /**
   * Apparie un joueur local en attente avec un joueur distant détecté sur le réseau P2P.
   */
  pairLocalWithRemoteCandidate(
    localUserId: string,
    remoteCandidate: QueueCandidate,
    nowMs: number = Date.now(),
  ): ManagedRoom | null {
    if (
      remoteCandidate.mode === 'matchmaking_ranked' &&
      (remoteCandidate.isGuest === true || remoteCandidate.userId.startsWith('guest-'))
    ) {
      return null;
    }
    const queue = this.queues[remoteCandidate.mode];
    const localIdx = queue.findIndex((c) => c.userId === localUserId);
    if (localIdx === -1) {
      return null;
    }
    const [localCandidate] = queue.splice(localIdx, 1);
    return this.createMatchmakingRoom(localCandidate, remoteCandidate, nowMs);
  }

  private createMatchmakingRoom(
    waiting: QueueCandidate,
    arriving: QueueCandidate,
    nowMs: number,
  ): ManagedRoom {
    const roomId = `mm-${crypto.randomUUID().slice(0, 8)}`;
    const roomCode = this.generateRoomCode();

    const room: ManagedRoom = {
      roomId,
      roomCode,
      mode: arriving.mode,
      isPrivateCustom: false,
      ruleset: OFFICIAL_RULESET_CONFIG,
      players: {
        red: {
          userId: waiting.userId,
          username: waiting.username,
          displayName: waiting.displayName,
          avatarBadge: waiting.avatarBadge,
          avatarImage: waiting.avatarImage,
          eloRating: waiting.eloRating,
          socketId: waiting.socketId,
          connected: true,
          disconnectedAtMs: null,
          readyInLobby: true,
        },
        black: {
          userId: arriving.userId,
          username: arriving.username,
          displayName: arriving.displayName,
          avatarBadge: arriving.avatarBadge,
          avatarImage: arriving.avatarImage,
          eloRating: arriving.eloRating,
          socketId: arriving.socketId,
          connected: true,
          disconnectedAtMs: null,
          readyInLobby: true,
        },
      },
      matchState: null,
      prepStartedAtMs: null,
      prepDeadlineMs: null,
      startedAtIso: null,
      persistedResult: false,
    };

    this.roomsById.set(roomId, room);
    this.roomIdByCode.set(roomCode, roomId);
    this.activeRoomByUserId.set(waiting.userId, roomId);
    this.activeRoomByUserId.set(arriving.userId, roomId);

    return this.startMatchInRoom(roomId, nowMs);
  }

  leaveMatchmaking(userId: string): void {
    for (const mode of Object.keys(this.queues) as (keyof typeof this.queues)[]) {
      this.queues[mode] = this.queues[mode].filter((c) => c.userId !== userId);
    }
  }

  getRoom(roomId: string): ManagedRoom | null {
    return this.roomsById.get(roomId) ?? null;
  }

  getActiveRoomForUser(userId: string): ManagedRoom | null {
    const roomId = this.activeRoomByUserId.get(userId);
    if (!roomId) return null;
    return this.roomsById.get(roomId) ?? null;
  }

  getPlayerColorInRoom(room: ManagedRoom, userId: string): PlayerColor | null {
    if (room.players.red?.userId === userId) return 'red';
    if (room.players.black?.userId === userId) return 'black';
    return null;
  }

  getLobbySnapshot(room: ManagedRoom, nowMs: number = Date.now()): RoomLobbySnapshot {
    const prepRemainingSeconds =
      room.matchState?.phase === 'placement' && room.prepDeadlineMs !== null
        ? Math.max(0, Math.ceil((room.prepDeadlineMs - nowMs) / 1000))
        : null;

    return {
      roomId: room.roomId,
      roomCode: room.roomCode,
      mode: room.mode,
      isPrivateCustom: room.isPrivateCustom,
      ruleset: room.ruleset,
      redPlayer: room.players.red
        ? {
            userId: room.players.red.userId,
            username: room.players.red.username,
            displayName: room.players.red.displayName,
            avatarBadge: room.players.red.avatarBadge,
            avatarImage: room.players.red.avatarImage,
            eloRating: room.players.red.eloRating,
            ready: room.players.red.readyInLobby,
            connected: room.players.red.connected,
          }
        : null,
      blackPlayer: room.players.black
        ? {
            userId: room.players.black.userId,
            username: room.players.black.username,
            displayName: room.players.black.displayName,
            avatarBadge: room.players.black.avatarBadge,
            avatarImage: room.players.black.avatarImage,
            eloRating: room.players.black.eloRating,
            ready: room.players.black.readyInLobby,
            connected: room.players.black.connected,
          }
        : null,
      matchStarted: room.matchState !== null,
      prepRemainingSeconds,
      eloResult: room.eloResult ?? null,
    };
  }

  /**
   * Project the room's match state strictly for `userId` (§4.5, §19).
   */
  getProjectedViewForUser(room: ManagedRoom, userId: string): ClientMatchView | null {
    if (!room.matchState) return null;
    const color = this.getPlayerColorInRoom(room, userId);
    if (!color) return null;
    return projectMatchStateForViewer(room.matchState, color);
  }

  handleDisconnect(
    userId: string,
    nowMs: number = Date.now(),
    socketId?: string,
  ): ManagedRoom | null {
    // Ne retirer de la file que l'entrée liée à ce socket (un autre onglet peut être actif)
    for (const mode of Object.keys(this.queues) as (keyof typeof this.queues)[]) {
      this.queues[mode] = this.queues[mode].filter(
        (c) => !(c.userId === userId && (socketId === undefined || c.socketId === socketId)),
      );
    }
    const room = this.getActiveRoomForUser(userId);
    if (!room) return null;

    const color = this.getPlayerColorInRoom(room, userId);
    if (!color) return null;
    const participant = room.players[color]!;
    if (socketId !== undefined && participant.socketId !== socketId) {
      // Ce socket n'est plus celui utilisé pour la partie : rien à faire
      return null;
    }
    participant.connected = false;
    participant.socketId = null;
    participant.disconnectedAtMs = nowMs;
    this.scheduleSnapshot();
    return room;
  }

  handleReconnect(
    userId: string,
    socketId: string | null,
  ): { readonly room: ManagedRoom; readonly color: PlayerColor } | null {
    const room = this.getActiveRoomForUser(userId);
    if (!room) return null;
    const color = this.getPlayerColorInRoom(room, userId);
    if (!color) return null;

    const participant = room.players[color]!;
    participant.connected = true;
    participant.socketId = socketId;
    participant.disconnectedAtMs = null;
    this.scheduleSnapshot();
    return { room, color };
  }

  async applyPlacement(
    roomId: string,
    userId: string,
    entries: readonly PlacementEntry[],
    nowMs: number = Date.now(),
  ): Promise<ManagedRoom> {
    const room = this.roomsById.get(roomId);
    if (!room || !room.matchState) {
      throw new Error(`Partie introuvable.`);
    }
    const color = this.getPlayerColorInRoom(room, userId);
    if (!color) {
      throw new Error(`Vous ne participez pas à cette partie.`);
    }

    room.matchState = submitPlayerPlacement(room.matchState, color, entries, nowMs);
    await this.persistIfFinished(room);
    return room;
  }

  async applyMove(
    roomId: string,
    userId: string,
    pieceId: string,
    destination: Coord,
    nowMs: number = Date.now(),
    preferredKind?: MoveCandidateKind,
  ): Promise<ManagedRoom> {
    const room = this.roomsById.get(roomId);
    if (!room || !room.matchState) {
      throw new Error(`Partie introuvable.`);
    }
    const color = this.getPlayerColorInRoom(room, userId);
    if (!color) {
      throw new Error(`Vous ne participez pas à cette partie.`);
    }

    room.matchState = executePieceMove(
      room.matchState,
      color,
      pieceId,
      destination,
      nowMs,
      undefined,
      preferredKind,
    );
    await this.persistIfFinished(room);
    return room;
  }

  async applyTraqueurMark(
    roomId: string,
    userId: string,
    traqueurPieceId: string,
    targetEnemyPieceId: string,
    nowMs: number = Date.now(),
  ): Promise<ManagedRoom> {
    const room = this.roomsById.get(roomId);
    if (!room || !room.matchState) {
      throw new Error(`Partie introuvable.`);
    }
    const color = this.getPlayerColorInRoom(room, userId);
    if (!color) {
      throw new Error(`Action non autorisée.`);
    }

    room.matchState = markTraqueurTarget(
      room.matchState,
      color,
      traqueurPieceId,
      targetEnemyPieceId,
      nowMs,
    );
    this.scheduleSnapshot();
    return room;
  }

  async applyStopJumpChain(
    roomId: string,
    userId: string,
    nowMs: number = Date.now(),
  ): Promise<ManagedRoom> {
    const room = this.roomsById.get(roomId);
    if (!room || !room.matchState) throw new Error(`Partie introuvable.`);
    const color = this.getPlayerColorInRoom(room, userId);
    if (!color) throw new Error(`Action non autorisée.`);

    room.matchState = stopCavalierJumpChain(room.matchState, color, nowMs);
    await this.persistIfFinished(room);
    return room;
  }

  async applySkipRage(
    roomId: string,
    userId: string,
    nowMs: number = Date.now(),
  ): Promise<ManagedRoom> {
    const room = this.roomsById.get(roomId);
    if (!room || !room.matchState) throw new Error(`Partie introuvable.`);
    const color = this.getPlayerColorInRoom(room, userId);
    if (!color) throw new Error(`Action non autorisée.`);

    room.matchState = skipBerserkerRageMove(room.matchState, color, nowMs);
    await this.persistIfFinished(room);
    return room;
  }

  async applyPromotion(
    roomId: string,
    userId: string,
    chosenCharacter: CharacterType,
    nowMs: number = Date.now(),
  ): Promise<ManagedRoom> {
    const room = this.roomsById.get(roomId);
    if (!room || !room.matchState) throw new Error(`Partie introuvable.`);
    const color = this.getPlayerColorInRoom(room, userId);
    if (!color) throw new Error(`Action non autorisée.`);

    room.matchState = selectSoldierPromotion(room.matchState, color, chosenCharacter, nowMs);
    await this.persistIfFinished(room);
    return room;
  }

  async applyCard(
    roomId: string,
    userId: string,
    payload: CardPlayPayload,
    nowMs: number = Date.now(),
  ): Promise<ManagedRoom> {
    const room = this.roomsById.get(roomId);
    if (!room || !room.matchState) throw new Error(`Partie introuvable.`);
    const color = this.getPlayerColorInRoom(room, userId);
    if (!color) throw new Error(`Action non autorisée.`);

    room.matchState = playCard(room.matchState, color, payload, nowMs);
    await this.persistIfFinished(room);
    return room;
  }

  async applyResign(
    roomId: string,
    userId: string,
    nowMs: number = Date.now(),
  ): Promise<ManagedRoom> {
    const room = this.roomsById.get(roomId);
    if (!room || !room.matchState) throw new Error(`Partie introuvable.`);
    const color = this.getPlayerColorInRoom(room, userId);
    if (!color) throw new Error(`Action non autorisée.`);

    room.matchState = resignMatch(room.matchState, color, nowMs);
    await this.persistIfFinished(room);
    return room;
  }

  async applyMutualDraw(
    roomId: string,
    userId: string,
    nowMs: number = Date.now(),
  ): Promise<ManagedRoom> {
    const room = this.roomsById.get(roomId);
    if (!room || !room.matchState) throw new Error(`Partie introuvable.`);
    const color = this.getPlayerColorInRoom(room, userId);
    if (!color) throw new Error(`Action non autorisée.`);

    room.matchState = proposeOrAcceptMutualDraw(room.matchState, color, nowMs);
    await this.persistIfFinished(room);
    return room;
  }

  /**
   * Periodic server tick (every 1s) checking:
   * 1. Preparation timer expiration -> auto-completes placement (§3.2)
   * 2. Active player's 10-minute clock expiration -> timeout defeat (§11, §21.29)
   * 3. Disconnected player's 60-second reconnection deadline -> disconnect forfeit (§12.2, §21.30)
   */
  async tickAllActiveRooms(nowMs: number = Date.now()): Promise<ManagedRoom[]> {
    const updatedRooms: ManagedRoom[] = [];

    for (const room of [...this.roomsById.values()]) {
      // Nettoyage mémoire des salles terminées depuis plus de 5 minutes
      if (room.matchState?.phase === 'finished') {
        const finishedAt = this.finishedAtMsByRoomId.get(room.roomId) ?? nowMs;
        this.finishedAtMsByRoomId.set(room.roomId, finishedAt);
        if (nowMs - finishedAt >= FINISHED_ROOM_RETENTION_MS) {
          this.roomsById.delete(room.roomId);
          this.roomIdByCode.delete(room.roomCode);
          this.finishedAtMsByRoomId.delete(room.roomId);
        }
        continue;
      }
      if (!room.matchState) {
        continue;
      }

      let changed = false;

      // 1. Check 60s disconnection grace period (§12.2, §21.30)
      for (const color of ['red', 'black'] as const) {
        const p = room.players[color];
        if (
          p &&
          !p.connected &&
          p.disconnectedAtMs !== null &&
          nowMs - p.disconnectedAtMs >= OFFICIAL_RECONNECT_GRACE_MS
        ) {
          room.matchState = forfeitByDisconnectionTimeout(room.matchState, color, nowMs);
          changed = true;
          break;
        }
      }

      // 2. Check preparation timer expiration (§3.2)
      if (
        !changed &&
        room.matchState.phase === 'placement' &&
        room.prepDeadlineMs !== null &&
        nowMs >= room.prepDeadlineMs
      ) {
        room.matchState = finalizePlacementOnTimerExpired(room.matchState, nowMs);
        changed = true;
      }

      // 3. Tick playing clock (§11)
      if (!changed && room.matchState.phase === 'playing') {
        room.matchState = tickMatchClock(room.matchState, nowMs);
        changed = true;
      }

      if (changed) {
        await this.persistIfFinished(room);
        updatedRooms.push(room);
      } else if (room.matchState.phase === 'placement') {
        // Synchronise le compte à rebours de préparation affiché aux deux joueurs
        updatedRooms.push(room);
      }
    }

    return updatedRooms;
  }

  private async persistIfFinished(room: ManagedRoom): Promise<void> {
    this.scheduleSnapshot();
    if (
      !room.matchState ||
      room.matchState.phase !== 'finished' ||
      room.persistedResult ||
      !room.matchState.winner ||
      !room.matchState.outcomeReason
    ) {
      return;
    }

    room.persistedResult = true;
    this.finishedAtMsByRoomId.set(room.roomId, Date.now());
    // Les deux joueurs sont libérés : ils peuvent relancer une recherche immédiatement
    for (const color of ['red', 'black'] as const) {
      const p = room.players[color];
      if (p && this.activeRoomByUserId.get(p.userId) === room.roomId) {
        this.activeRoomByUserId.delete(p.userId);
      }
    }
    const matchRecord = await this.db.recordCompletedMatch({
      matchId: room.roomId,
      mode: room.mode,
      redUserId: room.players.red?.userId ?? null,
      blackUserId: room.players.black?.userId ?? null,
      redUsername: room.players.red?.username ?? 'Joueur Rouge',
      blackUsername: room.players.black?.username ?? 'Joueur Noir',
      redEloBeforeHint: room.players.red?.eloRating,
      blackEloBeforeHint: room.players.black?.eloRating,
      winner: room.matchState.winner,
      outcomeReason: room.matchState.outcomeReason,
      turnsPlayed: room.matchState.turn.turnNumber,
      redEliminations: room.matchState.players.red.totalEliminations,
      blackEliminations: room.matchState.players.black.totalEliminations,
      redNewMechanicsStats:
        room.matchState.players.red.newMechanicsStats ?? createZeroNewMechanicsStats(),
      blackNewMechanicsStats:
        room.matchState.players.black.newMechanicsStats ?? createZeroNewMechanicsStats(),
      ruleset: room.ruleset,
      startedAt: room.startedAtIso ?? new Date().toISOString(),
    });
    room.eloResult = {
      redPrevious: matchRecord.redEloBefore,
      blackPrevious: matchRecord.blackEloBefore,
      redNext: matchRecord.redEloAfter,
      blackNext: matchRecord.blackEloAfter,
      redDelta: matchRecord.redEloAfter - matchRecord.redEloBefore,
      blackDelta: matchRecord.blackEloAfter - matchRecord.blackEloBefore,
    };
    if (room.players.red) {
      room.players.red.eloRating = matchRecord.redEloAfter;
    }
    if (room.players.black) {
      room.players.black.eloRating = matchRecord.blackEloAfter;
    }
  }

  getActiveRoomsCount(): number {
    return [...this.roomsById.values()].filter((r) => r.matchState?.phase !== 'finished').length;
  }
}
