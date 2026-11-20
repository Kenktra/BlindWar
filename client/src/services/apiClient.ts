import {
  DEFAULT_USER_PREFERENCES,
  sanitizeUserPreferences,
  type AccountStatus,
  type AdminAuditLogEntry,
  type ClientNotificationItem,
  type CustomRulesetConfig,
  type GameMode,
  type MatchOutcomeReason,
  type NewMechanicsStats,
  type NotificationCategory,
  type PlayerColor,
  type ProfileAchievementId,
  type ProfileBannerId,
  type ProfileTitleId,
  type UserPreferences,
  type UserRole,
} from '../../../shared/src/index.js';
import { getBrowserStandaloneNode } from './browserP2PEngine.js';

export function isStandaloneFileMode(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'file:';
}

export interface ClientUserProfile {
  readonly id: string;
  readonly username: string;
  readonly displayName?: string;
  readonly avatarBadge: string;
  readonly avatarImage?: string | null;
  readonly bio: string;
  readonly profileBanner?: ProfileBannerId;
  readonly selectedTitle?: ProfileTitleId;
  readonly selectedBadge?: ProfileAchievementId | null;
  readonly preferences?: UserPreferences;
  readonly role?: UserRole;
  readonly accountStatus?: AccountStatus;
  readonly suspendedReason?: string | null;
  readonly suspendedAt?: string | null;
  readonly eloRating: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly gamesPlayed: number;
  readonly winRatePercent: number;
  readonly totalEliminations: number;
  readonly newMechanicsStats?: NewMechanicsStats;
  readonly createdAt: string;
}

export interface ClientMatchHistoryItem {
  readonly id: string;
  readonly mode: GameMode;
  readonly redUsername: string;
  readonly blackUsername: string;
  readonly winner: PlayerColor | 'draw' | null;
  readonly outcomeReason: MatchOutcomeReason | null;
  readonly redEloBefore: number;
  readonly blackEloBefore: number;
  readonly redEloAfter: number;
  readonly blackEloAfter: number;
  readonly turnsPlayed: number;
  readonly redNewMechanicsStats?: NewMechanicsStats;
  readonly blackNewMechanicsStats?: NewMechanicsStats;
  readonly ruleset: CustomRulesetConfig;
  readonly startedAt: string;
  readonly endedAt: string;
}

export interface ClientEloHistoryItem {
  readonly id: number;
  readonly userId: string;
  readonly matchId: string;
  readonly eloBefore: number;
  readonly eloAfter: number;
  readonly delta: number;
  readonly recordedAt: string;
}

export type UserSettings = UserPreferences;

const TOKEN_STORAGE_KEY = 'blind_war_auth_token';
const SETTINGS_STORAGE_KEY = 'blind_war_user_settings';
const NOTIFICATIONS_STORAGE_KEY = 'blind_war_notifications_v1';

export const DEFAULT_USER_SETTINGS: UserSettings = DEFAULT_USER_PREFERENCES;

function settingsKeyForAccount(accountId?: string | null): string {
  return accountId ? `${SETTINGS_STORAGE_KEY}__${accountId}` : SETTINGS_STORAGE_KEY;
}

export function loadUserSettings(accountId?: string | null): UserSettings {
  try {
    const specific = accountId ? localStorage.getItem(settingsKeyForAccount(accountId)) : null;
    const raw = specific ?? localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_USER_SETTINGS;
    return sanitizeUserPreferences(JSON.parse(raw) as Partial<UserSettings>);
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}

export function saveUserSettings(settings: UserSettings, accountId?: string | null): UserSettings {
  const sanitized = sanitizeUserPreferences(settings);
  try {
    const serialized = JSON.stringify(sanitized);
    localStorage.setItem(SETTINGS_STORAGE_KEY, serialized);
    if (accountId) {
      localStorage.setItem(settingsKeyForAccount(accountId), serialized);
    }
  } catch {
    // Ignore storage quota errors
  }
  return sanitized;
}

export function resetUserSettings(accountId?: string | null): UserSettings {
  return saveUserSettings(DEFAULT_USER_SETTINGS, accountId);
}

const COMPLETED_TUTORIALS_STORAGE_KEY = 'blind_war_completed_tutorials_v1';
const CONTEXTUAL_TUTORIALS_STORAGE_KEY = 'blind_war_contextual_tutorials_v1';

export function loadCompletedTutorialIds(): string[] {
  try {
    const raw = localStorage.getItem(COMPLETED_TUTORIALS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((x): x is string => typeof x === 'string'))];
  } catch {
    return [];
  }
}

