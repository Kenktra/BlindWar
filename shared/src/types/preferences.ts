import type { NewMechanicsStats } from './core.js';
import {
  DEFAULT_THEME_ID,
  isValidThemeId,
  type ThemeId,
} from '../constants/themes.js';

/**
 * Shared user customization preferences, notification toggles, accessibility options,
 * and verifiable profile cosmetics (banners, titles, achievement badges).
 */

export type BrightnessMode = 'standard' | 'bright' | 'dim';
export type AnimationSpeedMode = 'normal' | 'fast' | 'reduced';
export type TextScaleMode = 'normal' | 'large' | 'xlarge';

export interface UserPreferences {
  // Apparence
  readonly siteThemeId: ThemeId;
  readonly boardThemeId: ThemeId | 'match_site';
  readonly brightness: BrightnessMode;

  // Préférences de jeu
  readonly soundEnabled: boolean;
  readonly soundVolume: number; // 0..100
  readonly animationSpeed: AnimationSpeedMode;
  readonly showCoordinates: boolean;
  readonly showReconZones: boolean;
  readonly enableContextualTutorials: boolean;
  readonly confirmImportantActions: boolean;

  // Notifications
  readonly notifyInvitations: boolean;
  readonly notifyMatchStart: boolean;
  readonly notifyMessages: boolean;
  readonly notifyAccountEvents: boolean;
  readonly notifyUpdates: boolean;

  // Accessibilité
  readonly textScale: TextScaleMode;
  readonly highContrast: boolean;
  readonly reduceMotion: boolean;
  readonly highlightSelectionStrong: boolean;
  readonly showPatternMarkers: boolean;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  siteThemeId: DEFAULT_THEME_ID,
  boardThemeId: 'match_site',
  brightness: 'standard',
  soundEnabled: true,
  soundVolume: 75,
  animationSpeed: 'normal',
  showCoordinates: true,
  showReconZones: true,
  enableContextualTutorials: true,
  confirmImportantActions: true,
  notifyInvitations: true,
  notifyMatchStart: true,
  notifyMessages: true,
  notifyAccountEvents: true,
  notifyUpdates: true,
  textScale: 'normal',
  highContrast: false,
  reduceMotion: false,
  highlightSelectionStrong: false,
  showPatternMarkers: false,
};

function asBool(val: unknown, fallback: boolean): boolean {
  return typeof val === 'boolean' ? val : fallback;
}

function asEnum<T extends string>(
  val: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return typeof val === 'string' && (allowed as readonly string[]).includes(val)
    ? (val as T)
    : fallback;
}

