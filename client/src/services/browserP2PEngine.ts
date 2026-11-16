import {
  DEFAULT_USER_PREFERENCES,
  INITIAL_ELO_RATING,
  OFFICIAL_RECONNECT_GRACE_MS,
  OFFICIAL_RULESET_CONFIG,
  computeEloUpdate,
  computeProfileCosmetics,
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
  sanitizeDisplayName,
  sanitizeUserPreferences,
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
  type MatchOutcomeReason,
  type PlacementEntry,
  type PlayerColor,
  type ProfileAchievementId,
  type ProfileBannerId,
  type ProfileTitleId,
  type ServerMatchState,
  type UserPreferences,
} from '../../../shared/src/index.js';
import type { RoomLobbySnapshot } from '../../../server/src/rooms/roomManager.js';
import {
  validateClientAvatarDataUrl,
  type ClientEloHistoryItem,
  type ClientMatchHistoryItem,
  type ClientUserProfile,
  type ProfileUpdatePayload,
} from './apiClient.js';

const MESH_TOPIC = 'blind-war/v1/global-mesh';
const WS_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];
const LOCAL_DB_STORAGE_KEY = 'blind_war_standalone_db_v1';

interface StandaloneStoredUser {
  id: string;
  username: string;
  displayName?: string;
  passwordHash: string;
  avatarBadge: string;
  avatarImage?: string | null;
  bio: string;
  profileBanner?: ProfileBannerId;
  selectedTitle?: ProfileTitleId;
  selectedBadge?: ProfileAchievementId | null;
  preferences?: UserPreferences;
  eloRating: number;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  totalEliminations: number;
  newMechanicsStats?: import('../../../shared/src/index.js').NewMechanicsStats;
  createdAt: string;
  updatedAt: string;
}

interface StandaloneStoredMatch extends ClientMatchHistoryItem {
  redUserId?: string | null;
  blackUserId?: string | null;
}

interface StandaloneDbFormat {
  users: StandaloneStoredUser[];
  matches: StandaloneStoredMatch[];
  eloHistory: ClientEloHistoryItem[];
}

function normalizeUsernameKey(username: string): string {
  return username.trim().replace(/\s+/g, ' ').toLowerCase();
}

function deduplicateStandaloneUsers(users: readonly StandaloneStoredUser[]): StandaloneStoredUser[] {
  const byName = new Map<string, StandaloneStoredUser>();
  for (const u of users) {
    if (!u || typeof u.id !== 'string' || typeof u.username !== 'string') continue;
    const key = normalizeUsernameKey(u.username);
    if (!key) continue;
    const prev = byName.get(key);
    if (!prev || u.gamesPlayed > prev.gamesPlayed) {
      byName.set(key, { ...u, username: u.username.trim().replace(/\s+/g, ' ') });
    }
  }
  return [...byName.values()];
}

function toClientProfile(u: StandaloneStoredUser): ClientUserProfile {
  const winRatePercent =
    u.gamesPlayed > 0 ? Math.round((u.wins / u.gamesPlayed) * 1000) / 10 : 0;
  const stats = {
    ...createZeroNewMechanicsStats(),
    ...(u.newMechanicsStats ?? {}),
  };
  const cosmetics = computeProfileCosmetics({
    wins: u.wins,
    gamesPlayed: u.gamesPlayed,
    eloRating: u.eloRating,
    totalEliminations: u.totalEliminations,
    newMechanicsStats: stats,
  });
  const bannerOk = cosmetics.banners.some((b) => b.id === u.profileBanner && b.unlocked);
  const titleOk = cosmetics.titles.some((t) => t.id === u.selectedTitle && t.unlocked);
  const badgeOk =
    u.selectedBadge !== null &&
    u.selectedBadge !== undefined &&
    cosmetics.badges.some((b) => b.id === u.selectedBadge && b.unlocked);

  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName?.trim() || u.username,
    avatarBadge: u.avatarBadge,
    avatarImage: u.avatarImage ?? null,
    bio: u.bio,
    profileBanner: bannerOk && u.profileBanner ? u.profileBanner : 'classic',
    selectedTitle: titleOk && u.selectedTitle ? u.selectedTitle : 'recrue',
    selectedBadge: badgeOk ? u.selectedBadge ?? null : null,
    preferences: sanitizeUserPreferences(u.preferences ?? DEFAULT_USER_PREFERENCES),
    eloRating: u.eloRating,
    wins: u.wins,
    losses: u.losses,
    draws: u.draws,
    gamesPlayed: u.gamesPlayed,
    winRatePercent,
    totalEliminations: u.totalEliminations,
    newMechanicsStats: stats,
    createdAt: u.createdAt,
  };
}

function randomId(prefix: string = ''): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return prefix ? `${prefix}-${hex}` : hex;
}