export function markTutorialScenarioCompleted(scenarioId: string): string[] {
  const current = loadCompletedTutorialIds();
  if (current.includes(scenarioId)) {
    return current;
  }
  const next = [...new Set([...current, scenarioId])];
  try {
    localStorage.setItem(COMPLETED_TUTORIALS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage error in restricted mode
  }
  return next;
}

export function loadDismissedContextualTips(): string[] {
  try {
    const raw = localStorage.getItem(CONTEXTUAL_TUTORIALS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((x): x is string => typeof x === 'string'))];
  } catch {
    return [];
  }
}

export function dismissContextualTip(tipId: string): string[] {
  const current = loadDismissedContextualTips();
  if (current.includes(tipId)) {
    return current;
  }
  const next = [...current, tipId];
  try {
    localStorage.setItem(CONTEXTUAL_TUTORIALS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage error in restricted mode
  }
  return next;
}

export function resetContextualTips(): void {
  try {
    localStorage.removeItem(CONTEXTUAL_TUTORIALS_STORAGE_KEY);
  } catch {
    // Ignore storage error
  }
}

// ============================================================================
// CLIENT PERSISTENT NOTIFICATION STORE (filtered by UserPreferences)
// ============================================================================

export function isNotificationCategoryEnabled(
  category: NotificationCategory,
  prefs: UserPreferences,
): boolean {
  switch (category) {
    case 'invitation':
      return prefs.notifyInvitations;
    case 'match_start':
      return prefs.notifyMatchStart;
    case 'message':
      return prefs.notifyMessages;
    case 'account':
      return prefs.notifyAccountEvents;
    case 'update':
      return prefs.notifyUpdates;
  }
}

export function loadNotifications(): ClientNotificationItem[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ClientNotificationItem[]) : [];
  } catch {
    return [];
  }
}

export function saveNotifications(items: readonly ClientNotificationItem[]): ClientNotificationItem[] {
  const trimmed = items.slice(0, 40);
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage quota errors
  }
  return trimmed;
}

const ISOLATED_TAB_STORAGE_KEY = 'blind_war_isolated_tab';

