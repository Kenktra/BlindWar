import type { Coord } from '../types/core.js';

/**
 * Centralized theme system for BLIND WAR.
 *
 * Defines unified visual palettes for:
 * - Site shell (backgrounds, surfaces, nav, panels, buttons, borders, texts, notifications)
 * - 9x9 board squares (checkerboard Square A & Square B + highlights)
 * - Restored original piece medallions (adapted seamlessly to every theme with square-inversion)
 */

export type ThemeId =
  | 'rouge_et_noir'
  | 'vert_et_beige'
  | 'noir_et_blanc'
  | 'bleu_et_argent'
  | 'ambre_et_ebene';

export const DEFAULT_THEME_ID: ThemeId = 'rouge_et_noir';

export interface PieceMedallionPalette {
  readonly bgTop: string;
  readonly bgBottom: string;
  readonly rimOuter: string;
  readonly rimInner: string;
  readonly glyphMain: string;
  readonly glyphAccent: string;
  readonly glyphStroke: string;
}

export interface ThemeUiPalette {
  readonly bgDeep: string;
  readonly bgRadialGlow: string;
  readonly bgNavbar: string;
  readonly bgPanel: string;
  readonly bgPanelAlt: string;
  readonly bgElevated: string;
  readonly border: string;
  readonly borderBright: string;
  readonly accent: string;
  readonly accentBright: string;
  readonly accentSoftBg: string;
  readonly accentGlow: string;
  readonly accentBadgeText: string;
  readonly btnPrimaryStart: string;
  readonly btnPrimaryEnd: string;
  readonly btnPrimaryHoverStart: string;
  readonly btnPrimaryHoverEnd: string;
  readonly btnPrimaryText: string;
  readonly btnPrimaryBorder: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textMuted: string;
  readonly notifBg: string;
  readonly notifBorder: string;
  readonly notifAccent: string;
  readonly gold: string;
  readonly green: string;
  readonly cyan: string;
  readonly dangerText: string;
  readonly dangerBorder: string;
  readonly phaserPulseHex: number;
}

export interface ThemeBoardPalette {
  readonly squareA: string;
  readonly squareB: string;
  readonly squareALabel: string;
  readonly squareBLabel: string;
  readonly frameBg: string;
  readonly frameBorder: string;
  readonly coordOnA: string;
  readonly coordOnB: string;
  readonly pieceOnA: PieceMedallionPalette;
  readonly pieceOnB: PieceMedallionPalette;
  readonly pieceNeutral: PieceMedallionPalette;
  readonly allyBadgeBg: string;
  readonly allyBadgeText: string;
  readonly enemyBadgeBg: string;
  readonly enemyBadgeBorder: string;
  readonly enemyBadgeText: string;
}

export interface BlindWarThemeDefinition {
  readonly id: ThemeId;
  readonly name: string;
  readonly subtitle: string;
  readonly isDefault?: boolean;
  readonly swatchA: string;
  readonly swatchB: string;
  readonly ui: ThemeUiPalette;
  readonly board: ThemeBoardPalette;
}

