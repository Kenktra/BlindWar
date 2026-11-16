import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import {
  DEFAULT_USER_PREFERENCES,
  INITIAL_ELO_RATING,
  computeEloUpdate,
  computeProfileCosmetics,
  createZeroNewMechanicsStats,
  sanitizeDisplayName,
  sanitizeUserPreferences,
  type CustomRulesetConfig,
  type GameMode,
  type MatchOutcomeReason,
  type NewMechanicsStats,
  type PlayerColor,
  type ProfileAchievementId,
  type ProfileBannerId,
  type ProfileTitleId,
  type UserPreferences,
} from '../../../shared/src/index.js';
import { validateAvatarImageDataUrl } from '../auth/avatarValidation.js';
import {
  atomicWriteTextFileSync,
  resolveDataFilePath,
  resolveProjectRoot,
  sweepStaleTempFilesSync,
} from './dataPaths.js';

export function normalizeNewMechanicsStats(
  raw?: Partial<NewMechanicsStats> | null,
): NewMechanicsStats {
  const zero = createZeroNewMechanicsStats();
  if (!raw) return zero;
  return {
    traqueurMoves: Number(raw.traqueurMoves ?? 0),
    traqueurMarks: Number(raw.traqueurMarks ?? 0),
    traqueurPursuitsSucceeded: Number(raw.traqueurPursuitsSucceeded ?? 0),
    traqueurEliminations: Number(raw.traqueurEliminations ?? 0),
    executeurPiercingStrikes: Number(raw.executeurPiercingStrikes ?? 0),
    executeurEliminations: Number(raw.executeurEliminations ?? 0),
    arbaletrierShotsTotal: Number(raw.arbaletrierShotsTotal ?? 0),
    arbaletrierShotsSucceeded: Number(raw.arbaletrierShotsSucceeded ?? 0),
    arbaletrierShotsBlocked: Number(raw.arbaletrierShotsBlocked ?? 0),
    colossiEliminatedByKamikaze: Number(raw.colossiEliminatedByKamikaze ?? 0),
  };
}

function addNewMechanicsStats(
  base: NewMechanicsStats,
  delta?: Partial<NewMechanicsStats> | null,
): NewMechanicsStats {
  const b = normalizeNewMechanicsStats(base);
  const d = normalizeNewMechanicsStats(delta);
  return {
    traqueurMoves: b.traqueurMoves + d.traqueurMoves,
    traqueurMarks: b.traqueurMarks + d.traqueurMarks,
    traqueurPursuitsSucceeded: b.traqueurPursuitsSucceeded + d.traqueurPursuitsSucceeded,
    traqueurEliminations: b.traqueurEliminations + d.traqueurEliminations,
    executeurPiercingStrikes: b.executeurPiercingStrikes + d.executeurPiercingStrikes,
    executeurEliminations: b.executeurEliminations + d.executeurEliminations,
    arbaletrierShotsTotal: b.arbaletrierShotsTotal + d.arbaletrierShotsTotal,
    arbaletrierShotsSucceeded: b.arbaletrierShotsSucceeded + d.arbaletrierShotsSucceeded,
    arbaletrierShotsBlocked: b.arbaletrierShotsBlocked + d.arbaletrierShotsBlocked,
    colossiEliminatedByKamikaze: b.colossiEliminatedByKamikaze + d.colossiEliminatedByKamikaze,
  };
}