export function isIsolatedBrowserTab(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('isolatedTab') === '1') {
        sessionStorage.setItem(ISOLATED_TAB_STORAGE_KEY, '1');
        return true;
      }
    }
    return sessionStorage.getItem(ISOLATED_TAB_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Jeton de session :
 * - `sessionStorage` (propre à chaque onglet) est prioritaire, ce qui permet d'ouvrir deux
 *   onglets connectés à deux comptes différents (test du matchmaking en local).
 * - Si l'onglet a été ouvert en mode isolé (`?isolatedTab=1`), il n'utilise que `sessionStorage`
 *   pour ne pas partager le compte de l'onglet principal.
 * - Sinon, `localStorage` sert de mémoire « se souvenir de moi » pour les nouveaux onglets.
 */
export function getSavedAuthToken(): string | null {
  try {
    if (isIsolatedBrowserTab()) {
      return sessionStorage.getItem(TOKEN_STORAGE_KEY);
    }
    return sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setSavedAuthToken(token: string | null): void {
  try {
    const isolated = isIsolatedBrowserTab();
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      if (!isolated) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      }
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      if (!isolated) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    }
  } catch {
    // Stockage indisponible (navigation privée stricte) : session non mémorisée
  }
}

const GUEST_ID_STORAGE_KEY = 'blind_war_guest_id';

/**
 * Identifiant invité propre à chaque onglet (`sessionStorage`) : deux onglets du même
 * navigateur sont donc deux joueurs invités distincts, et un rechargement de page conserve
 * l'identité (reconnexion à la partie en cours dans les 60 s).
 */
export function getOrCreateGuestId(): string {
  try {
    const existing = sessionStorage.getItem(GUEST_ID_STORAGE_KEY);
    if (existing) return existing;
    const bytes = new Uint8Array(9);
    crypto.getRandomValues(bytes);
    const id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(GUEST_ID_STORAGE_KEY, id);
    return id;
  } catch {
    return Math.random().toString(36).slice(2, 14);
  }
}

export async function apiRegister(
  username: string,
  password: string,
  avatarBadge: string,
): Promise<{ token: string; profile: ClientUserProfile }> {
  if (isStandaloneFileMode()) {
    const res = getBrowserStandaloneNode().register(username, password, avatarBadge);
    setSavedAuthToken(res.token);
    return res;
  }
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, avatarBadge }),
    });
    const data = (await res.json()) as {
      token?: string;
      profile?: ClientUserProfile;
      error?: string;
    };
    if (!res.ok || !data.token || !data.profile) {
      throw new Error(data.error ?? 'Échec de l’inscription.');
    }
    setSavedAuthToken(data.token);
    return { token: data.token, profile: data.profile };
  } catch (err) {
    if (err instanceof TypeError) {
      const res = getBrowserStandaloneNode().register(username, password, avatarBadge);
      setSavedAuthToken(res.token);
      return res;
    }
    throw err;
  }
}

export async function apiLogin(
  username: string,
  password: string,
): Promise<{ token: string; profile: ClientUserProfile }> {
  if (isStandaloneFileMode()) {
    const res = getBrowserStandaloneNode().login(username, password);
    setSavedAuthToken(res.token);
    return res;
  }
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = (await res.json()) as {
      token?: string;
      profile?: ClientUserProfile;
      error?: string;
    };
    if (!res.ok || !data.token || !data.profile) {
      throw new Error(data.error ?? 'Identifiants incorrects.');
    }
    setSavedAuthToken(data.token);
    return { token: data.token, profile: data.profile };
  } catch (err) {
    if (err instanceof TypeError) {
      const res = getBrowserStandaloneNode().login(username, password);
      setSavedAuthToken(res.token);
      return res;
    }
    throw err;
  }
}

export async function apiFetchCurrentUser(): Promise<ClientUserProfile | null> {
  const token = getSavedAuthToken();
  if (!token) return null;
  if (isStandaloneFileMode() || token.startsWith('localtoken:')) {
    return getBrowserStandaloneNode().getUserFromToken(token);
  }
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 404) {
        setSavedAuthToken(null);
      }
      return null;
    }
    const data = (await res.json()) as { profile: ClientUserProfile };
    return data.profile;
  } catch {
    return getBrowserStandaloneNode().getUserFromToken(token);
  }
}

export interface ProfileUpdatePayload {
  readonly displayName?: string;
  readonly avatarBadge?: string;
  readonly avatarImage?: string | null;
  readonly removeAvatarImage?: boolean;
  readonly bio?: string;
  readonly profileBanner?: ProfileBannerId;
  readonly selectedTitle?: ProfileTitleId;
  readonly selectedBadge?: ProfileAchievementId | null;
  readonly preferences?: Partial<UserPreferences>;
}