export const BLIND_WAR_THEMES: Readonly<Record<ThemeId, BlindWarThemeDefinition>> = {
  rouge_et_noir: {
    id: 'rouge_et_noir',
    name: 'Rouge et noir',
    subtitle: 'Thème original de BLIND WAR',
    isDefault: true,
    swatchA: '#B51F2B',
    swatchB: '#171717',
    ui: {
      bgDeep: '#09090c',
      bgRadialGlow: '#290c12',
      bgNavbar: 'rgba(18, 16, 20, 0.94)',
      bgPanel: '#131217',
      bgPanelAlt: '#1a1820',
      bgElevated: '#26212b',
      border: '#342731',
      borderBright: '#543542',
      accent: '#B51F2B',
      accentBright: '#ef4444',
      accentSoftBg: 'rgba(181, 31, 43, 0.22)',
      accentGlow: 'rgba(181, 31, 43, 0.42)',
      accentBadgeText: '#fecaca',
      btnPrimaryStart: '#B51F2B',
      btnPrimaryEnd: '#7f111a',
      btnPrimaryHoverStart: '#dc2626',
      btnPrimaryHoverEnd: '#991b1b',
      btnPrimaryText: '#f8fafc',
      btnPrimaryBorder: '#ef4444',
      textPrimary: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      notifBg: 'rgba(26, 19, 24, 0.96)',
      notifBorder: '#B51F2B',
      notifAccent: '#fda4af',
      gold: '#f59e0b',
      green: '#10b981',
      cyan: '#06b6d4',
      dangerText: '#fca5a5',
      dangerBorder: '#dc2626',
      phaserPulseHex: 0xb51f2b,
    },
    board: {
      squareA: '#B51F2B',
      squareB: '#171717',
      squareALabel: 'Rouge',
      squareBLabel: 'Noir',
      frameBg: '#0b0a0d',
      frameBorder: '#47252d',
      coordOnA: 'rgba(255, 241, 242, 0.72)',
      coordOnB: 'rgba(226, 232, 240, 0.56)',
      // Case rouge (#B51F2B) -> Pion Noir
      pieceOnA: {
        bgTop: '#333842',
        bgBottom: '#090a0d',
        rimOuter: '#d4a34a',
        rimInner: '#fde68a',
        glyphMain: '#f8fafc',
        glyphAccent: '#ef4444',
        glyphStroke: '#090a0d',
      },
      // Case noire (#171717) -> Pion Rouge
      pieceOnB: {
        bgTop: '#c82332',
        bgBottom: '#4f0910',
        rimOuter: '#f59e0b',
        rimInner: '#fde68a',
        glyphMain: '#fffbeb',
        glyphAccent: '#fbbf24',
        glyphStroke: '#450a0a',
      },
      pieceNeutral: {
        bgTop: '#3f3f46',
        bgBottom: '#18181b',
        rimOuter: '#d97706',
        rimInner: '#fcd34d',
        glyphMain: '#fef3c7',
        glyphAccent: '#f59e0b',
        glyphStroke: '#18181b',
      },
      allyBadgeBg: 'rgba(15, 23, 42, 0.86)',
      allyBadgeText: '#fde68a',
      enemyBadgeBg: 'rgba(9, 10, 13, 0.92)',
      enemyBadgeBorder: '#ef4444',
      enemyBadgeText: '#fecaca',
    },
  },

  vert_et_beige: {
    id: 'vert_et_beige',
    name: 'Vert et beige',
    subtitle: 'Inspiré de l’ambiance visuelle de Chess.com',
    swatchA: '#769656',
    swatchB: '#EEEED2',
    ui: {
      bgDeep: '#101610',
      bgRadialGlow: '#20311d',
      bgNavbar: 'rgba(21, 30, 19, 0.94)',
      bgPanel: '#192217',
      bgPanelAlt: '#222e1f',
      bgElevated: '#2c3c28',
      border: '#394f34',
      borderBright: '#56754e',
      accent: '#769656',
      accentBright: '#8db567',
      accentSoftBg: 'rgba(118, 150, 86, 0.24)',
      accentGlow: 'rgba(118, 150, 86, 0.42)',
      accentBadgeText: '#EEEED2',
      btnPrimaryStart: '#769656',
      btnPrimaryEnd: '#4f6837',
      btnPrimaryHoverStart: '#87ab64',
      btnPrimaryHoverEnd: '#5d7b41',
      btnPrimaryText: '#fbfcef',
      btnPrimaryBorder: '#a3c77e',
      textPrimary: '#f6f8f1',
      textSecondary: '#d8e2ce',
      textMuted: '#a2b296',
      notifBg: 'rgba(24, 34, 22, 0.96)',
      notifBorder: '#769656',
      notifAccent: '#EEEED2',
      gold: '#e8b948',
      green: '#4ade80',
      cyan: '#38bdf8',
      dangerText: '#fecaca',
      dangerBorder: '#ef4444',
      phaserPulseHex: 0x769656,
    },
    board: {
      squareA: '#769656',
      squareB: '#EEEED2',
      squareALabel: 'Vert',
      squareBLabel: 'Beige',
      frameBg: '#161f14',
      frameBorder: '#4c6643',
      coordOnA: 'rgba(238, 238, 210, 0.85)',
      coordOnB: 'rgba(42, 59, 28, 0.82)',
      // Case verte -> Pion Beige
      pieceOnA: {
        bgTop: '#fbfbec',
        bgBottom: '#cbcca4',
        rimOuter: '#496331',
        rimInner: '#84a860',
        glyphMain: '#243318',
        glyphAccent: '#58783a',
        glyphStroke: '#15200d',
      },
      // Case beige -> Pion Vert
      pieceOnB: {
        bgTop: '#6c8d4c',
        bgBottom: '#31451f',
        rimOuter: '#e6e4b8',
        rimInner: '#ffffff',
        glyphMain: '#fbfcee',
        glyphAccent: '#e2cc6b',
        glyphStroke: '#1b290f',
      },
      pieceNeutral: {
        bgTop: '#56703d',
        bgBottom: '#2b3a1e',
        rimOuter: '#d9d9b2',
        rimInner: '#EEEED2',
        glyphMain: '#fafbe8',
        glyphAccent: '#e2cc6b',
        glyphStroke: '#1b2612',
      },
      allyBadgeBg: 'rgba(22, 33, 18, 0.88)',
      allyBadgeText: '#EEEED2',
      enemyBadgeBg: 'rgba(22, 33, 18, 0.92)',
      enemyBadgeBorder: '#e8b948',
      enemyBadgeText: '#fef3c7',
    },
  },

  noir_et_blanc: {
    id: 'noir_et_blanc',
    name: 'Noir et blanc',
    subtitle: 'Un style sobre et classique',
    swatchA: '#F5F5F5',
    swatchB: '#202020',
    ui: {
      bgDeep: '#0c0c0e',
      bgRadialGlow: '#1f1f24',
      bgNavbar: 'rgba(18, 18, 21, 0.95)',
      bgPanel: '#151518',
      bgPanelAlt: '#1d1d22',
      bgElevated: '#282830',
      border: '#35353f',
      borderBright: '#565664',
      accent: '#d4d4d8',
      accentBright: '#ffffff',
      accentSoftBg: 'rgba(245, 245, 245, 0.14)',
      accentGlow: 'rgba(245, 245, 245, 0.28)',
      accentBadgeText: '#fafafa',
      btnPrimaryStart: '#F5F5F5',
      btnPrimaryEnd: '#d4d4d8',
      btnPrimaryHoverStart: '#ffffff',
      btnPrimaryHoverEnd: '#e4e4e7',
      btnPrimaryText: '#141417',
      btnPrimaryBorder: '#ffffff',
      textPrimary: '#fafafa',
      textSecondary: '#d4d4d8',
      textMuted: '#9ca3af',
      notifBg: 'rgba(22, 22, 26, 0.96)',
      notifBorder: '#a1a1aa',
      notifAccent: '#ffffff',
      gold: '#f59e0b',
      green: '#22c55e',
      cyan: '#38bdf8',
      dangerText: '#fecaca',
      dangerBorder: '#f87171',
      phaserPulseHex: 0xd4d4d8,
    },
    board: {
      squareA: '#F5F5F5',
      squareB: '#202020',
      squareALabel: 'Blanc',
      squareBLabel: 'Noir',
      frameBg: '#121215',
      frameBorder: '#44444f',
      coordOnA: 'rgba(24, 24, 27, 0.78)',
      coordOnB: 'rgba(245, 245, 245, 0.75)',
      // Case blanche -> Pion Noir
      pieceOnA: {
        bgTop: '#36363c',
        bgBottom: '#0f0f12',
        rimOuter: '#71717a',
        rimInner: '#e4e4e7',
        glyphMain: '#ffffff',
        glyphAccent: '#d4d4d8',
        glyphStroke: '#09090b',
      },
      // Case noire -> Pion Blanc
      pieceOnB: {
        bgTop: '#ffffff',
        bgBottom: '#cfd0d6',
        rimOuter: '#52525b',
        rimInner: '#a1a1aa',
        glyphMain: '#18181b',
        glyphAccent: '#52525b',
        glyphStroke: '#f4f4f5',
      },
      pieceNeutral: {
        bgTop: '#3f3f46',
        bgBottom: '#18181b',
        rimOuter: '#a1a1aa',
        rimInner: '#f4f4f5',
        glyphMain: '#ffffff',
        glyphAccent: '#d4d4d8',
        glyphStroke: '#09090b',
      },
      allyBadgeBg: 'rgba(15, 15, 18, 0.9)',
      allyBadgeText: '#fafafa',
      enemyBadgeBg: 'rgba(15, 15, 18, 0.94)',
      enemyBadgeBorder: '#f59e0b',
      enemyBadgeText: '#fde68a',
    },
  },

  bleu_et_argent: {
    id: 'bleu_et_argent',
    name: 'Bleu et argent',
    subtitle: 'Un style moderne et froid',
    swatchA: '#2864A5',
    swatchB: '#C8D0D9',
    ui: {
      bgDeep: '#09111c',
      bgRadialGlow: '#132a47',
      bgNavbar: 'rgba(13, 24, 40, 0.94)',
      bgPanel: '#101d2f',
      bgPanelAlt: '#162740',
      bgElevated: '#1f3657',
      border: '#2b476e',
      borderBright: '#4670ab',
      accent: '#2864A5',
      accentBright: '#60a5fa',
      accentSoftBg: 'rgba(40, 100, 165, 0.25)',
      accentGlow: 'rgba(59, 130, 246, 0.38)',
      accentBadgeText: '#dbeafe',
      btnPrimaryStart: '#2864A5',
      btnPrimaryEnd: '#1a4270',
      btnPrimaryHoverStart: '#347bc7',
      btnPrimaryHoverEnd: '#225590',
      btnPrimaryText: '#f8fafc',
      btnPrimaryBorder: '#93c5fd',
      textPrimary: '#f1f6fc',
      textSecondary: '#C8D0D9',
      textMuted: '#8ea3bc',
      notifBg: 'rgba(15, 29, 48, 0.96)',
      notifBorder: '#3b82f6',
      notifAccent: '#dbeafe',
      gold: '#fbbf24',
      green: '#34d399',
      cyan: '#38bdf8',
      dangerText: '#fecaca',
      dangerBorder: '#f87171',
      phaserPulseHex: 0x2864a5,
    },
    board: {
      squareA: '#2864A5',
      squareB: '#C8D0D9',
      squareALabel: 'Bleu',
      squareBLabel: 'Argent',
      frameBg: '#0b1626',
      frameBorder: '#385d8f',
      coordOnA: 'rgba(240, 246, 255, 0.82)',
      coordOnB: 'rgba(20, 46, 80, 0.8)',
      // Case bleue -> Pion Argent
      pieceOnA: {
        bgTop: '#edf2f7',
        bgBottom: '#9ba8b8',
        rimOuter: '#1c4a7d',
        rimInner: '#ffffff',
        glyphMain: '#122947',
        glyphAccent: '#2864A5',
        glyphStroke: '#0b1c33',
      },
      // Case argent -> Pion Bleu
      pieceOnB: {
        bgTop: '#3174bd',
        bgBottom: '#153963',
        rimOuter: '#dce3eb',
        rimInner: '#ffffff',
        glyphMain: '#f8fbff',
        glyphAccent: '#93c5fd',
        glyphStroke: '#091b33',
      },
      pieceNeutral: {
        bgTop: '#2864A5',
        bgBottom: '#143359',
        rimOuter: '#C8D0D9',
        rimInner: '#f1f5f9',
        glyphMain: '#f8fafc',
        glyphAccent: '#93c5fd',
        glyphStroke: '#0c1f36',
      },
      allyBadgeBg: 'rgba(11, 22, 38, 0.88)',
      allyBadgeText: '#dbeafe',
      enemyBadgeBg: 'rgba(11, 22, 38, 0.92)',
      enemyBadgeBorder: '#93c5fd',
      enemyBadgeText: '#f1f5f9',
    },
  },

  ambre_et_ebene: {
    id: 'ambre_et_ebene',
    name: 'Ambre et ébène',
    subtitle: 'Boiserie noble or et ébène',
    swatchA: '#A8742A',
    swatchB: '#1E1815',
    ui: {
      bgDeep: '#0d0a09',
      bgRadialGlow: '#291c11',
      bgNavbar: 'rgba(22, 17, 14, 0.94)',
      bgPanel: '#161210',
      bgPanelAlt: '#201a16',
      bgElevated: '#2d241d',
      border: '#3f3126',
      borderBright: '#664d36',
      accent: '#A8742A',
      accentBright: '#e5a94c',
      accentSoftBg: 'rgba(168, 116, 42, 0.24)',
      accentGlow: 'rgba(229, 169, 76, 0.36)',
      accentBadgeText: '#fde68a',
      btnPrimaryStart: '#A8742A',
      btnPrimaryEnd: '#734d17',
      btnPrimaryHoverStart: '#c78a34',
      btnPrimaryHoverEnd: '#8c5e1c',
      btnPrimaryText: '#fffbeb',
      btnPrimaryBorder: '#fbbf24',
      textPrimary: '#fdf8f2',
      textSecondary: '#dfd3c3',
      textMuted: '#a89987',
      notifBg: 'rgba(27, 21, 17, 0.96)',
      notifBorder: '#d97706',
      notifAccent: '#fde68a',
      gold: '#fbbf24',
      green: '#34d399',
      cyan: '#38bdf8',
      dangerText: '#fecaca',
      dangerBorder: '#f87171',
      phaserPulseHex: 0xa8742a,
    },
    board: {
      squareA: '#A8742A',
      squareB: '#1E1815',
      squareALabel: 'Ambre',
      squareBLabel: 'Ébène',
      frameBg: '#120e0c',
      frameBorder: '#574029',
      coordOnA: 'rgba(255, 248, 232, 0.8)',
      coordOnB: 'rgba(224, 206, 178, 0.65)',
      pieceOnA: {
        bgTop: '#2e2521',
        bgBottom: '#0e0b09',
        rimOuter: '#e5a94c',
        rimInner: '#fde68a',
        glyphMain: '#fdf8f2',
        glyphAccent: '#e5a94c',
        glyphStroke: '#120d0a',
      },
      pieceOnB: {
        bgTop: '#c98d36',
        bgBottom: '#6e4713',
        rimOuter: '#f5d28c',
        rimInner: '#fffbeb',
        glyphMain: '#fffbeb',
        glyphAccent: '#fde68a',
        glyphStroke: '#422807',
      },
      pieceNeutral: {
        bgTop: '#4a382b',
        bgBottom: '#1c1410',
        rimOuter: '#d97706',
        rimInner: '#fde68a',
        glyphMain: '#fef3c7',
        glyphAccent: '#f59e0b',
        glyphStroke: '#18110c',
      },
      allyBadgeBg: 'rgba(22, 16, 13, 0.88)',
      allyBadgeText: '#fde68a',
      enemyBadgeBg: 'rgba(22, 16, 13, 0.92)',
      enemyBadgeBorder: '#f59e0b',
      enemyBadgeText: '#fef3c7',
    },
  },
};