export interface StoredUserRecord {
  readonly id: string;
  readonly username: string;
  readonly displayName?: string;
  readonly passwordHash: string;
  readonly avatarBadge: string;
  readonly avatarImage?: string | null;
  readonly bio: string;
  readonly profileBanner?: ProfileBannerId;
  readonly selectedTitle?: ProfileTitleId;
  readonly selectedBadge?: ProfileAchievementId | null;
  readonly preferences?: UserPreferences;
  readonly eloRating: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly gamesPlayed: number;
  readonly totalEliminations: number;
  readonly newMechanicsStats?: NewMechanicsStats;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PublicUserProfile {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly avatarBadge: string;
  readonly avatarImage: string | null;
  readonly bio: string;
  readonly profileBanner: ProfileBannerId;
  readonly selectedTitle: ProfileTitleId;
  readonly selectedBadge: ProfileAchievementId | null;
  readonly preferences: UserPreferences;
  readonly eloRating: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly gamesPlayed: number;
  readonly winRatePercent: number;
  readonly totalEliminations: number;
  readonly newMechanicsStats: NewMechanicsStats;
  readonly createdAt: string;
}

export interface StoredMatchRecord {
  readonly id: string;
  readonly mode: GameMode;
  readonly redUserId: string | null;
  readonly blackUserId: string | null;
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

export interface EloHistoryEntry {
  readonly id: number;
  readonly userId: string;
  readonly matchId: string;
  readonly eloBefore: number;
  readonly eloAfter: number;
  readonly delta: number;
  readonly recordedAt: string;
}

interface DiskStoreFormat {
  users: StoredUserRecord[];
  matches: StoredMatchRecord[];
  eloHistory: EloHistoryEntry[];
}

export function normalizeUsernameKey(username: string): string {
  return username.trim().replace(/\s+/g, ' ').toLowerCase();
}

function deduplicateUsersByUsername(users: readonly StoredUserRecord[]): StoredUserRecord[] {
  const byName = new Map<string, StoredUserRecord>();
  for (const u of users) {
    if (!u || typeof u.id !== 'string' || typeof u.username !== 'string') continue;
    const key = normalizeUsernameKey(u.username);
    if (!key) continue;
    const prev = byName.get(key);
    if (!prev) {
      byName.set(key, { ...u, username: u.username.trim().replace(/\s+/g, ' ') });
    } else {
      // S'il y a collision de nom (ex: synchronisation P2P de 2 comptes créés hors-ligne),
      // on conserve uniquement le compte ayant le plus de parties jouées ou le plus ancien.
      const keepNew =
        u.gamesPlayed > prev.gamesPlayed ||
        (u.gamesPlayed === prev.gamesPlayed &&
          new Date(u.createdAt).getTime() < new Date(prev.createdAt).getTime());
      if (keepNew) {
        byName.set(key, { ...u, username: u.username.trim().replace(/\s+/g, ' ') });
      }
    }
  }
  return [...byName.values()];
}

function mapPgRowToStoredUser(row: Record<string, any>): StoredUserRecord {
  return {
    id: row.id,
    username: row.username,
    displayName: typeof row.display_name === 'string' && row.display_name.trim() ? row.display_name : row.username,
    passwordHash: row.password_hash,
    avatarBadge: row.avatar_badge,
    avatarImage: typeof row.avatar_image === 'string' ? row.avatar_image : null,
    bio: row.bio,
    profileBanner: (row.profile_banner as ProfileBannerId) || 'classic',
    selectedTitle: (row.selected_title as ProfileTitleId) || 'recrue',
    selectedBadge: (row.selected_badge as ProfileAchievementId | null) ?? null,
    preferences: sanitizeUserPreferences(row.preferences_json as Partial<UserPreferences> | undefined),
    eloRating: Number(row.elo_rating),
    wins: Number(row.wins),
    losses: Number(row.losses),
    draws: Number(row.draws),
    gamesPlayed: Number(row.games_played),
    totalEliminations: Number(row.total_eliminations),
    newMechanicsStats: normalizeNewMechanicsStats(
      row.new_mechanics_stats as Partial<NewMechanicsStats> | undefined
    ),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export function toPublicProfile(user: StoredUserRecord): PublicUserProfile {
  const winRatePercent =
    user.gamesPlayed > 0 ? Math.round((user.wins / user.gamesPlayed) * 1000) / 10 : 0;
  const normalizedStats = normalizeNewMechanicsStats(user.newMechanicsStats);
  const cosmetics = computeProfileCosmetics({
    wins: user.wins,
    gamesPlayed: user.gamesPlayed,
    eloRating: user.eloRating,
    totalEliminations: user.totalEliminations,
    newMechanicsStats: normalizedStats,
  });

  const bannerUnlocked = cosmetics.banners.some(
    (b) => b.id === user.profileBanner && b.unlocked
  );
  const titleUnlocked = cosmetics.titles.some(
    (t) => t.id === user.selectedTitle && t.unlocked
  );
  const badgeUnlocked =
    user.selectedBadge !== null &&
    user.selectedBadge !== undefined &&
    cosmetics.badges.some((b) => b.id === user.selectedBadge && b.unlocked);

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName?.trim() || user.username,
    avatarBadge: user.avatarBadge,
    avatarImage: user.avatarImage ?? null,
    bio: user.bio,
    profileBanner: bannerUnlocked && user.profileBanner ? user.profileBanner : 'classic',
    selectedTitle: titleUnlocked && user.selectedTitle ? user.selectedTitle : 'recrue',
    selectedBadge: badgeUnlocked ? (user.selectedBadge ?? null) : null,
    preferences: sanitizeUserPreferences(user.preferences),
    eloRating: user.eloRating,
    wins: user.wins,
    losses: user.losses,
    draws: user.draws,
    gamesPlayed: user.gamesPlayed,
    winRatePercent,
    totalEliminations: user.totalEliminations,
    newMechanicsStats: normalizedStats,
    createdAt: user.createdAt,
  };
}

export class BlindWarDatabase {
  private readonly pgPool: Pool | null = null;
  private readonly diskFilePath: string;
  private mutationQueue: Promise<unknown> = Promise.resolve();
  private store: DiskStoreFormat = {
    users: [],
    matches: [],
    eloHistory: [],
  };

  constructor(options?: { databaseUrl?: string; diskFilePath?: string }) {
    const dbUrl = options?.databaseUrl ?? process.env.DATABASE_URL;
    if (dbUrl) {
      this.pgPool = new Pool({ connectionString: dbUrl });
    }
    this.diskFilePath =
      options?.diskFilePath ?? resolveDataFilePath('blind-war-db.json');
    this.loadDiskStore();
  }

  /** Serialize concurrent mutations cleanly so rapid updates never race on disk. */
  protected withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.mutationQueue.then(operation, operation);
    this.mutationQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private validateAndNormalizeStore(raw: unknown): DiskStoreFormat {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('Format de base de données invalide.');
    }
    const parsed = raw as Partial<DiskStoreFormat>;
    if (
      (parsed.users !== undefined && !Array.isArray(parsed.users)) ||
      (parsed.matches !== undefined && !Array.isArray(parsed.matches)) ||
      (parsed.eloHistory !== undefined && !Array.isArray(parsed.eloHistory))
    ) {
      throw new Error('Structure de base de données corrompue.');
    }
    return {
      users: deduplicateUsersByUsername(Array.isArray(parsed.users) ? parsed.users : []),
      matches: Array.isArray(parsed.matches)
        ? parsed.matches.filter((m) => Boolean(m && typeof m.id === 'string'))
        : [],
      eloHistory: Array.isArray(parsed.eloHistory)
        ? parsed.eloHistory.filter(
            (e) => Boolean(e && typeof e.userId === 'string' && typeof e.matchId === 'string'),
          )
        : [],
    };
  }

  private tryReadStoreFile(filePath: string): DiskStoreFormat | null {
    if (!fs.existsSync(filePath)) return null;
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      if (!raw.trim()) return null;
      const parsed = JSON.parse(raw) as unknown;
      return this.validateAndNormalizeStore(parsed);
    } catch {
      return null;
    }
  }