export async function apiUpdateProfile(
  updates: ProfileUpdatePayload,
): Promise<ClientUserProfile> {
  const token = getSavedAuthToken();
  if (isStandaloneFileMode() || token?.startsWith('localtoken:')) {
    return getBrowserStandaloneNode().updateProfile(token, updates);
  }
  try {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(updates),
    });
    const data = (await res.json()) as { profile?: ClientUserProfile; error?: string };
    if (!res.ok || !data.profile) {
      throw new Error(data.error ?? 'Mise à jour refusée.');
    }
    return data.profile;
  } catch (err) {
    if (err instanceof TypeError) {
      return getBrowserStandaloneNode().updateProfile(token, updates);
    }
    throw err;
  }
}

export async function apiFetchLeaderboard(): Promise<ClientUserProfile[]> {
  if (isStandaloneFileMode()) {
    return getBrowserStandaloneNode().getLeaderboard();
  }
  try {
    const res = await fetch('/api/leaderboard');
    if (!res.ok) return getBrowserStandaloneNode().getLeaderboard();
    const data = (await res.json()) as { leaderboard: ClientUserProfile[] };
    return data.leaderboard ?? [];
  } catch {
    return getBrowserStandaloneNode().getLeaderboard();
  }
}

export async function apiFetchMatchHistory(userId?: string): Promise<ClientMatchHistoryItem[]> {
  if (isStandaloneFileMode()) {
    return getBrowserStandaloneNode().getMatches(userId);
  }
  try {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const res = await fetch(`/api/matches${query}`);
    if (!res.ok) return getBrowserStandaloneNode().getMatches(userId);
    const data = (await res.json()) as { matches: ClientMatchHistoryItem[] };
    return data.matches ?? [];
  } catch {
    return getBrowserStandaloneNode().getMatches(userId);
  }
}

export async function apiFetchEloHistory(userId: string): Promise<ClientEloHistoryItem[]> {
  if (isStandaloneFileMode()) {
    return getBrowserStandaloneNode().getEloHistory(userId);
  }
  try {
    const res = await fetch(`/api/elo-history/${encodeURIComponent(userId)}`);
    if (!res.ok) return getBrowserStandaloneNode().getEloHistory(userId);
    const data = (await res.json()) as { history: ClientEloHistoryItem[] };
    return data.history ?? [];
  } catch {
    return getBrowserStandaloneNode().getEloHistory(userId);
  }
}

/**
 * Validate a cropped raster avatar data URL strictly on client side before persisting
 * (mirrors server-side PNG / JPEG / WebP checks, excluding SVG / spoofed data URIs).
 */
export function validateClientAvatarDataUrl(raw: string): string {
  const trimmed = raw.trim();
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(trimmed);
  if (!match) {
    throw new Error('Format d’image non supporté. Utilisez uniquement PNG, JPEG ou WebP.');
  }
  const mimeSubtype = match[1].toLowerCase();
  const base64Body = match[2];
  if (base64Body.length > 350_000) {
    throw new Error('Image trop volumineuse après recadrage (max 256 Ko).');
  }
  return `data:image/${mimeSubtype === 'jpg' ? 'jpeg' : mimeSubtype};base64,${base64Body}`;
}

export type TacticalSfxKind =
  | 'select'
  | 'move'
  | 'capture'
  | 'ability'
  | 'reveal'
  | 'card'
  | 'turn'
  | 'alert'
  | 'victory'
  | 'defeat'
  | 'menu';

/**
 * Synthesize original pixel-art tactical sound effects scaled by `masterVolume` and `soundVolume`.
 * Uses subtle pitch micro-variation so repeated actions never sound fatiguing.
 */