function simpleHashPassword(password: string): string {
  // Deterministic lightweight hash for standalone browser accounts
  let h1 = 0xdeadbeef ^ password.length;
  let h2 = 0x41c6ce57 ^ password.length;
  for (let i = 0; i < password.length; i += 1) {
    const ch = password.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `bw:${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

function encodeMqttLen(len: number): Uint8Array {
  const bytes: number[] = [];
  let x = len;
  do {
    let b = x % 128;
    x = Math.floor(x / 128);
    if (x > 0) b |= 128;
    bytes.push(b);
  } while (x > 0);
  return new Uint8Array(bytes);
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((acc, a) => acc + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

function buildMqttConnect(clientId: string): Uint8Array {
  const enc = new TextEncoder();
  const idBytes = enc.encode(clientId);
  const vh = new Uint8Array([0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x04, 0x02, 0x00, 0x3c]);
  const pl = concatBytes(new Uint8Array([0x00, idBytes.length]), idBytes);
  return concatBytes(new Uint8Array([0x10]), encodeMqttLen(vh.length + pl.length), vh, pl);
}

function buildMqttSubscribe(topic: string): Uint8Array {
  const enc = new TextEncoder();
  const tBytes = enc.encode(topic);
  const body = concatBytes(
    new Uint8Array([0x00, 0x01, (tBytes.length >> 8) & 0xff, tBytes.length & 0xff]),
    tBytes,
    new Uint8Array([0x00]),
  );
  return concatBytes(new Uint8Array([0x82]), encodeMqttLen(body.length), body);
}

function buildMqttPublish(topic: string, jsonStr: string): Uint8Array {
  const enc = new TextEncoder();
  const tBytes = enc.encode(topic);
  const pBytes = enc.encode(jsonStr);
  const th = new Uint8Array([(tBytes.length >> 8) & 0xff, tBytes.length & 0xff]);
  const rem = th.length + tBytes.length + pBytes.length;
  return concatBytes(new Uint8Array([0x30]), encodeMqttLen(rem), th, tBytes, pBytes);
}

interface HostedBrowserRoom {
  roomId: string;
  roomCode: string;
  mode: GameMode;
  isPrivateCustom: boolean;
  ruleset: CustomRulesetConfig;
  players: {
    red: { userId: string; username: string; eloRating: number; nodeId: string } | null;
    black: { userId: string; username: string; eloRating: number; nodeId: string } | null;
  };
  matchState: ServerMatchState | null;
  prepDeadlineMs: number | null;
  startedAtIso: string | null;
  persistedResult: boolean;
  eloResult?: EloUpdateResult | null;
}

/**
 * Moteur Autonome & P2P dans le Navigateur :
 * Permet d'ouvrir directement `BLIND-WAR-JOUER.html` d'un simple double-clic (et de l'envoyer
 * à ses amis sans serveur Node ni base de données à installer), tout en synchronisant
 * les comptes, le classement ELO, le matchmaking et les salles personnalisées via WebSocket P2P !
 */
export class BrowserStandaloneNode {
  readonly nodeId = randomId('webnode');
  private db: StandaloneDbFormat = { users: [], matches: [], eloHistory: [] };
  private readonly seenMsgIds = new Set<string>();
  private readonly wsMap = new Map<string, WebSocket>();
  private broadcastChannel: BroadcastChannel | null = null;
  private readonly activePeers = new Map<string, { lastSeenMs: number; queuedCount: number }>();
  private readonly remoteRoomNodeByCode = new Map<string, string>();

  // Local player identity & state
  private myUserId: string = randomId('guest');
  private myUsername: string = 'Commandant';
  private myElo: number = INITIAL_ELO_RATING;
  private myIsGuest: boolean = true;
  private myQueueEntry: {
    mode: 'matchmaking_quick' | 'matchmaking_ranked' | 'matchmaking_unranked';
    joinedAtMs: number;
  } | null = null;

  // Hosted room (if this browser tab is the host) or remote room session
  private hostedRoom: HostedBrowserRoom | null = null;
  private remoteSession: { hostNodeId: string; roomId: string } | null = null;

  private readonly listeners = new Map<string, ((payload: any) => void)[]>();

  constructor() {
    this.loadLocalDb();
    this.startTransports();

    setInterval(() => {
      this.tick();
    }, 1000);
  }

  // --- Database & Auth API (used when Node server is not running) ---

  private loadLocalDb(): void {
    try {
      const raw = localStorage.getItem(LOCAL_DB_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StandaloneDbFormat>;
        this.db = {
          users: deduplicateStandaloneUsers(Array.isArray(parsed.users) ? parsed.users : []),
          matches: Array.isArray(parsed.matches) ? parsed.matches : [],
          eloHistory: Array.isArray(parsed.eloHistory) ? parsed.eloHistory : [],
        };
      }
    } catch {
      this.db = { users: [], matches: [], eloHistory: [] };
    }
  }

  private saveLocalDb(): void {
    try {
      localStorage.setItem(LOCAL_DB_STORAGE_KEY, JSON.stringify(this.db));
    } catch {
      // Ignore quota errors
    }
  }

  register(
    username: string,
    password: string,
    avatarBadge: string = '♔',
  ): { token: string; profile: ClientUserProfile } {
    this.loadLocalDb();
    const clean = username.trim().replace(/\s+/g, ' ');
    if (clean.length < 3 || clean.length > 24) {
      throw new Error('Le nom d’utilisateur doit contenir entre 3 et 24 caractères.');
    }
    if (/\(invit[eé]\)/i.test(clean)) {
      throw new Error('Ce nom d’utilisateur contient une mention réservée.');
    }
    if (password.length < 6) {
      throw new Error('Le mot de passe doit contenir au moins 6 caractères.');
    }
    const existing = this.db.users.find(
      (u) => normalizeUsernameKey(u.username) === normalizeUsernameKey(clean),
    );
    if (existing) {
      throw new Error(
        'Ce nom d’utilisateur est déjà pris. Impossible d’avoir deux comptes avec le même nom.',
      );
    }
    const nowIso = new Date().toISOString();
    const user: StandaloneStoredUser = {
      id: randomId('usr'),
      username: clean,
      displayName: clean,
      passwordHash: simpleHashPassword(password),
      avatarBadge,
      avatarImage: null,
      bio: '',
      profileBanner: 'classic',
      selectedTitle: 'recrue',
      selectedBadge: null,
      preferences: DEFAULT_USER_PREFERENCES,
      eloRating: INITIAL_ELO_RATING,
      wins: 0,
      losses: 0,
      draws: 0,
      gamesPlayed: 0,
      totalEliminations: 0,
      newMechanicsStats: createZeroNewMechanicsStats(),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    this.db.users.push(user);
    this.saveLocalDb();
    this.broadcastDbSync();

    const token = `localtoken:${user.id}:${user.username}`;
    return { token, profile: toClientProfile(user) };
  }

  login(username: string, password: string): { token: string; profile: ClientUserProfile } {
    this.loadLocalDb();
    const clean = username.trim().toLowerCase();
    const user = this.db.users.find((u) => u.username.toLowerCase() === clean);
    if (!user) {
      throw new Error('Utilisateur introuvable.');
    }
    // Accept either standalone hash or allow login if synced from server
    if (
      user.passwordHash.startsWith('bw:') &&
      user.passwordHash !== simpleHashPassword(password)
    ) {
      throw new Error('Mot de passe incorrect.');
    }
    const token = `localtoken:${user.id}:${user.username}`;
    return { token, profile: toClientProfile(user) };
  }

  getUserFromToken(token: string | null): ClientUserProfile | null {
    if (!token) return null;
    this.loadLocalDb();
    if (token.startsWith('localtoken:')) {
      const parts = token.split(':');
      const userId = parts[1];
      const u = this.db.users.find((x) => x.id === userId);
      return u ? toClientProfile(u) : null;
    }
    try {
      const [data] = token.split('.');
      const parsed = JSON.parse(atob(data.replace(/-/g, '+').replace(/_/g, '/'))) as {
        userId?: string;
      };
      if (parsed.userId) {
        const u = this.db.users.find((x) => x.id === parsed.userId);
        return u ? toClientProfile(u) : null;
      }
    } catch {
      // Ignore
    }
    return null;
  }

  updateProfile(
    token: string | null,
    updates: ProfileUpdatePayload,
  ): ClientUserProfile {
    const prof = this.getUserFromToken(token);
    if (!prof) throw new Error('Non authentifié.');
    const idx = this.db.users.findIndex((u) => u.id === prof.id);
    if (idx === -1) throw new Error('Utilisateur introuvable.');
    const cur = this.db.users[idx];
    const cosmetics = computeProfileCosmetics({
      wins: cur.wins,
      gamesPlayed: cur.gamesPlayed,
      eloRating: cur.eloRating,
      totalEliminations: cur.totalEliminations,
      newMechanicsStats: cur.newMechanicsStats,
    });

    const nextDisplayName =
      updates.displayName !== undefined
        ? sanitizeDisplayName(updates.displayName) ?? cur.displayName ?? cur.username
        : cur.displayName ?? cur.username;

    let nextAvatarImage = cur.avatarImage ?? null;
    if (updates.removeAvatarImage === true || updates.avatarImage === null) {
      nextAvatarImage = null;
    } else if (typeof updates.avatarImage === 'string' && updates.avatarImage.trim()) {
      nextAvatarImage = validateClientAvatarDataUrl(updates.avatarImage);
    }

    let nextBanner = cur.profileBanner ?? 'classic';
    if (updates.profileBanner !== undefined) {
      const found = cosmetics.banners.find((b) => b.id === updates.profileBanner);
      if (!found || !found.unlocked) {
        throw new Error('Cette bannière n’est pas encore débloquée.');
      }
      nextBanner = found.id;
    }

    let nextTitle = cur.selectedTitle ?? 'recrue';
    if (updates.selectedTitle !== undefined) {
      const found = cosmetics.titles.find((t) => t.id === updates.selectedTitle);
      if (!found || !found.unlocked) {
        throw new Error('Ce titre n’est pas encore débloqué.');
      }
      nextTitle = found.id;
    }

    let nextBadge = cur.selectedBadge ?? null;
    if (updates.selectedBadge !== undefined) {
      if (updates.selectedBadge === null) {
        nextBadge = null;
      } else {
        const found = cosmetics.badges.find((b) => b.id === updates.selectedBadge);
        if (!found || !found.unlocked) {
          throw new Error('Ce badge n’est pas encore débloqué.');
        }
        nextBadge = found.id;
      }
    }

    const nextPrefs = updates.preferences
      ? sanitizeUserPreferences({
          ...(cur.preferences ?? DEFAULT_USER_PREFERENCES),
          ...updates.preferences,
        })
      : sanitizeUserPreferences(cur.preferences ?? DEFAULT_USER_PREFERENCES);

    this.db.users[idx] = {
      ...cur,
      displayName: nextDisplayName,
      avatarBadge: updates.avatarBadge ?? cur.avatarBadge,
      avatarImage: nextAvatarImage,
      bio: updates.bio ?? cur.bio,
      profileBanner: nextBanner,
      selectedTitle: nextTitle,
      selectedBadge: nextBadge,
      preferences: nextPrefs,
      updatedAt: new Date().toISOString(),
    };
    this.saveLocalDb();
    this.broadcastDbSync();
    return toClientProfile(this.db.users[idx]);
  }

  getLeaderboard(): ClientUserProfile[] {
    this.loadLocalDb();
    return [...this.db.users]
      .sort((a, b) => (b.eloRating !== a.eloRating ? b.eloRating - a.eloRating : b.wins - a.wins))
      .map((u) => {
        const { preferences: _prefs, ...pub } = toClientProfile(u);
        return pub;
      });
  }

  getMatches(userId?: string): ClientMatchHistoryItem[] {
    this.loadLocalDb();
    return userId
      ? this.db.matches.filter((m) => m.redUserId === userId || m.blackUserId === userId)
      : this.db.matches;
  }

  getEloHistory(userId: string): ClientEloHistoryItem[] {
    this.loadLocalDb();
    return this.db.eloHistory.filter((e) => e.userId === userId);
  }

  // --- Socket-like Interface for App.tsx ---

  configureIdentity(params: { token?: string | null; guestId: string; username: string }): void {
    const prof = this.getUserFromToken(params.token ?? null);
    if (prof) {
      this.myUserId = prof.id;
      this.myUsername = prof.username;
      this.myElo = prof.eloRating;
      this.myIsGuest = false;
      this.emitToClient('session:identity', {
        userId: prof.id,
        username: prof.username,
        isGuest: false,
      });
    } else {
      this.myUserId = `guest-${params.guestId}`;
      this.myUsername = `${params.username} (invité)`;
      this.myElo = INITIAL_ELO_RATING;
      this.myIsGuest = true;
      if (this.myQueueEntry?.mode === 'matchmaking_ranked') {
        this.myQueueEntry = null;
      }
      this.emitToClient('session:identity', {
        userId: this.myUserId,
        username: this.myUsername,
        isGuest: true,
      });
    }
    this.emitToClient('connect', {});
    this.emitP2PStatus();
  }

  on(event: string, cb: (payload: any) => void): void {
    const arr = this.listeners.get(event) ?? [];
    arr.push(cb);
    this.listeners.set(event, arr);
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }

  emit(event: string, payload?: any, ack?: (res: any) => void): void {
    try {
      switch (event) {
        case 'matchmaking:join': {
          const mode = payload.mode as
            | 'matchmaking_quick'
            | 'matchmaking_ranked'
            | 'matchmaking_unranked';
          if (
            mode === 'matchmaking_ranked' &&
            (this.myIsGuest || this.myUserId.startsWith('guest-'))
          ) {
            ack?.({
              ok: false,
              error:
                'Compte requis : inscrivez-vous ou connectez-vous pour jouer en Matchmaking Classé.',
            });
            return;
          }
          this.myQueueEntry = { mode, joinedAtMs: Date.now() };
          this.sendHeartbeat();
          ack?.({ ok: true, matched: false });
          break;
        }
        case 'matchmaking:leave': {
          this.myQueueEntry = null;
          ack?.({ ok: true });
          break;
        }
        case 'room:create': {
          const ruleset: CustomRulesetConfig = {
            ...OFFICIAL_RULESET_CONFIG,
            ...(payload?.ruleset ?? {}),
          };
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          let code = 'BW-';
          for (let i = 0; i < 4; i += 1) {
            code += chars[Math.floor(Math.random() * chars.length)];
          }
          this.hostedRoom = {
            roomId: randomId('room'),
            roomCode: code,
            mode: 'online_custom',
            isPrivateCustom: true,
            ruleset,
            players: {
              red: {
                userId: this.myUserId,
                username: this.myUsername,
                eloRating: this.myElo,
                nodeId: this.nodeId,
              },
              black: null,
            },
            matchState: null,
            prepDeadlineMs: null,
            startedAtIso: null,
            persistedResult: false,
          };
          this.syncHostedRoom();
          this.sendHeartbeat();
          ack?.({ ok: true, roomCode: code, roomId: this.hostedRoom.roomId });
          break;
        }
        case 'room:join': {
          const code = String(payload?.roomCode ?? '').trim().toUpperCase();
          const hostNodeId = this.remoteRoomNodeByCode.get(code);
          if (!hostNodeId) {
            ack?.({ ok: false, error: `Code de salle introuvable (${code}). Assurez-vous que votre ami a créé la salle.` });
            return;
          }
          this.publish({
            type: 'p2p_custom_join',
            msgId: randomId('msg'),
            senderNodeId: this.nodeId,
            targetNodeId: hostNodeId,
            roomCode: code,
            guest: {
              userId: this.myUserId,
              username: this.myUsername,
              eloRating: this.myElo,
            },
          });
          ack?.({ ok: true });
          break;
        }
        case 'room:start': {
          if (this.hostedRoom && this.hostedRoom.players.red && this.hostedRoom.players.black) {
            const nowMs = Date.now();
            this.hostedRoom.matchState = createMatchState(
              this.hostedRoom.roomId,
              this.hostedRoom.mode,
              this.hostedRoom.ruleset,
            );
            this.hostedRoom.prepDeadlineMs =
              nowMs + this.hostedRoom.ruleset.prepDurationSeconds * 1000;
            this.hostedRoom.startedAtIso = new Date(nowMs).toISOString();
            this.syncHostedRoom();
            ack?.({ ok: true });
          }
          break;
        }
        case 'room:leave': {
          if (this.remoteSession) {
            this.sendRemoteAction({ kind: 'leave_room' });
            this.remoteSession = null;
          }
          this.hostedRoom = null;
          ack?.({ ok: true });
          break;
        }
        case 'game:place':
          this.handleGameAction({ kind: 'place', entries: payload.entries }, ack);
          break;
        case 'game:move':
          this.handleGameAction(
            {
              kind: 'move',
              pieceId: payload.pieceId,
              destination: payload.destination,
              preferredKind: payload.preferredKind,
            },
            ack,
          );
          break;
        case 'game:mark_traqueur':
          this.handleGameAction(
            {
              kind: 'mark_traqueur',
              traqueurPieceId: payload.traqueurPieceId,
              targetEnemyPieceId: payload.targetEnemyPieceId,
            },
            ack,
          );
          break;
        case 'game:stop_jump':
          this.handleGameAction({ kind: 'stop_jump' }, ack);
          break;
        case 'game:skip_rage':
          this.handleGameAction({ kind: 'skip_rage' }, ack);
          break;
        case 'game:promote':
          this.handleGameAction(
            { kind: 'promote', chosenCharacter: payload.chosenCharacter },
            ack,
          );
          break;
        case 'game:play_card':
          this.handleGameAction({ kind: 'play_card', cardPayload: payload.cardPayload }, ack);
          break;
        case 'game:draw_offer':
          this.handleGameAction({ kind: 'draw_offer' }, ack);
          break;
        case 'game:resign':
          this.handleGameAction({ kind: 'resign' }, ack);
          break;
      }
    } catch (err) {
      ack?.({ ok: false, error: err instanceof Error ? err.message : 'Erreur action' });
    }
  }

  private handleGameAction(action: any, ack?: (res: any) => void): void {
    if (this.remoteSession) {
      this.sendRemoteAction(action);
      ack?.({ ok: true });
      return;
    }
    if (this.hostedRoom) {
      this.applyActionOnHostedRoom(this.myUserId, action);
      ack?.({ ok: true });
    }
  }

  private sendRemoteAction(action: any): void {
    if (!this.remoteSession) return;
    this.publish({
      type: 'p2p_game_action',
      msgId: randomId('msg'),
      senderNodeId: this.nodeId,
      targetNodeId: this.remoteSession.hostNodeId,
      roomId: this.remoteSession.roomId,
      actorUserId: this.myUserId,
      action,
    });
  }

  private applyActionOnHostedRoom(actorUserId: string, action: any): void {
    if (!this.hostedRoom || !this.hostedRoom.matchState) return;
    const color: PlayerColor | null =
      this.hostedRoom.players.red?.userId === actorUserId
        ? 'red'
        : this.hostedRoom.players.black?.userId === actorUserId
          ? 'black'
          : null;
    if (!color) return;

    const nowMs = Date.now();
    const st = this.hostedRoom.matchState;
    switch (action.kind) {
      case 'place':
        this.hostedRoom.matchState = submitPlayerPlacement(st, color, action.entries, nowMs);
        break;
      case 'move':
        this.hostedRoom.matchState = executePieceMove(
          st,
          color,
          action.pieceId,
          action.destination,
          nowMs,
          undefined,
          action.preferredKind,
        );
        break;
      case 'mark_traqueur':
        this.hostedRoom.matchState = markTraqueurTarget(
          st,
          color,
          action.traqueurPieceId,
          action.targetEnemyPieceId,
          nowMs,
        );
        break;
      case 'stop_jump':
        this.hostedRoom.matchState = stopCavalierJumpChain(st, color, nowMs);
        break;
      case 'skip_rage':
        this.hostedRoom.matchState = skipBerserkerRageMove(st, color, nowMs);
        break;
      case 'promote':
        this.hostedRoom.matchState = selectSoldierPromotion(
          st,
          color,
          action.chosenCharacter,
          nowMs,
        );
        break;
      case 'play_card':
        this.hostedRoom.matchState = playCard(st, color, action.cardPayload, nowMs);
        break;
      case 'draw_offer':
        this.hostedRoom.matchState = proposeOrAcceptMutualDraw(st, color, nowMs);
        break;
      case 'resign':
        this.hostedRoom.matchState = resignMatch(st, color, nowMs);
        break;
    }
    this.checkPersistHostedFinish();
    this.syncHostedRoom();
  }

  private checkPersistHostedFinish(): void {
    const r = this.hostedRoom;
    if (
      !r ||
      !r.matchState ||
      r.matchState.phase !== 'finished' ||
      r.persistedResult ||
      !r.matchState.winner ||
      !r.matchState.outcomeReason
    ) {
      return;
    }
    r.persistedResult = true;
    this.loadLocalDb();

    const redId = r.players.red?.userId ?? null;
    const blackId = r.players.black?.userId ?? null;
    const redUser =
      this.db.users.find(
        (u) =>
          u.id === redId ||
          (r.players.red?.username &&
            normalizeUsernameKey(u.username) === normalizeUsernameKey(r.players.red.username)),
      ) ?? null;
    const blackUser =
      this.db.users.find(
        (u) =>
          u.id === blackId ||
          (r.players.black?.username &&
            normalizeUsernameKey(u.username) === normalizeUsernameKey(r.players.black.username)),
      ) ?? null;
    const redBefore = redUser?.eloRating ?? r.players.red?.eloRating ?? INITIAL_ELO_RATING;
    const blackBefore = blackUser?.eloRating ?? r.players.black?.eloRating ?? INITIAL_ELO_RATING;
    const eloRes = computeEloUpdate(r.mode, redBefore, blackBefore, r.matchState.winner);
    r.eloResult = eloRes;
    if (r.players.red) r.players.red.eloRating = eloRes.redNext;
    if (r.players.black) r.players.black.eloRating = eloRes.blackNext;
    if (this.myUserId === redId) this.myElo = eloRes.redNext;
    if (this.myUserId === blackId) this.myElo = eloRes.blackNext;
    const endedAt = new Date().toISOString();

    const redMech =
      r.matchState.players.red.newMechanicsStats ?? createZeroNewMechanicsStats();
    const blackMech =
      r.matchState.players.black.newMechanicsStats ?? createZeroNewMechanicsStats();

    this.db.matches.unshift({
      id: r.roomId,
      mode: r.mode,
      redUserId: redId,
      blackUserId: blackId,
      redUsername: r.players.red?.username ?? 'Rouge',
      blackUsername: r.players.black?.username ?? 'Noir',
      winner: r.matchState.winner,
      outcomeReason: r.matchState.outcomeReason as MatchOutcomeReason,
      redEloBefore: redBefore,
      blackEloBefore: blackBefore,
      redEloAfter: eloRes.redNext,
      blackEloAfter: eloRes.blackNext,
      turnsPlayed: r.matchState.turn.turnNumber,
      redNewMechanicsStats: redMech,
      blackNewMechanicsStats: blackMech,
      ruleset: r.ruleset,
      startedAt: r.startedAtIso ?? endedAt,
      endedAt,
    });

    const updatePlayer = (
      u: StandaloneStoredUser | null,
      c: PlayerColor,
      after: number,
      before: number,
      delta: number,
      elims: number,
      mech: import('../../../shared/src/index.js').NewMechanicsStats,
    ) => {
      if (!u) return;
      const prevMech = {
        ...createZeroNewMechanicsStats(),
        ...(u.newMechanicsStats ?? {}),
      };
      u.eloRating = after;
      if (r.matchState!.winner === c) u.wins += 1;
      else if (r.matchState!.winner === 'draw') u.draws += 1;
      else u.losses += 1;
      u.gamesPlayed += 1;
      u.totalEliminations += elims;
      u.newMechanicsStats = {
        traqueurMoves: prevMech.traqueurMoves + mech.traqueurMoves,
        traqueurMarks: prevMech.traqueurMarks + mech.traqueurMarks,
        traqueurPursuitsSucceeded:
          prevMech.traqueurPursuitsSucceeded + mech.traqueurPursuitsSucceeded,
        traqueurEliminations: prevMech.traqueurEliminations + mech.traqueurEliminations,
        executeurPiercingStrikes:
          prevMech.executeurPiercingStrikes + mech.executeurPiercingStrikes,
        executeurEliminations: prevMech.executeurEliminations + mech.executeurEliminations,
        arbaletrierShotsTotal: prevMech.arbaletrierShotsTotal + mech.arbaletrierShotsTotal,
        arbaletrierShotsSucceeded:
          prevMech.arbaletrierShotsSucceeded + mech.arbaletrierShotsSucceeded,
        arbaletrierShotsBlocked: prevMech.arbaletrierShotsBlocked + mech.arbaletrierShotsBlocked,
        colossiEliminatedByKamikaze:
          prevMech.colossiEliminatedByKamikaze + mech.colossiEliminatedByKamikaze,
      };
      u.updatedAt = endedAt;
      if (r.mode === 'matchmaking_ranked') {
        this.db.eloHistory.unshift({
          id: this.db.eloHistory.length + 1,
          userId: u.id,
          matchId: r.roomId,
          eloBefore: before,
          eloAfter: after,
          delta,
          recordedAt: endedAt,
        });
      }
    };

    updatePlayer(
      redUser,
      'red',
      eloRes.redNext,
      redBefore,
      eloRes.redDelta,
      r.matchState.players.red.totalEliminations,
      redMech,
    );
    updatePlayer(
      blackUser,
      'black',
      eloRes.blackNext,
      blackBefore,
      eloRes.blackDelta,
      r.matchState.players.black.totalEliminations,
      blackMech,
    );

    this.saveLocalDb();
    this.broadcastDbSync();
  }

  private buildLobbySnapshot(r: HostedBrowserRoom, nowMs: number = Date.now()): RoomLobbySnapshot {
    const prepRemainingSeconds =
      r.matchState?.phase === 'placement' && r.prepDeadlineMs !== null
        ? Math.max(0, Math.ceil((r.prepDeadlineMs - nowMs) / 1000))
        : null;
    return {
      roomId: r.roomId,
      roomCode: r.roomCode,
      mode: r.mode,
      isPrivateCustom: r.isPrivateCustom,
      ruleset: r.ruleset,
      redPlayer: r.players.red
        ? {
            userId: r.players.red.userId,
            username: r.players.red.username,
            eloRating: r.players.red.eloRating,
            ready: true,
            connected: true,
          }
        : null,
      blackPlayer: r.players.black
        ? {
            userId: r.players.black.userId,
            username: r.players.black.username,
            eloRating: r.players.black.eloRating,
            ready: true,
            connected: true,
          }
        : null,
      matchStarted: r.matchState !== null,
      prepRemainingSeconds,
      eloResult: r.eloResult ?? null,
    };
  }

  private syncHostedRoom(): void {
    const r = this.hostedRoom;
    if (!r) return;
    const lobby = this.buildLobbySnapshot(r);
    for (const color of ['red', 'black'] as const) {
      const p = r.players[color];
      if (!p) continue;
      const view = r.matchState ? projectMatchStateForViewer(r.matchState, color) : null;
      if (p.nodeId === this.nodeId) {
        this.emitToClient('room:lobby_sync', lobby);
        if (view) this.emitToClient('game:state_sync', view);
      } else {
        this.publish({
          type: 'p2p_state_push',
          msgId: randomId('msg'),
          senderNodeId: this.nodeId,
          targetNodeId: p.nodeId,
          targetUserId: p.userId,
          roomId: r.roomId,
          lobby,
          view,
        });
      }
    }
  }

  private emitToClient(event: string, payload: any): void {
    const arr = this.listeners.get(event);
    if (!arr) return;
    for (const cb of arr) {
      cb(payload);
    }
  }

  private emitP2PStatus(): void {
    const nowMs = Date.now();
    let knownPeersCount = 0;
    let remotePlayersInQueue = 0;
    for (const [peerId, info] of this.activePeers.entries()) {
      if (nowMs - info.lastSeenMs <= 20_000) {
        knownPeersCount += 1;
        remotePlayersInQueue += info.queuedCount;
      } else {
        this.activePeers.delete(peerId);
      }
    }
    this.emitToClient('p2p:status', {
      nodeId: this.nodeId,
      connectedRelays: this.wsMap.size,
      knownPeersCount,
      remotePlayersInQueue,
    });
  }

  private tick(): void {
    const nowMs = Date.now();
    this.sendHeartbeat();
    this.emitP2PStatus();

    if (this.myQueueEntry) {
      const waitedSec = Math.max(0, Math.floor((nowMs - this.myQueueEntry.joinedAtMs) / 1000));
      const eloWindow =
        this.myQueueEntry.mode === 'matchmaking_ranked'
          ? Math.min(1000, 100 + Math.floor(waitedSec / 10) * 50)
          : null;
      this.emitToClient('matchmaking:status', {
        mode: this.myQueueEntry.mode,
        waitingSeconds: waitedSec,
        playersInQueue: 1,
        eloWindow,
      });
    }

    if (this.hostedRoom && this.hostedRoom.matchState && this.hostedRoom.matchState.phase !== 'finished') {
      if (
        this.hostedRoom.matchState.phase === 'placement' &&
        this.hostedRoom.prepDeadlineMs !== null &&
        nowMs >= this.hostedRoom.prepDeadlineMs
      ) {
        this.hostedRoom.matchState = finalizePlacementOnTimerExpired(
          this.hostedRoom.matchState,
          nowMs,
        );
      } else if (this.hostedRoom.matchState.phase === 'playing') {
        this.hostedRoom.matchState = tickMatchClock(this.hostedRoom.matchState, nowMs);
      }
      this.checkPersistHostedFinish();
      this.syncHostedRoom();
    }
  }

  private sendHeartbeat(): void {
    const candidates = this.myQueueEntry
      ? [
          {
            userId: this.myUserId,
            username: this.myUsername,
            eloRating: this.myElo,
            mode: this.myQueueEntry.mode,
            joinedAtMs: this.myQueueEntry.joinedAtMs,
          },
        ]
      : [];
    const customRoomCodes =
      this.hostedRoom &&
      this.hostedRoom.isPrivateCustom &&
      !this.hostedRoom.matchState &&
      !this.hostedRoom.players.black
        ? [this.hostedRoom.roomCode]
        : [];

    this.publish({
      type: 'queue_heartbeat',
      msgId: randomId('msg'),
      senderNodeId: this.nodeId,
      candidates,
      customRoomCodes,
    });
  }

  private broadcastDbSync(): void {
    this.loadLocalDb();
    const publicUsers = this.db.users.map(({ preferences: _prefs, ...u }) => u);
    this.publish({
      type: 'db_sync',
      msgId: randomId('msg'),
      senderNodeId: this.nodeId,
      snapshot: {
        users: publicUsers,
        matches: this.db.matches,
        eloHistory: this.db.eloHistory,
      },
    });
  }

  private publish(packet: any): void {
    this.seenMsgIds.add(packet.msgId);
    const json = JSON.stringify(packet);
    const frame = buildMqttPublish(MESH_TOPIC, json);
    for (const ws of this.wsMap.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(frame);
      }
    }
    try {
      this.broadcastChannel?.postMessage(json);
    } catch {
      // Ignore
    }
  }

  private handleIncomingJson(rawJson: string): void {
    let packet: any;
    try {
      packet = JSON.parse(rawJson);
    } catch {
      return;
    }
    if (!packet || !packet.msgId || !packet.senderNodeId || packet.senderNodeId === this.nodeId) {
      return;
    }
    if (this.seenMsgIds.has(packet.msgId)) return;
    this.seenMsgIds.add(packet.msgId);

    const nowMs = Date.now();
    const prev = this.activePeers.get(packet.senderNodeId);
    this.activePeers.set(packet.senderNodeId, {
      lastSeenMs: nowMs,
      queuedCount: prev?.queuedCount ?? 0,
    });

    switch (packet.type) {
      case 'sync_request':
        this.broadcastDbSync();
        break;

      case 'db_sync': {
        this.loadLocalDb();
        let changed = false;
        if (Array.isArray(packet.snapshot?.users)) {
          for (const ru of packet.snapshot.users) {
            if (!ru || typeof ru.id !== 'string' || typeof ru.username !== 'string') continue;
            const ruKey = normalizeUsernameKey(ru.username);
            if (!ruKey) continue;
            const idx = this.db.users.findIndex(
              (u) => u.id === ru.id || normalizeUsernameKey(u.username) === ruKey,
            );
            if (idx === -1) {
              this.db.users.push({ ...ru, username: ru.username.trim().replace(/\s+/g, ' ') });
              changed = true;
            } else if (
              ru.gamesPlayed > this.db.users[idx].gamesPlayed ||
              new Date(ru.updatedAt).getTime() > new Date(this.db.users[idx].updatedAt).getTime()
            ) {
              const cur = this.db.users[idx];
              this.db.users[idx] = {
                ...cur,
                ...ru,
                id: cur.id,
                username: cur.username,
                preferences: cur.preferences ?? DEFAULT_USER_PREFERENCES,
              };
              changed = true;
            }
          }
          const deduped = deduplicateStandaloneUsers(this.db.users);
          if (deduped.length !== this.db.users.length) {
            this.db.users = deduped;
            changed = true;
          }
        }
        if (Array.isArray(packet.snapshot?.matches)) {
          for (const rm of packet.snapshot.matches) {
            if (!this.db.matches.some((m) => m.id === rm.id)) {
              this.db.matches.push(rm);
              changed = true;
            }
          }
        }
        if (changed) this.saveLocalDb();
        break;
      }

      case 'queue_heartbeat': {
        this.activePeers.set(packet.senderNodeId, {
          lastSeenMs: nowMs,
          queuedCount: Array.isArray(packet.candidates) ? packet.candidates.length : 0,
        });
        if (Array.isArray(packet.customRoomCodes)) {
          for (const code of packet.customRoomCodes) {
            this.remoteRoomNodeByCode.set(code, packet.senderNodeId);
          }
        }
        if (this.myQueueEntry && Array.isArray(packet.candidates)) {
          for (const rem of packet.candidates) {
            if (rem.mode === this.myQueueEntry.mode && rem.userId !== this.myUserId) {
              if (
                this.myQueueEntry.mode === 'matchmaking_ranked' &&
                (this.myIsGuest ||
                  this.myUserId.startsWith('guest-') ||
                  rem.userId.startsWith('guest-'))
              ) {
                continue;
              }
              const localIsHost =
                this.myQueueEntry.joinedAtMs < rem.joinedAtMs ||
                (this.myQueueEntry.joinedAtMs === rem.joinedAtMs &&
                  this.nodeId < packet.senderNodeId);
              if (localIsHost) {
                const mode = this.myQueueEntry.mode;
                this.myQueueEntry = null;
                const roomId = randomId('mm');
                this.hostedRoom = {
                  roomId,
                  roomCode: 'BW-AUTO',
                  mode,
                  isPrivateCustom: false,
                  ruleset: OFFICIAL_RULESET_CONFIG,
                  players: {
                    red: {
                      userId: this.myUserId,
                      username: this.myUsername,
                      eloRating: this.myElo,
                      nodeId: this.nodeId,
                    },
                    black: {
                      userId: rem.userId,
                      username: rem.username,
                      eloRating: rem.eloRating,
                      nodeId: packet.senderNodeId,
                    },
                  },
                  matchState: createMatchState(roomId, mode, OFFICIAL_RULESET_CONFIG),
                  prepDeadlineMs: nowMs + OFFICIAL_RULESET_CONFIG.prepDurationSeconds * 1000,
                  startedAtIso: new Date(nowMs).toISOString(),
                  persistedResult: false,
                };
                this.syncHostedRoom();
                break;
              }
            }
          }
        }
        break;
      }

      case 'p2p_state_push': {
        if (packet.targetNodeId !== this.nodeId && packet.targetUserId !== this.myUserId) return;
        this.myQueueEntry = null;
        if (packet.view?.phase === 'finished') {
          this.remoteSession = null;
          if (packet.view.winner && packet.view.outcomeReason && packet.lobby) {
            this.loadLocalDb();
            if (!this.db.matches.some((m) => m.id === packet.roomId)) {
              const redBefore =
                packet.lobby.eloResult?.redPrevious ??
                packet.lobby.redPlayer?.eloRating ??
                INITIAL_ELO_RATING;
              const blackBefore =
                packet.lobby.eloResult?.blackPrevious ??
                packet.lobby.blackPlayer?.eloRating ??
                INITIAL_ELO_RATING;
              const eloRes =
                packet.lobby.eloResult ??
                computeEloUpdate(packet.lobby.mode, redBefore, blackBefore, packet.view.winner);
              const endedAt = new Date().toISOString();
              this.db.matches.unshift({
                id: packet.roomId,
                mode: packet.lobby.mode,
                redUserId: packet.lobby.redPlayer?.userId ?? null,
                blackUserId: packet.lobby.blackPlayer?.userId ?? null,
                redUsername: packet.lobby.redPlayer?.username ?? 'Rouge',
                blackUsername: packet.lobby.blackPlayer?.username ?? 'Noir',
                winner: packet.view.winner,
                outcomeReason: packet.view.outcomeReason,
                redEloBefore: redBefore,
                blackEloBefore: blackBefore,
                redEloAfter: eloRes.redNext,
                blackEloAfter: eloRes.blackNext,
                turnsPlayed: packet.view.turn.turnNumber,
                ruleset: packet.lobby.ruleset,
                startedAt: endedAt,
                endedAt,
              });
              const localUser = this.db.users.find((u) => u.id === this.myUserId);
              if (localUser) {
                const isRed = packet.lobby.redPlayer?.userId === this.myUserId;
                const before = isRed ? redBefore : blackBefore;
                const after = isRed ? eloRes.redNext : eloRes.blackNext;
                const delta = isRed ? eloRes.redDelta : eloRes.blackDelta;
                const myColor: PlayerColor = isRed ? 'red' : 'black';
                localUser.eloRating = after;
                this.myElo = after;
                if (packet.view.winner === myColor) localUser.wins += 1;
                else if (packet.view.winner === 'draw') localUser.draws += 1;
                else localUser.losses += 1;
                localUser.gamesPlayed += 1;
                localUser.updatedAt = endedAt;
                if (packet.lobby.mode === 'matchmaking_ranked') {
                  this.db.eloHistory.unshift({
                    id: this.db.eloHistory.length + 1,
                    userId: localUser.id,
                    matchId: packet.roomId,
                    eloBefore: before,
                    eloAfter: after,
                    delta,
                    recordedAt: endedAt,
                  });
                }
              }
              this.saveLocalDb();
            }
          }
        } else {
          this.remoteSession = {
            hostNodeId: packet.senderNodeId,
            roomId: packet.roomId,
          };
        }
        this.emitToClient('room:lobby_sync', packet.lobby);
        if (packet.view) {
          this.emitToClient('game:state_sync', packet.view);
        }
        break;
      }

      case 'p2p_custom_join': {
        if (packet.targetNodeId !== this.nodeId || !this.hostedRoom) return;
        if (!this.hostedRoom.players.black) {
          this.hostedRoom.players.black = {
            userId: packet.guest.userId,
            username: packet.guest.username,
            eloRating: packet.guest.eloRating,
            nodeId: packet.senderNodeId,
          };
          this.syncHostedRoom();
        }
        break;
      }

      case 'p2p_game_action': {
        if (packet.targetNodeId !== this.nodeId) return;
        this.applyActionOnHostedRoom(packet.actorUserId, packet.action);
        break;
      }
    }
  }

  private startTransports(): void {
    try {
      this.broadcastChannel = new BroadcastChannel('blind-war-local-bus');
      this.broadcastChannel.onmessage = (ev) => {
        if (typeof ev.data === 'string') {
          this.handleIncomingJson(ev.data);
        }
      };
    } catch {
      // BroadcastChannel unsupported
    }

    for (const url of WS_BROKERS) {
      this.connectWsBroker(url);
    }
  }

  private connectWsBroker(url: string): void {
    try {
      const ws = new WebSocket(url, 'mqtt');
      ws.binaryType = 'arraybuffer';
      let rx: Uint8Array = new Uint8Array(0);

      ws.onopen = () => {
        ws.send(buildMqttConnect(`bw-${this.nodeId}-${Math.random().toString(16).slice(2, 6)}`));
      };

      ws.onmessage = (ev) => {
        const chunk = new Uint8Array(ev.data as ArrayBuffer);
        rx = concatBytes(rx, chunk);
        while (rx.length >= 2) {
          const packetType = rx[0] >> 4;
          let mult = 1;
          let remLen = 0;
          let offset = 1;
          let b = 0;
          do {
            if (offset >= rx.length) return;
            b = rx[offset];
            remLen += (b & 127) * mult;
            mult *= 128;
            offset += 1;
          } while ((b & 128) !== 0);

          const total = offset + remLen;
          if (rx.length < total) return;

          const frame = rx.subarray(0, total);
          rx = rx.subarray(total);

          if (packetType === 2) {
            this.wsMap.set(url, ws);
            ws.send(buildMqttSubscribe(MESH_TOPIC));
            this.publish({
              type: 'sync_request',
              msgId: randomId('msg'),
              senderNodeId: this.nodeId,
            });
            this.broadcastDbSync();
            this.emitP2PStatus();
          } else if (packetType === 3) {
            const tLen = (frame[offset] << 8) | frame[offset + 1];
            const payloadBytes = frame.subarray(offset + 2 + tLen, total);
            const jsonStr = new TextDecoder().decode(payloadBytes);
            this.handleIncomingJson(jsonStr);
          }
        }
      };

      ws.onclose = () => {
        this.wsMap.delete(url);
        this.emitP2PStatus();
        setTimeout(() => this.connectWsBroker(url), 5000);
      };
    } catch {
      // Ignore
    }
  }
}

let singletonStandaloneNode: BrowserStandaloneNode | null = null;

export function getBrowserStandaloneNode(): BrowserStandaloneNode {
  if (!singletonStandaloneNode) {
    singletonStandaloneNode = new BrowserStandaloneNode();
  }
  return singletonStandaloneNode;
}
