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
  | 'classique'
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

export interface BoardInteractionPalette {
  readonly cellBorder: string;
  readonly cellHoverBorder: string;
  readonly selectionBg: string;
  readonly selectionBorder: string;
  readonly moveValidBg: string;
  readonly moveValidBorder: string;
  readonly attackValidBg: string;
  readonly attackValidBorder: string;
  readonly jumpValidBg: string;
  readonly jumpValidBorder: string;
  readonly specialZoneBg: string;
  readonly specialZoneBorder: string;
  readonly cardTargetBg: string;
  readonly cardTargetBorder: string;
  readonly reconGlow: string;
  readonly lastMoveFromBg: string;
  readonly lastMoveToBg: string;
  readonly lastMoveAccent: string;
  readonly boardHudBg: string;
  readonly boardHudBorder: string;
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
  /** Harmonious, non-garish camp palettes keeping clear Rouge vs Noir identity on every square. */
  readonly campRed: PieceMedallionPalette;
  readonly campBlack: PieceMedallionPalette;
  readonly allyBadgeBg: string;
  readonly allyBadgeText: string;
  readonly enemyBadgeBg: string;
  readonly enemyBadgeBorder: string;
  readonly enemyBadgeText: string;
  readonly interactions: BoardInteractionPalette;
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
      // Case rouge (#B51F2B) -> Pion Ardoise Satinée
      pieceOnA: {
        bgTop: '#4e5666',
        bgBottom: '#262b35',
        rimOuter: '#d4a34a',
        rimInner: '#fde68a',
        glyphMain: '#f8fafc',
        glyphAccent: '#e2b96f',
        glyphStroke: '#cbd5e1',
      },
      // Case noire (#171717) -> Pion Ivoire Doré
      pieceOnB: {
        bgTop: '#faf3e7',
        bgBottom: '#d8c7ae',
        rimOuter: '#9a2e38',
        rimInner: '#fffbf2',
        glyphMain: '#faf3e7',
        glyphAccent: '#a6343f',
        glyphStroke: '#1e1414',
      },
      pieceNeutral: {
        bgTop: '#525866',
        bgBottom: '#262a33',
        rimOuter: '#d97706',
        rimInner: '#fcd34d',
        glyphMain: '#fef3c7',
        glyphAccent: '#e5a94c',
        glyphStroke: '#18181b',
      },
      campRed: {
        bgTop: '#FAF3E7',
        bgBottom: '#D8C7AE',
        rimOuter: '#9A2E38',
        rimInner: '#FFFBF2',
        glyphMain: '#FAF3E7',
        glyphAccent: '#A6343F',
        glyphStroke: '#1E1414',
      },
      campBlack: {
        bgTop: '#525B6B',
        bgBottom: '#292F3B',
        rimOuter: '#CBD5E1',
        rimInner: '#E2E8F0',
        glyphMain: '#F1F5F9',
        glyphAccent: '#E2B96F',
        glyphStroke: '#CBD5E1',
      },
      allyBadgeBg: 'rgba(15, 23, 42, 0.86)',
      allyBadgeText: '#fde68a',
      enemyBadgeBg: 'rgba(9, 10, 13, 0.92)',
      enemyBadgeBorder: '#ef4444',
      enemyBadgeText: '#fecaca',
      interactions: {
        cellBorder: 'rgba(255, 255, 255, 0.08)',
        cellHoverBorder: 'rgba(255, 255, 255, 0.45)',
        selectionBg: 'rgba(245, 158, 11, 0.34)',
        selectionBorder: '#f59e0b',
        moveValidBg: 'rgba(16, 185, 129, 0.3)',
        moveValidBorder: '#10b981',
        attackValidBg: 'rgba(254, 202, 202, 0.24)',
        attackValidBorder: '#fca5a5',
        jumpValidBg: 'rgba(245, 158, 11, 0.36)',
        jumpValidBorder: '#fbbf24',
        specialZoneBg: 'rgba(168, 85, 247, 0.3)',
        specialZoneBorder: '#a855f7',
        cardTargetBg: 'rgba(6, 182, 212, 0.24)',
        cardTargetBorder: '#06b6d4',
        reconGlow: 'rgba(6, 182, 212, 0.48)',
        lastMoveFromBg: 'rgba(250, 204, 21, 0.22)',
        lastMoveToBg: 'rgba(251, 146, 60, 0.28)',
        lastMoveAccent: '#fbbf24',
        boardHudBg: '#131217',
        boardHudBorder: '#543542',
      },
    },
  },

  classique: {
    id: 'classique',
    name: 'Classique',
    subtitle: 'Échiquier traditionnel ivoire & noyer chaleureux',
    swatchA: '#F0D9B5',
    swatchB: '#B58863',
    ui: {
      bgDeep: '#120f0c',
      bgRadialGlow: '#2b2118',
      bgNavbar: 'rgba(24, 19, 15, 0.95)',
      bgPanel: '#1b1612',
      bgPanelAlt: '#241e18',
      bgElevated: '#322921',
      border: '#47392d',
      borderBright: '#6e5742',
      accent: '#c0843d',
      accentBright: '#e3a85b',
      accentSoftBg: 'rgba(192, 132, 61, 0.22)',
      accentGlow: 'rgba(227, 168, 91, 0.38)',
      accentBadgeText: '#fde68a',
      btnPrimaryStart: '#b57b38',
      btnPrimaryEnd: '#855520',
      btnPrimaryHoverStart: '#cb8d44',
      btnPrimaryHoverEnd: '#9a6427',
      btnPrimaryText: '#fffbeb',
      btnPrimaryBorder: '#e3a85b',
      textPrimary: '#fdf8f0',
      textSecondary: '#e5d8c5',
      textMuted: '#b5a38d',
      notifBg: 'rgba(29, 23, 18, 0.96)',
      notifBorder: '#c0843d',
      notifAccent: '#fde68a',
      gold: '#f59e0b',
      green: '#22c55e',
      cyan: '#38bdf8',
      dangerText: '#fecaca',
      dangerBorder: '#ef4444',
      phaserPulseHex: 0xc0843d,
    },
    board: {
      squareA: '#F0D9B5',
      squareB: '#B58863',
      squareALabel: 'Ivoire',
      squareBLabel: 'Noyer',
      frameBg: '#231912',
      frameBorder: '#6e5037',
      coordOnA: 'rgba(84, 52, 26, 0.85)',
      coordOnB: 'rgba(255, 245, 228, 0.88)',
      // Case ivoire -> Pion Bois Foncé
      pieceOnA: {
        bgTop: '#4e3523',
        bgBottom: '#26180e',
        rimOuter: '#96683c',
        rimInner: '#f0d9b5',
        glyphMain: '#fff7e8',
        glyphAccent: '#e3a85b',
        glyphStroke: '#1a0f08',
      },
      // Case noyer -> Pion Ivoire Doré
      pieceOnB: {
        bgTop: '#fff7e6',
        bgBottom: '#d9be94',
        rimOuter: '#6e4926',
        rimInner: '#ffffff',
        glyphMain: '#382312',
        glyphAccent: '#8c5627',
        glyphStroke: '#1c1007',
      },
      pieceNeutral: {
        bgTop: '#704d31',
        bgBottom: '#3c2717',
        rimOuter: '#e0c093',
        rimInner: '#fff7e8',
        glyphMain: '#fffaf0',
        glyphAccent: '#f59e0b',
        glyphStroke: '#24160b',
      },
      campRed: {
        bgTop: '#C95A52',
        bgBottom: '#7E2827',
        rimOuter: '#EAD3A8',
        rimInner: '#FFF7E8',
        glyphMain: '#FDF3E1',
        glyphAccent: '#FCE7BA',
        glyphStroke: '#220E0E',
      },
      campBlack: {
        bgTop: '#4A4441',
        bgBottom: '#211D1B',
        rimOuter: '#D9C096',
        rimInner: '#F7EBD5',
        glyphMain: '#F5EAD6',
        glyphAccent: '#E2BA72',
        glyphStroke: '#120F0E',
      },
      allyBadgeBg: 'rgba(30, 21, 14, 0.9)',
      allyBadgeText: '#fde68a',
      enemyBadgeBg: 'rgba(30, 21, 14, 0.94)',
      enemyBadgeBorder: '#f59e0b',
      enemyBadgeText: '#fef3c7',
      interactions: {
        cellBorder: 'rgba(88, 57, 29, 0.25)',
        cellHoverBorder: 'rgba(255, 248, 232, 0.65)',
        selectionBg: 'rgba(217, 119, 6, 0.36)',
        selectionBorder: '#f59e0b',
        moveValidBg: 'rgba(22, 163, 74, 0.32)',
        moveValidBorder: '#22c55e',
        attackValidBg: 'rgba(185, 28, 28, 0.34)',
        attackValidBorder: '#ef4444',
        jumpValidBg: 'rgba(234, 179, 8, 0.38)',
        jumpValidBorder: '#eab308',
        specialZoneBg: 'rgba(126, 34, 206, 0.32)',
        specialZoneBorder: '#a855f7',
        cardTargetBg: 'rgba(2, 132, 199, 0.3)',
        cardTargetBorder: '#38bdf8',
        reconGlow: 'rgba(56, 189, 248, 0.5)',
        lastMoveFromBg: 'rgba(251, 191, 36, 0.28)',
        lastMoveToBg: 'rgba(245, 158, 11, 0.34)',
        lastMoveAccent: '#f59e0b',
        boardHudBg: '#241c15',
        boardHudBorder: '#6e5742',
      },
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
      campRed: {
        bgTop: '#CF6358',
        bgBottom: '#8A302C',
        rimOuter: '#EEEED2',
        rimInner: '#FAFBE8',
        glyphMain: '#FBFCEB',
        glyphAccent: '#F8EAC0',
        glyphStroke: '#230F0E',
      },
      campBlack: {
        bgTop: '#414A4B',
        bgBottom: '#1D2325',
        rimOuter: '#CBD5C0',
        rimInner: '#F1F5EC',
        glyphMain: '#F2F6EE',
        glyphAccent: '#DFC77B',
        glyphStroke: '#0E1213',
      },
      allyBadgeBg: 'rgba(22, 33, 18, 0.88)',
      allyBadgeText: '#EEEED2',
      enemyBadgeBg: 'rgba(22, 33, 18, 0.92)',
      enemyBadgeBorder: '#e8b948',
      enemyBadgeText: '#fef3c7',
      interactions: {
        cellBorder: 'rgba(34, 51, 24, 0.2)',
        cellHoverBorder: 'rgba(255, 255, 255, 0.65)',
        selectionBg: 'rgba(250, 204, 21, 0.42)',
        selectionBorder: '#eab308',
        moveValidBg: 'rgba(22, 163, 74, 0.32)',
        moveValidBorder: '#15803d',
        attackValidBg: 'rgba(220, 38, 38, 0.34)',
        attackValidBorder: '#dc2626',
        jumpValidBg: 'rgba(245, 158, 11, 0.42)',
        jumpValidBorder: '#d97706',
        specialZoneBg: 'rgba(147, 51, 234, 0.3)',
        specialZoneBorder: '#9333ea',
        cardTargetBg: 'rgba(14, 165, 233, 0.3)',
        cardTargetBorder: '#0284c7',
        reconGlow: 'rgba(14, 165, 233, 0.48)',
        lastMoveFromBg: 'rgba(253, 224, 71, 0.32)',
        lastMoveToBg: 'rgba(250, 204, 21, 0.42)',
        lastMoveAccent: '#facc15',
        boardHudBg: '#1c2619',
        boardHudBorder: '#56754e',
      },
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
      campRed: {
        bgTop: '#CE625E',
        bgBottom: '#8A3133',
        rimOuter: '#E4E4E7',
        rimInner: '#FAFAFA',
        glyphMain: '#FAF7F5',
        glyphAccent: '#FCE9DB',
        glyphStroke: '#210F10',
      },
      campBlack: {
        bgTop: '#565C68',
        bgBottom: '#292D36',
        rimOuter: '#B8BFC9',
        rimInner: '#E4E7EC',
        glyphMain: '#F4F4F5',
        glyphAccent: '#E2E8F0',
        glyphStroke: '#9EA6B4',
      },
      allyBadgeBg: 'rgba(15, 15, 18, 0.9)',
      allyBadgeText: '#fafafa',
      enemyBadgeBg: 'rgba(15, 15, 18, 0.94)',
      enemyBadgeBorder: '#f59e0b',
      enemyBadgeText: '#fde68a',
      interactions: {
        cellBorder: 'rgba(128, 128, 138, 0.25)',
        cellHoverBorder: '#ffffff',
        selectionBg: 'rgba(250, 204, 21, 0.35)',
        selectionBorder: '#facc15',
        moveValidBg: 'rgba(34, 197, 94, 0.28)',
        moveValidBorder: '#22c55e',
        attackValidBg: 'rgba(239, 68, 68, 0.32)',
        attackValidBorder: '#ef4444',
        jumpValidBg: 'rgba(245, 158, 11, 0.35)',
        jumpValidBorder: '#f59e0b',
        specialZoneBg: 'rgba(168, 85, 247, 0.3)',
        specialZoneBorder: '#a855f7',
        cardTargetBg: 'rgba(56, 189, 248, 0.28)',
        cardTargetBorder: '#38bdf8',
        reconGlow: 'rgba(56, 189, 248, 0.45)',
        lastMoveFromBg: 'rgba(212, 212, 216, 0.26)',
        lastMoveToBg: 'rgba(250, 204, 21, 0.34)',
        lastMoveAccent: '#facc15',
        boardHudBg: '#18181b',
        boardHudBorder: '#52525b',
      },
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
      campRed: {
        bgTop: '#CF685D',
        bgBottom: '#8C352F',
        rimOuter: '#DCE3EC',
        rimInner: '#F8FAFC',
        glyphMain: '#FCF7F2',
        glyphAccent: '#F9E6CE',
        glyphStroke: '#24100E',
      },
      campBlack: {
        bgTop: '#455064',
        bgBottom: '#1D2533',
        rimOuter: '#C8D4E3',
        rimInner: '#F1F5F9',
        glyphMain: '#F1F5F9',
        glyphAccent: '#BBD0EB',
        glyphStroke: '#AEBDD1',
      },
      allyBadgeBg: 'rgba(11, 22, 38, 0.88)',
      allyBadgeText: '#dbeafe',
      enemyBadgeBg: 'rgba(11, 22, 38, 0.92)',
      enemyBadgeBorder: '#93c5fd',
      enemyBadgeText: '#f1f5f9',
      interactions: {
        cellBorder: 'rgba(147, 197, 253, 0.22)',
        cellHoverBorder: '#dbeafe',
        selectionBg: 'rgba(250, 204, 21, 0.35)',
        selectionBorder: '#fbbf24',
        moveValidBg: 'rgba(52, 211, 153, 0.3)',
        moveValidBorder: '#10b981',
        attackValidBg: 'rgba(248, 113, 113, 0.32)',
        attackValidBorder: '#ef4444',
        jumpValidBg: 'rgba(251, 191, 36, 0.34)',
        jumpValidBorder: '#f59e0b',
        specialZoneBg: 'rgba(192, 132, 252, 0.3)',
        specialZoneBorder: '#a855f7',
        cardTargetBg: 'rgba(56, 189, 248, 0.34)',
        cardTargetBorder: '#38bdf8',
        reconGlow: 'rgba(56, 189, 248, 0.55)',
        lastMoveFromBg: 'rgba(147, 197, 253, 0.32)',
        lastMoveToBg: 'rgba(56, 189, 248, 0.38)',
        lastMoveAccent: '#60a5fa',
        boardHudBg: '#122136',
        boardHudBorder: '#4670ab',
      },
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
      campRed: {
        bgTop: '#FAF0E0',
        bgBottom: '#D6BFA0',
        rimOuter: '#9A4036',
        rimInner: '#FFFBF2',
        glyphMain: '#FAF0E0',
        glyphAccent: '#A6413B',
        glyphStroke: '#261610',
      },
      campBlack: {
        bgTop: '#4E4744',
        bgBottom: '#262220',
        rimOuter: '#D9BA82',
        rimInner: '#F7E7C4',
        glyphMain: '#F7EDE0',
        glyphAccent: '#EAC277',
        glyphStroke: '#C8B8A2',
      },
      allyBadgeBg: 'rgba(22, 16, 13, 0.88)',
      allyBadgeText: '#fde68a',
      enemyBadgeBg: 'rgba(22, 16, 13, 0.92)',
      enemyBadgeBorder: '#f59e0b',
      enemyBadgeText: '#fef3c7',
      interactions: {
        cellBorder: 'rgba(229, 169, 76, 0.14)',
        cellHoverBorder: '#fde68a',
        selectionBg: 'rgba(251, 191, 36, 0.36)',
        selectionBorder: '#fbbf24',
        moveValidBg: 'rgba(52, 211, 153, 0.28)',
        moveValidBorder: '#34d399',
        attackValidBg: 'rgba(248, 113, 113, 0.32)',
        attackValidBorder: '#f87171',
        jumpValidBg: 'rgba(245, 158, 11, 0.38)',
        jumpValidBorder: '#f59e0b',
        specialZoneBg: 'rgba(168, 85, 247, 0.32)',
        specialZoneBorder: '#c084fc',
        cardTargetBg: 'rgba(56, 189, 248, 0.28)',
        cardTargetBorder: '#38bdf8',
        reconGlow: 'rgba(56, 189, 248, 0.48)',
        lastMoveFromBg: 'rgba(251, 191, 36, 0.24)',
        lastMoveToBg: 'rgba(229, 169, 76, 0.34)',
        lastMoveAccent: '#fbbf24',
        boardHudBg: '#1b1511',
        boardHudBorder: '#664d36',
      },
    },
  },
};