/** Validate and normalize any partial or legacy preferences object safely. */
export function sanitizeUserPreferences(
  raw?: Partial<UserPreferences> | Record<string, unknown> | null
): UserPreferences {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_USER_PREFERENCES;
  }
  const obj = raw as Record<string, unknown>;
  const rawVol = typeof obj.soundVolume === 'number' ? obj.soundVolume : DEFAULT_USER_PREFERENCES.soundVolume;
  const clampedVol = Number.isFinite(rawVol) ? Math.max(0, Math.min(100, Math.round(rawVol))) : 75;

  return {
    siteThemeId: isValidThemeId(obj.siteThemeId)
      ? obj.siteThemeId
      : DEFAULT_USER_PREFERENCES.siteThemeId,
    boardThemeId:
      obj.boardThemeId === 'match_site' || isValidThemeId(obj.boardThemeId)
        ? (obj.boardThemeId as ThemeId | 'match_site')
        : DEFAULT_USER_PREFERENCES.boardThemeId,
    brightness: asEnum(obj.brightness, ['standard', 'bright', 'dim'] as const, DEFAULT_USER_PREFERENCES.brightness),
    soundEnabled: asBool(obj.soundEnabled, DEFAULT_USER_PREFERENCES.soundEnabled),
    soundVolume: clampedVol,
    animationSpeed: asEnum(
      obj.animationSpeed,
      ['normal', 'fast', 'reduced'] as const,
      DEFAULT_USER_PREFERENCES.animationSpeed
    ),
    showCoordinates: asBool(obj.showCoordinates, DEFAULT_USER_PREFERENCES.showCoordinates),
    showReconZones: asBool(obj.showReconZones, DEFAULT_USER_PREFERENCES.showReconZones),
    enableContextualTutorials: asBool(
      obj.enableContextualTutorials,
      DEFAULT_USER_PREFERENCES.enableContextualTutorials
    ),
    confirmImportantActions: asBool(
      obj.confirmImportantActions,
      DEFAULT_USER_PREFERENCES.confirmImportantActions
    ),
    notifyInvitations: asBool(obj.notifyInvitations, DEFAULT_USER_PREFERENCES.notifyInvitations),
    notifyMatchStart: asBool(obj.notifyMatchStart, DEFAULT_USER_PREFERENCES.notifyMatchStart),
    notifyMessages: asBool(obj.notifyMessages, DEFAULT_USER_PREFERENCES.notifyMessages),
    notifyAccountEvents: asBool(
      obj.notifyAccountEvents,
      DEFAULT_USER_PREFERENCES.notifyAccountEvents
    ),
    notifyUpdates: asBool(obj.notifyUpdates, DEFAULT_USER_PREFERENCES.notifyUpdates),
    textScale: asEnum(
      obj.textScale,
      ['normal', 'large', 'xlarge'] as const,
      DEFAULT_USER_PREFERENCES.textScale
    ),
    highContrast: asBool(obj.highContrast, DEFAULT_USER_PREFERENCES.highContrast),
    reduceMotion: asBool(obj.reduceMotion, DEFAULT_USER_PREFERENCES.reduceMotion),
    highlightSelectionStrong: asBool(
      obj.highlightSelectionStrong,
      DEFAULT_USER_PREFERENCES.highlightSelectionStrong
    ),
    showPatternMarkers: asBool(obj.showPatternMarkers, DEFAULT_USER_PREFERENCES.showPatternMarkers),
  };
}

/** Sanitize an optional user display name (falls back to username if blank). */
export function sanitizeDisplayName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const cleaned = input.replace(/[<>]/g, '').trim().replace(/\s+/g, ' ');
  if (cleaned.length < 2 || cleaned.length > 24) {
    throw new Error('Le nom affiché doit contenir entre 2 et 24 caractères.');
  }
  if (/\(invit[eé]\)/i.test(cleaned)) {
    throw new Error('Ce nom contient une mention réservée.');
  }
  return cleaned;
}

// ============================================================================
// REAL PROFILE COSMETICS (Earned solely from genuine gameplay stats)
// ============================================================================

export type ProfileBannerId =
  | 'classic'
  | 'tactical_grid'
  | 'victor_crest'
  | 'veteran_banner'
  | 'elo_master';

export type ProfileTitleId =
  | 'recrue'
  | 'vainqueur'
  | 'veteran'
  | 'chasseur'
  | 'tacticien_elo'
  | 'tireur_elite';

export type ProfileAchievementId =
  | 'first_win'
  | 'five_games'
  | 'ten_eliminations'
  | 'traqueur_mark'
  | 'executeur_pierce'
  | 'arbaletrier_shot'
  | 'colossus_breaker'
  | 'elo_225';

export interface ProfileStatsSnapshot {
  readonly wins: number;
  readonly gamesPlayed: number;
  readonly eloRating: number;
  readonly totalEliminations: number;
  readonly newMechanicsStats?: Partial<NewMechanicsStats> | null;
}

export interface CosmeticItemState<T extends string> {
  readonly id: T;
  readonly label: string;
  readonly requirementLabel: string;
  readonly unlocked: boolean;
}

export interface ProfileCosmeticsCatalog {
  readonly banners: readonly CosmeticItemState<ProfileBannerId>[];
  readonly titles: readonly CosmeticItemState<ProfileTitleId>[];
  readonly badges: readonly CosmeticItemState<ProfileAchievementId>[];
}

/**
 * Compute unlocked profile banners, titles, and achievement badges from real player metrics.
 * No synthetic or disconnected rewards exist here.
 */