export function playTacticalSfx(kind: TacticalSfxKind): void {
  const settings = loadUserSettings();
  const masterVol = settings.masterVolume ?? 85;
  if (
    !settings.soundEnabled ||
    masterVol <= 0 ||
    settings.soundVolume <= 0 ||
    typeof window === 'undefined'
  ) {
    return;
  }
  const combinedFactor = Math.max(
    0.01,
    Math.min(1, (masterVol / 100) * (settings.soundVolume / 100)),
  );
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    const detuneCents = (Math.random() - 0.5) * 24;
    osc.detune.setValueAtTime(detuneCents, now);

    if (kind === 'select') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.setValueAtTime(660, now + 0.025);
      gain.gain.setValueAtTime(0.045 * combinedFactor, now);
      gain.gain.linearRampToValueAtTime(0.002, now + 0.055);
      osc.start(now);
      osc.stop(now + 0.055);
    } else if (kind === 'menu') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(540, now + 0.02);
      gain.gain.setValueAtTime(0.04 * combinedFactor, now);
      gain.gain.linearRampToValueAtTime(0.002, now + 0.045);
      osc.start(now);
      osc.stop(now + 0.045);
    } else if (kind === 'move') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.075);
      gain.gain.setValueAtTime(0.075 * combinedFactor, now);
      gain.gain.linearRampToValueAtTime(0.004, now + 0.085);
      osc.start(now);
      osc.stop(now + 0.085);
    } else if (kind === 'capture') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.setValueAtTime(120, now + 0.04);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.17);
      gain.gain.setValueAtTime(0.13 * combinedFactor, now);
      gain.gain.linearRampToValueAtTime(0.004, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (kind === 'ability' || kind === 'reveal' || kind === 'card') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(392, now);
      osc.frequency.setValueAtTime(523.25, now + 0.045);
      osc.frequency.setValueAtTime(659.25, now + 0.09);
      gain.gain.setValueAtTime(0.065 * combinedFactor, now);
      gain.gain.linearRampToValueAtTime(0.004, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (kind === 'turn') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.setValueAtTime(440, now + 0.045);
      gain.gain.setValueAtTime(0.055 * combinedFactor, now);
      gain.gain.linearRampToValueAtTime(0.003, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (kind === 'victory') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.setValueAtTime(440, now + 0.09);
      osc.frequency.setValueAtTime(554.37, now + 0.18);
      osc.frequency.setValueAtTime(659.25, now + 0.27);
      gain.gain.setValueAtTime(0.11 * combinedFactor, now);
      gain.gain.linearRampToValueAtTime(0.004, now + 0.42);
      osc.start(now);
      osc.stop(now + 0.42);
    } else if (kind === 'defeat') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(293.66, now);
      osc.frequency.setValueAtTime(246.94, now + 0.11);
      osc.frequency.setValueAtTime(196.0, now + 0.22);
      gain.gain.setValueAtTime(0.085 * combinedFactor, now);
      gain.gain.linearRampToValueAtTime(0.004, now + 0.38);
      osc.start(now);
      osc.stop(now + 0.38);
    } else {
      // alert
      osc.type = 'square';
      osc.frequency.setValueAtTime(310, now);
      osc.frequency.setValueAtTime(230, now + 0.055);
      gain.gain.setValueAtTime(0.06 * combinedFactor, now);
      gain.gain.linearRampToValueAtTime(0.004, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    }
  } catch {
    // Ignore audio context errors when browser autoplay is restricted
  }
}

// ============================================================================
// ADMIN API HELPERS (STRICTLY PROTECTED ON SERVER BY KENKTRA_7003 ROLE)
// ============================================================================

export interface ClientAdminStorageHealth {
  readonly diskFilePath: string;
  readonly fileExists: boolean;
  readonly backupExists: boolean;
  readonly usersCount: number;
  readonly matchesCount: number;
  readonly eloHistoryCount: number;
}

export interface ClientAdminOverview {
  readonly users: readonly ClientUserProfile[];
  readonly matches: readonly ClientMatchHistoryItem[];
  readonly adminLogs: readonly AdminAuditLogEntry[];
  readonly storage: ClientAdminStorageHealth;
  readonly activeRoomsCount: number;
}