export const THEME_LIST: readonly BlindWarThemeDefinition[] = [
  BLIND_WAR_THEMES.rouge_et_noir,
  BLIND_WAR_THEMES.classique,
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

/** Resolve UI surface palette for dark or light display mode cleanly per theme. */
export function resolveThemeUiForColorMode(
  theme: BlindWarThemeDefinition,
  colorMode: 'dark' | 'light' = 'dark'
): ThemeUiPalette {
  if (colorMode === 'dark') {
    return theme.ui;
  }

  const lightAccents: Readonly<
    Record<
      ThemeId,
      {
        readonly bgDeep: string;
        readonly bgRadialGlow: string;
        readonly bgPanelAlt: string;
        readonly bgElevated: string;
        readonly border: string;
        readonly borderBright: string;
        readonly accentBadgeText: string;
        readonly btnPrimaryStart: string;
        readonly btnPrimaryEnd: string;
        readonly btnPrimaryHoverStart: string;
        readonly btnPrimaryHoverEnd: string;
        readonly btnPrimaryText: string;
        readonly btnPrimaryBorder: string;
        readonly dangerText: string;
        readonly gold: string;
        readonly green: string;
        readonly cyan: string;
      }
    >
  > = {
    rouge_et_noir: {
      bgDeep: '#f7f5f6',
      bgRadialGlow: '#fce7ea',
      bgPanelAlt: '#f2ecee',
      bgElevated: '#e6dce0',
      border: '#d6c6cc',
      borderBright: '#b38d97',
      accentBadgeText: '#88131d',
      btnPrimaryStart: '#B51F2B',
      btnPrimaryEnd: '#88131d',
      btnPrimaryHoverStart: '#dc2626',
      btnPrimaryHoverEnd: '#991b1b',
      btnPrimaryText: '#ffffff',
      btnPrimaryBorder: '#9f1239',
      dangerText: '#991b1b',
      gold: '#b45309',
      green: '#047857',
      cyan: '#0e7490',
    },
    classique: {
      bgDeep: '#f8f4ed',
      bgRadialGlow: '#efe3cf',
      bgPanelAlt: '#f0e7d8',
      bgElevated: '#e2d3bc',
      border: '#d0bc9f',
      borderBright: '#9c7d54',
      accentBadgeText: '#694015',
      btnPrimaryStart: '#9c6629',
      btnPrimaryEnd: '#734817',
      btnPrimaryHoverStart: '#b37833',
      btnPrimaryHoverEnd: '#87561d',
      btnPrimaryText: '#ffffff',
      btnPrimaryBorder: '#734817',
      dangerText: '#991b1b',
      gold: '#92400e',
      green: '#15803d',
      cyan: '#0369a1',
    },
    vert_et_beige: {
      bgDeep: '#f5f6f1',
      bgRadialGlow: '#e7f0de',
      bgPanelAlt: '#edf0e6',
      bgElevated: '#dde3d2',
      border: '#c6d1b8',
      borderBright: '#8da677',
      accentBadgeText: '#2f451d',
      btnPrimaryStart: '#5d7c40',
      btnPrimaryEnd: '#435d2c',
      btnPrimaryHoverStart: '#6c8f4b',
      btnPrimaryHoverEnd: '#4f6d34',
      btnPrimaryText: '#ffffff',
      btnPrimaryBorder: '#435d2c',
      dangerText: '#991b1b',
      gold: '#b45309',
      green: '#15803d',
      cyan: '#0369a1',
    },
    noir_et_blanc: {
      bgDeep: '#f4f4f5',
      bgRadialGlow: '#e4e4e7',
      bgPanelAlt: '#ececef',
      bgElevated: '#dfe0e5',
      border: '#cbd0d8',
      borderBright: '#949aa6',
      accentBadgeText: '#18181b',
      btnPrimaryStart: '#27272a',
      btnPrimaryEnd: '#09090b',
      btnPrimaryHoverStart: '#3f3f46',
      btnPrimaryHoverEnd: '#18181b',
      btnPrimaryText: '#ffffff',
      btnPrimaryBorder: '#09090b',
      dangerText: '#991b1b',
      gold: '#b45309',
      green: '#15803d',
      cyan: '#0369a1',
    },
    bleu_et_argent: {
      bgDeep: '#f2f6fb',
      bgRadialGlow: '#dbeafe',
      bgPanelAlt: '#e7eef7',
      bgElevated: '#d5e2f2',
      border: '#bfcfe4',
      borderBright: '#7da1cb',
      accentBadgeText: '#163c68',
      btnPrimaryStart: '#2864A5',
      btnPrimaryEnd: '#1b4778',
      btnPrimaryHoverStart: '#3175bf',
      btnPrimaryHoverEnd: '#21548d',
      btnPrimaryText: '#ffffff',
      btnPrimaryBorder: '#163c68',
      dangerText: '#991b1b',
      gold: '#b45309',
      green: '#047857',
      cyan: '#0369a1',
    },
    ambre_et_ebene: {
      bgDeep: '#faf6ef',
      bgRadialGlow: '#f6ead7',
      bgPanelAlt: '#f2eadc',
      bgElevated: '#e6d9c3',
      border: '#d6c3a5',
      borderBright: '#ac8854',
      accentBadgeText: '#66400d',
      btnPrimaryStart: '#9a671f',
      btnPrimaryEnd: '#734a11',
      btnPrimaryHoverStart: '#b37927',
      btnPrimaryHoverEnd: '#875715',
      btnPrimaryText: '#ffffff',
      btnPrimaryBorder: '#734a11',
      dangerText: '#991b1b',
      gold: '#92400e',
      green: '#047857',
      cyan: '#0e7490',
    },
  };

  const light = lightAccents[theme.id];
  return {
    ...theme.ui,
    bgDeep: light.bgDeep,
    bgRadialGlow: light.bgRadialGlow,
    bgNavbar: 'rgba(255, 255, 255, 0.94)',
    bgPanel: '#ffffff',
    bgPanelAlt: light.bgPanelAlt,
    bgElevated: light.bgElevated,
    border: light.border,
    borderBright: light.borderBright,
    accentSoftBg: 'rgba(15, 23, 42, 0.06)',
    accentBadgeText: light.accentBadgeText,
    btnPrimaryStart: light.btnPrimaryStart,
    btnPrimaryEnd: light.btnPrimaryEnd,
    btnPrimaryHoverStart: light.btnPrimaryHoverStart,
    btnPrimaryHoverEnd: light.btnPrimaryHoverEnd,
    btnPrimaryText: light.btnPrimaryText,
    btnPrimaryBorder: light.btnPrimaryBorder,
    textPrimary: '#0f172a',
    textSecondary: '#334155',
    textMuted: '#64748b',
    notifBg: 'rgba(255, 255, 255, 0.98)',
    notifBorder: light.borderBright,
    notifAccent: light.accentBadgeText,
    gold: light.gold,
    green: light.green,
    cyan: light.cyan,
    dangerText: light.dangerText,
  };
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

/** Resolve the balanced camp palette (`campRed`, `campBlack`, or neutral) for a piece under `boardTheme`. */
export function getThemedPiecePaletteForOwner(
  boardTheme: BlindWarThemeDefinition,
  owner: 'red' | 'black' | 'neutral'
): PieceMedallionPalette {
  if (owner === 'red') return boardTheme.board.campRed;
  if (owner === 'black') return boardTheme.board.campBlack;
  return boardTheme.board.pieceNeutral;
}

/** Compute relative sRGB luminance (0..1) from a `#RGB` or `#RRGGBB` hex string. */
export function getHexRelativeLuminance(hex: string): number {
  const cleaned = hex.trim().replace('#', '');
  if (cleaned.length !== 3 && cleaned.length !== 6) return 0.5;
  const full =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const linearize = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** Return true when a board square hex is dark enough to benefit from a luminous contour lift. */
export function isDarkBoardColor(hex: string): boolean {
  return getHexRelativeLuminance(hex) < 0.16;
}