export function computeProfileCosmetics(stats: ProfileStatsSnapshot): ProfileCosmeticsCatalog {
  const nm = stats.newMechanicsStats ?? {};
  const wins = Number(stats.wins ?? 0);
  const games = Number(stats.gamesPlayed ?? 0);
  const elo = Number(stats.eloRating ?? 200);
  const elims = Number(stats.totalEliminations ?? 0);

  return {
    banners: [
      {
        id: 'classic',
        label: 'Bannière Standard',
        requirementLabel: 'Disponible dès la création du compte',
        unlocked: true,
      },
      {
        id: 'tactical_grid',
        label: 'Bannière Damier Stratégique',
        requirementLabel: 'Disponible pour tous les commandants',
        unlocked: true,
      },
      {
        id: 'victor_crest',
        label: 'Bannière du Vainqueur',
        requirementLabel: 'Obtenir 1 victoire officielle',
        unlocked: wins >= 1,
      },
      {
        id: 'veteran_banner',
        label: 'Bannière des Vétérans',
        requirementLabel: 'Jouer au moins 5 parties',
        unlocked: games >= 5,
      },
      {
        id: 'elo_master',
        label: 'Bannière Souveraine ELO',
        requirementLabel: 'Atteindre 225 ELO ou 15 éliminations',
        unlocked: elo >= 225 || elims >= 15,
      },
    ],
    titles: [
      {
        id: 'recrue',
        label: 'Commandant',
        requirementLabel: 'Titre par défaut',
        unlocked: true,
      },
      {
        id: 'vainqueur',
        label: 'Vainqueur',
        requirementLabel: '1+ victoire enregistrée',
        unlocked: wins >= 1,
      },
      {
        id: 'veteran',
        label: 'Vétéran du 9×9',
        requirementLabel: '5+ parties jouées',
        unlocked: games >= 5,
      },
      {
        id: 'chasseur',
        label: 'Chasseur de Rôles',
        requirementLabel: '10+ éliminations totales',
        unlocked: elims >= 10,
      },
      {
        id: 'tacticien_elo',
        label: 'Maître ELO',
        requirementLabel: 'Atteindre 225 ELO',
        unlocked: elo >= 225,
      },
      {
        id: 'tireur_elite',
        label: 'Tireur d’Élite',
        requirementLabel: '3+ tirs réussis à l’Arbalétrier',
        unlocked: Number(nm.arbaletrierShotsSucceeded ?? 0) >= 3,
      },
    ],
    badges: [
      {
        id: 'first_win',
        label: 'Première Victoire',
        requirementLabel: '1 victoire',
        unlocked: wins >= 1,
      },
      {
        id: 'five_games',
        label: 'Assidu (5 parties)',
        requirementLabel: '5 parties jouées',
        unlocked: games >= 5,
      },
      {
        id: 'ten_eliminations',
        label: '10 Éliminations',
        requirementLabel: '10 éliminations en partie',
        unlocked: elims >= 10,
      },
      {
        id: 'traqueur_mark',
        label: 'Œil du Traqueur',
        requirementLabel: '1+ poursuite Traqueur réussie',
        unlocked: Number(nm.traqueurPursuitsSucceeded ?? 0) >= 1,
      },
      {
        id: 'executeur_pierce',
        label: 'Lame Traversante',
        requirementLabel: '1+ frappe traversante de l’Exécuteur',
        unlocked: Number(nm.executeurPiercingStrikes ?? 0) >= 1,
      },
      {
        id: 'arbaletrier_shot',
        label: 'Carreau Mortel',
        requirementLabel: '1+ tir réussi à l’Arbalétrier',
        unlocked: Number(nm.arbaletrierShotsSucceeded ?? 0) >= 1,
      },
      {
        id: 'colossus_breaker',
        label: 'Briseur de Colosse',
        requirementLabel: '1+ Colosse abattu par 2 Kamikazes',
        unlocked: Number(nm.colossiEliminatedByKamikaze ?? 0) >= 1,
      },
      {
        id: 'elo_225',
        label: 'Ascension ELO',
        requirementLabel: 'Atteindre 225 ELO',
        unlocked: elo >= 225,
      },
    ],
  };
}

export type NotificationCategory =
  | 'invitation'
  | 'match_start'
  | 'message'
  | 'account'
  | 'update';

export interface ClientNotificationItem {
  readonly id: string;
  readonly category: NotificationCategory;
  readonly title: string;
  readonly message: string;
  readonly createdAtIso: string;
  readonly read: boolean;
  readonly targetScreen?: string;
}