  private loadDiskStore(): void {
    const dir = path.dirname(this.diskFilePath);
    sweepStaleTempFilesSync(dir);

    const primaryExists = fs.existsSync(this.diskFilePath);
    const primary = this.tryReadStoreFile(this.diskFilePath);
    if (primary) {
      this.store = primary;
      return;
    }

    const bakPath = `${this.diskFilePath}.bak`;
    const backup = this.tryReadStoreFile(bakPath);
    if (backup) {
      console.warn(
        `[BLIND WAR DB] Fichier principal endommagé (${this.diskFilePath}) : restauration automatique depuis ${bakPath}.`,
      );
      this.store = backup;
      atomicWriteTextFileSync(this.diskFilePath, JSON.stringify(this.store, null, 2), {
        createBackup: false,
      });
      return;
    }

    if (primaryExists) {
      console.error(
        `[BLIND WAR DB] Le fichier ${this.diskFilePath} est illisible et aucune sauvegarde .bak valide n'a été trouvée.`,
      );
      this.store = { users: [], matches: [], eloHistory: [] };
      return;
    }

    // Premier démarrage absolu : initialise le fichier unique sans sauvegarde .bak superflue
    this.store = { users: [], matches: [], eloHistory: [] };
    this.saveDiskStore(false);
  }