export async function apiFetchAdminOverview(): Promise<ClientAdminOverview> {
  const token = getSavedAuthToken();
  if (!token) {
    throw new Error('Authentification requise.');
  }
  const res = await fetch('/api/admin/overview', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as Partial<ClientAdminOverview> & { error?: string };
  if (!res.ok || !data.users) {
    throw new Error(data.error ?? 'Accès administrateur refusé.');
  }
  return data as ClientAdminOverview;
}

export async function apiAdminUpdateUserStats(
  userId: string,
  payload: {
    eloRating?: number;
    wins?: number;
    losses?: number;
    draws?: number;
    gamesPlayed?: number;
    totalEliminations?: number;
    newMechanicsStats?: Partial<NewMechanicsStats>;
    reason?: string;
  },
): Promise<{ readonly profile: ClientUserProfile; readonly logEntry: AdminAuditLogEntry }> {
  const token = getSavedAuthToken();
  if (!token) throw new Error('Authentification requise.');
  const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/stats`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as {
    profile?: ClientUserProfile;
    logEntry?: AdminAuditLogEntry;
    error?: string;
  };
  if (!res.ok || !data.profile || !data.logEntry) {
    throw new Error(data.error ?? 'Modification impossible.');
  }
  return { profile: data.profile, logEntry: data.logEntry };
}

export async function apiAdminManageUserAccount(
  userId: string,
  payload: {
    accountStatus?: AccountStatus;
    suspendedReason?: string | null;
    displayName?: string;
    bio?: string;
  },
): Promise<{ readonly profile: ClientUserProfile; readonly logEntry: AdminAuditLogEntry }> {
  const token = getSavedAuthToken();
  if (!token) throw new Error('Authentification requise.');
  const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/account`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as {
    profile?: ClientUserProfile;
    logEntry?: AdminAuditLogEntry;
    error?: string;
  };
  if (!res.ok || !data.profile || !data.logEntry) {
    throw new Error(data.error ?? 'Opération sur le compte refusée.');
  }
  return { profile: data.profile, logEntry: data.logEntry };
}

// ============================================================================
// SECURE PASSWORD VERIFICATION & CHANGE (§5)
// ============================================================================

export async function apiVerifyCurrentPassword(currentPassword: string): Promise<boolean> {
  const token = getSavedAuthToken();
  if (!token) {
    throw new Error('Authentification requise.');
  }
  if (isStandaloneFileMode() || token.startsWith('localtoken:')) {
    return getBrowserStandaloneNode().verifyCurrentPassword(token, currentPassword);
  }
  try {
    const res = await fetch('/api/auth/verify-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword }),
    });
    const data = (await res.json()) as { verified?: boolean; error?: string };
    if (!res.ok || !data.verified) {
      throw new Error(data.error ?? 'Ancien mot de passe incorrect.');
    }
    return true;
  } catch (err) {
    if (err instanceof TypeError) {
      return getBrowserStandaloneNode().verifyCurrentPassword(token, currentPassword);
    }
    throw err;
  }
}

export async function apiChangePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): Promise<{ readonly token: string; readonly profile: ClientUserProfile }> {
  const token = getSavedAuthToken();
  if (!token) {
    throw new Error('Authentification requise.');
  }
  if (isStandaloneFileMode() || token.startsWith('localtoken:')) {
    const res = getBrowserStandaloneNode().changePassword(
      token,
      currentPassword,
      newPassword,
      confirmPassword,
    );
    setSavedAuthToken(res.token);
    return res;
  }
  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
    const data = (await res.json()) as {
      token?: string;
      profile?: ClientUserProfile;
      error?: string;
    };
    if (!res.ok || !data.token || !data.profile) {
      throw new Error(data.error ?? 'Modification du mot de passe refusée.');
    }
    setSavedAuthToken(data.token);
    return { token: data.token, profile: data.profile };
  } catch (err) {
    if (err instanceof TypeError) {
      const res = getBrowserStandaloneNode().changePassword(
        token,
        currentPassword,
        newPassword,
        confirmPassword,
      );
      setSavedAuthToken(res.token);
      return res;
    }
    throw err;
  }
}