export const THEME_LIST: readonly BlindWarThemeDefinition[] = [
  BLIND_WAR_THEMES.rouge_et_noir,
  BLIND_WAR_THEMES.vert_et_beige,
  BLIND_WAR_THEMES.noir_et_blanc,
  BLIND_WAR_THEMES.bleu_et_argent,
  BLIND_WAR_THEMES.ambre_et_ebene,
];

const THEME_ID_SET: ReadonlySet<string> = new Set<string>(Object.keys(BLIND_WAR_THEMES));

/** Check whether a value is one of the registered theme IDs. */
export function isValidThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEME_ID_SET.has(value);
}

/** Resolve any theme ID safely, falling back cleanly to `'rouge_et_noir'`. */
export function getThemeDefinition(themeId?: string | null): BlindWarThemeDefinition {
  if (isValidThemeId(themeId)) {
    return BLIND_WAR_THEMES[themeId];
  }
  return BLIND_WAR_THEMES[DEFAULT_THEME_ID];
}

/**
 * Determine which checkerboard slot (`'a'` vs `'b'`) sits at `coord`.
 * `(row + col)` even -> `'a'`; `(row + col)` odd -> `'b'`.
 */
export function getBoardSquareSlot(coord: Coord): 'a' | 'b' {
  return Math.abs(coord.row + coord.col) % 2 === 0 ? 'a' : 'b';
}

/**
 * Return the inverted medallion palette for a piece placed on `coord` under `boardTheme`.
 * - Piece on Square A uses `pieceOnA` (opposite contrast color in the theme).
 * - Piece on Square B uses `pieceOnB`.
 */
export function getThemedPiecePaletteAtCoord(
  boardTheme: BlindWarThemeDefinition,
  coord: Coord
): { readonly slot: 'a' | 'b'; readonly palette: PieceMedallionPalette } {
  const slot = getBoardSquareSlot(coord);
  return {
    slot,
    palette: slot === 'a' ? boardTheme.board.pieceOnA : boardTheme.board.pieceOnB,
  };
}