  private saveDiskStore(createBackup: boolean = true): void {
    const normalized = this.validateAndNormalizeStore(this.store);
    this.store = normalized;
    atomicWriteTextFileSync(this.diskFilePath, JSON.stringify(normalized, null, 2), {
      createBackup,
    });
  }

  getStorageHealth(): {
    readonly diskFilePath: string;
    readonly fileExists: boolean;
    readonly backupExists: boolean;
    readonly usersCount: number;
    readonly matchesCount: number;
    readonly eloHistoryCount: number;
  } {
    return {
      diskFilePath: this.diskFilePath,
      fileExists: fs.existsSync(this.diskFilePath),
      backupExists: fs.existsSync(`${this.diskFilePath}.bak`),
      usersCount: this.store.users.length,
      matchesCount: this.store.matches.length,
      eloHistoryCount: this.store.eloHistory.length,
    };
  }

  async initSchema(): Promise<void> {
    if (!this.pgPool) {
      return;
    }
    const schemaPath = path.resolve(resolveProjectRoot(), 'server', 'src', 'database', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      await this.pgPool.query(sql);
    }
  }

  async createUser(params: {
    id: string;
    username: string;
    passwordHash: string;
    avatarBadge?: string;
  }): Promise<StoredUserRecord> {
    return this.withMutationLock(async () => {
    const normalizedUsername = params.username.trim().replace(/\s+/g, ' ');
    const usernameKey = normalizeUsernameKey(normalizedUsername);
    const nowIso = new Date().toISOString();

    if (this.pgPool) {
      const existingPg = await this.findUserByUsername(normalizedUsername);
      if (existingPg) {
        throw new Error(
          `Ce nom d'utilisateur est déjà utilisé. Impossible d'avoir deux comptes avec le même nom.`,
        );
      }
      const res = await this.pgPool.query(
        `INSERT INTO users (id, username, display_name, password_hash, avatar_badge, elo_rating, preferences_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          params.id,
          normalizedUsername,
          normalizedUsername,
          params.passwordHash,
          params.avatarBadge ?? '♔',
          INITIAL_ELO_RATING,
          JSON.stringify(DEFAULT_USER_PREFERENCES),
        ],
      );
      return mapPgRowToStoredUser(res.rows[0]);
    }

    const existing = this.store.users.find(
      (u) => u.id === params.id || normalizeUsernameKey(u.username) === usernameKey,
    );
    if (existing) {
      throw new Error(
        `Ce nom d'utilisateur est déjà utilisé. Impossible d'avoir deux comptes avec le même nom.`,
      );
    }

    const record: StoredUserRecord = {
      id: params.id,
      username: normalizedUsername,
      displayName: normalizedUsername,
      passwordHash: params.passwordHash,
      avatarBadge: params.avatarBadge ?? '♔',
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

    this.store.users.push(record);
    this.saveDiskStore();
    return record;
    });
  }

  async findUserByUsername(username: string): Promise<StoredUserRecord | null> {
    const normalized = normalizeUsernameKey(username);
    if (this.pgPool) {
      const res = await this.pgPool.query(
        `SELECT * FROM users WHERE LOWER(username) = $1 LIMIT 1`,
        [normalized],
      );
      if (res.rowCount === 0) return null;
      return mapPgRowToStoredUser(res.rows[0]);
    }

    return this.store.users.find((u) => normalizeUsernameKey(u.username) === normalized) ?? null;
  }

  async findUserById(userId: string): Promise<StoredUserRecord | null> {
    if (this.pgPool) {
      const res = await this.pgPool.query(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [userId]);
      if (res.rowCount === 0) return null;
      return mapPgRowToStoredUser(res.rows[0]);
    }

    return this.store.users.find((u) => u.id === userId) ?? null;
  }

  async updateUserProfile(
    userId: string,
    updates: {
      displayName?: string;
      avatarBadge?: string;
      avatarImage?: string | null;
      removeAvatarImage?: boolean;
      bio?: string;
      profileBanner?: ProfileBannerId;
      selectedTitle?: ProfileTitleId;
      selectedBadge?: ProfileAchievementId | null;
      preferences?: Partial<UserPreferences>;
    },
  ): Promise<PublicUserProfile> {
    return this.withMutationLock(async () => {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new Error(`Utilisateur introuvable.`);
    }

    const cosmetics = computeProfileCosmetics({
      wins: user.wins,
      gamesPlayed: user.gamesPlayed,
      eloRating: user.eloRating,
      totalEliminations: user.totalEliminations,
      newMechanicsStats: user.newMechanicsStats,
    });

    const nextDisplayName =
      updates.displayName !== undefined
        ? sanitizeDisplayName(updates.displayName) ?? user.username
        : (user.displayName ?? user.username);

    const nextAvatar = updates.avatarBadge?.trim() || user.avatarBadge;
    let nextAvatarImage: string | null = user.avatarImage ?? null;
    if (updates.removeAvatarImage || updates.avatarImage === null) {
      nextAvatarImage = null;
    } else if (typeof updates.avatarImage === 'string' && updates.avatarImage.trim().length > 0) {
      nextAvatarImage = validateAvatarImageDataUrl(updates.avatarImage);
    }

    const nextBio = updates.bio !== undefined ? updates.bio.slice(0, 240) : user.bio;

    let nextBanner: ProfileBannerId = user.profileBanner ?? 'classic';
    if (updates.profileBanner !== undefined) {
      const match = cosmetics.banners.find((b) => b.id === updates.profileBanner);
      if (!match || !match.unlocked) {
        throw new Error('Cette bannière de profil n’est pas encore débloquée.');
      }
      nextBanner = match.id;
    }

    let nextTitle: ProfileTitleId = user.selectedTitle ?? 'recrue';
    if (updates.selectedTitle !== undefined) {
      const match = cosmetics.titles.find((t) => t.id === updates.selectedTitle);
      if (!match || !match.unlocked) {
        throw new Error('Ce titre n’est pas encore débloqué.');
      }
      nextTitle = match.id;
    }

    let nextBadge: ProfileAchievementId | null = user.selectedBadge ?? null;
    if (updates.selectedBadge !== undefined) {
      if (updates.selectedBadge === null) {
        nextBadge = null;
      } else {
        const match = cosmetics.badges.find((b) => b.id === updates.selectedBadge);
        if (!match || !match.unlocked) {
          throw new Error('Ce badge de succès n’est pas encore débloqué.');
        }
        nextBadge = match.id;
      }
    }

    const nextPreferences = updates.preferences
      ? sanitizeUserPreferences({ ...sanitizeUserPreferences(user.preferences), ...updates.preferences })
      : sanitizeUserPreferences(user.preferences);

    const nowIso = new Date().toISOString();

    if (this.pgPool) {
      await this.pgPool.query(
        `UPDATE users
         SET display_name = $1,
             avatar_badge = $2,
             avatar_image = $3,
             bio = $4,
             profile_banner = $5,
             selected_title = $6,
             selected_badge = $7,
             preferences_json = $8,
             updated_at = NOW()
         WHERE id = $9`,
        [
          nextDisplayName,
          nextAvatar,
          nextAvatarImage,
          nextBio,
          nextBanner,
          nextTitle,
          nextBadge,
          JSON.stringify(nextPreferences),
          userId,
        ],
      );
      const refreshed = await this.findUserById(userId);
      return toPublicProfile(refreshed!);
    }

    const updated: StoredUserRecord = {
      ...user,
      displayName: nextDisplayName,
      avatarBadge: nextAvatar,
      avatarImage: nextAvatarImage,
      bio: nextBio,
      profileBanner: nextBanner,
      selectedTitle: nextTitle,
      selectedBadge: nextBadge,
      preferences: nextPreferences,
      updatedAt: nowIso,
    };
    this.store.users = this.store.users.map((u) => (u.id === userId ? updated : u));
    this.saveDiskStore();
    return toPublicProfile(updated);
    });
  }

  async recordCompletedMatch(params: {
    matchId: string;
    mode: GameMode;
    redUserId: string | null;
    blackUserId: string | null;
    redUsername: string;
    blackUsername: string;
    redEloBeforeHint?: number;
    blackEloBeforeHint?: number;
    winner: PlayerColor | 'draw';
    outcomeReason: MatchOutcomeReason;
    turnsPlayed: number;
    redEliminations: number;
    blackEliminations: number;
    redNewMechanicsStats?: NewMechanicsStats;
    blackNewMechanicsStats?: NewMechanicsStats;
    ruleset: CustomRulesetConfig;
    startedAt: string;
  }): Promise<StoredMatchRecord> {
    return this.withMutationLock(async () => {
    const existingMatch = this.store.matches.find((m) => m.id === params.matchId);
    if (existingMatch) {
      return existingMatch;
    }

    const redUser =
      (params.redUserId ? await this.findUserById(params.redUserId) : null) ??
      (params.redUsername && !params.redUsername.includes('(invité)')
        ? await this.findUserByUsername(params.redUsername)
        : null);
    const blackUser =
      (params.blackUserId ? await this.findUserById(params.blackUserId) : null) ??
      (params.blackUsername && !params.blackUsername.includes('(invité)')
        ? await this.findUserByUsername(params.blackUsername)
        : null);

    const redEloBefore =
      redUser?.eloRating ?? params.redEloBeforeHint ?? INITIAL_ELO_RATING;
    const blackEloBefore =
      blackUser?.eloRating ?? params.blackEloBeforeHint ?? INITIAL_ELO_RATING;

    const eloResult = computeEloUpdate(params.mode, redEloBefore, blackEloBefore, params.winner);
    const endedAt = new Date().toISOString();

    const matchRecord: StoredMatchRecord = {
      id: params.matchId,
      mode: params.mode,
      redUserId: redUser?.id ?? params.redUserId,
      blackUserId: blackUser?.id ?? params.blackUserId,
      redUsername: params.redUsername,
      blackUsername: params.blackUsername,
      winner: params.winner,
      outcomeReason: params.outcomeReason,
      redEloBefore,
      blackEloBefore,
      redEloAfter: eloResult.redNext,
      blackEloAfter: eloResult.blackNext,
      turnsPlayed: params.turnsPlayed,
      redNewMechanicsStats: normalizeNewMechanicsStats(params.redNewMechanicsStats),
      blackNewMechanicsStats: normalizeNewMechanicsStats(params.blackNewMechanicsStats),
      ruleset: params.ruleset,
      startedAt: params.startedAt,
      endedAt,
    };

    if (!this.pgPool) {
      this.store.matches.unshift(matchRecord);

      const updateOnePlayer = (
        user: StoredUserRecord | null,
        color: PlayerColor,
        eloAfter: number,
        eloBefore: number,
        delta: number,
        eliminations: number,
        newStatsDelta?: NewMechanicsStats,
      ): void => {
        if (!user) return;
        const won = params.winner === color ? 1 : 0;
        const drew = params.winner === 'draw' ? 1 : 0;
        const lost = params.winner !== 'draw' && params.winner !== color ? 1 : 0;

        const updatedUser: StoredUserRecord = {
          ...user,
          eloRating: eloAfter,
          wins: user.wins + won,
          losses: user.losses + lost,
          draws: user.draws + drew,
          gamesPlayed: user.gamesPlayed + 1,
          totalEliminations: user.totalEliminations + eliminations,
          newMechanicsStats: addNewMechanicsStats(
            user.newMechanicsStats ?? createZeroNewMechanicsStats(),
            newStatsDelta,
          ),
          updatedAt: endedAt,
        };
        this.store.users = this.store.users.map((u) => (u.id === user.id ? updatedUser : u));

        if (params.mode === 'matchmaking_ranked') {
          this.store.eloHistory.unshift({
            id: this.store.eloHistory.length + 1,
            userId: user.id,
            matchId: params.matchId,
            eloBefore,
            eloAfter,
            delta,
            recordedAt: endedAt,
          });
        }
      };

      updateOnePlayer(
        redUser,
        'red',
        eloResult.redNext,
        redEloBefore,
        eloResult.redDelta,
        params.redEliminations,
        params.redNewMechanicsStats,
      );
      updateOnePlayer(
        blackUser,
        'black',
        eloResult.blackNext,
        blackEloBefore,
        eloResult.blackDelta,
        params.blackEliminations,
        params.blackNewMechanicsStats,
      );

      this.saveDiskStore();
    }

    return matchRecord;
    });
  }

  async getLeaderboard(limit: number = 50): Promise<PublicUserProfile[]> {
    const sorted = [...this.store.users]
      .sort((a, b) => (b.eloRating !== a.eloRating ? b.eloRating - a.eloRating : b.wins - a.wins))
      .slice(0, limit);
    return sorted.map(toPublicProfile);
  }

  async getMatchHistoryForUser(userId?: string, limit: number = 30): Promise<StoredMatchRecord[]> {
    const list = userId
      ? this.store.matches.filter((m) => m.redUserId === userId || m.blackUserId === userId)
      : this.store.matches;
    return list.slice(0, limit);
  }

  async getEloHistoryForUser(userId: string, limit: number = 30): Promise<EloHistoryEntry[]> {
    return this.store.eloHistory.filter((e) => e.userId === userId).slice(0, limit);
  }

  /**
   * Exporte un instantané des comptes, parties et variations ELO pour la synchronisation
   * décentralisée P2P entre plusieurs PC exécutant le jeu en local.
   */
  exportSyncSnapshot(): {
    readonly users: readonly StoredUserRecord[];
    readonly matches: readonly StoredMatchRecord[];
    readonly eloHistory: readonly EloHistoryEntry[];
  } {
    return {
      users: this.store.users.slice(0, 150).map(({ preferences: _prefs, ...u }) => u),
      matches: this.store.matches.slice(0, 80),
      eloHistory: this.store.eloHistory.slice(0, 150),
    };
  }

  /**
   * Fusionne un instantané reçu d'un autre nœud P2P (ami exécutant le jeu en local) :
   * - Ajoute les comptes absents et met à jour les comptes existants si `updatedAt` ou
   *   `gamesPlayed` est plus récent.
   * - Ajoute les parties et entrées ELO absentes.
   */
  mergeRemoteSnapshot(remote: {
    readonly users?: readonly StoredUserRecord[];
    readonly matches?: readonly StoredMatchRecord[];
    readonly eloHistory?: readonly EloHistoryEntry[];
  }): boolean {
    let changed = false;

    if (Array.isArray(remote.users)) {
      for (const ru of remote.users) {
        if (!ru || typeof ru.id !== 'string' || typeof ru.username !== 'string') continue;
        const ruKey = normalizeUsernameKey(ru.username);
        if (!ruKey) continue;
        const idx = this.store.users.findIndex(
          (u) => u.id === ru.id || normalizeUsernameKey(u.username) === ruKey,
        );
        if (idx === -1) {
          this.store.users.push({
            ...ru,
            username: ru.username.trim().replace(/\s+/g, ' '),
            newMechanicsStats: normalizeNewMechanicsStats(ru.newMechanicsStats),
          });
          changed = true;
        } else {
          const cur = this.store.users[idx];
          if (
            ru.gamesPlayed > cur.gamesPlayed ||
            new Date(ru.updatedAt).getTime() > new Date(cur.updatedAt).getTime()
          ) {
            // On conserve l'identifiant et le nom du compte existant si le nom correspondait déjà
            this.store.users[idx] = {
              ...cur,
              ...ru,
              id: cur.id,
              username: cur.username,
              preferences: cur.preferences ?? DEFAULT_USER_PREFERENCES,
              newMechanicsStats: normalizeNewMechanicsStats(
                ru.newMechanicsStats ?? cur.newMechanicsStats,
              ),
            };
            changed = true;
          }
        }
      }
      const deduped = deduplicateUsersByUsername(this.store.users);
      if (deduped.length !== this.store.users.length) {
        this.store.users = deduped;
        changed = true;
      }
    }

    if (Array.isArray(remote.matches)) {
      for (const rm of remote.matches) {
        if (!rm || typeof rm.id !== 'string') continue;
        if (!this.store.matches.some((m) => m.id === rm.id)) {
          this.store.matches.push(rm);
          changed = true;
        }
      }
      this.store.matches.sort(
        (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime(),
      );
    }

    if (Array.isArray(remote.eloHistory)) {
      for (const re of remote.eloHistory) {
        if (!re || typeof re.matchId !== 'string' || typeof re.userId !== 'string') continue;
        if (
          !this.store.eloHistory.some((e) => e.matchId === re.matchId && e.userId === re.userId)
        ) {
          this.store.eloHistory.push({
            ...re,
            id: this.store.eloHistory.length + 1,
          });
          changed = true;
        }
      }
    }

    if (changed && !this.pgPool) {
      this.saveDiskStore();
    }
    return changed;
  }
}
