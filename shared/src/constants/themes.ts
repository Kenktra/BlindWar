import type { CardType, Coord } from '../types/core.js';

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
        bgTop: '#FCF5E8',
        bgBottom: '#E0D0B8',
        rimOuter: '#9A2E38',
        rimInner: '#FFFBF2',
        glyphMain: '#FCF5E8',
        glyphAccent: '#9A303B',
        glyphStroke: '#140D0E',
      },
      campBlack: {
        bgTop: '#212630',
        bgBottom: '#11141B',
        rimOuter: '#F1F5F9',
        rimInner: '#FFFFFF',
        glyphMain: '#F8FAFC',
        glyphAccent: '#E5BD72',
        glyphStroke: '#F8FAFC',
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
        bgTop: '#FFFBF0',
        bgBottom: '#E4D0AB',
        rimOuter: '#9E6B3B',
        rimInner: '#FFFFFF',
        glyphMain: '#FFFBF0',
        glyphAccent: '#823D1B',
        glyphStroke: '#1A0E06',
      },
      campBlack: {
        bgTop: '#1C1410',
        bgBottom: '#100B09',
        rimOuter: '#FFFDF8',
        rimInner: '#FFFFFF',
        glyphMain: '#FAF0DC',
        glyphAccent: '#E4BA72',
        glyphStroke: '#FFFDF8',
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
        bgTop: '#FCFBF0',
        bgBottom: '#E0DFBC',
        rimOuter: '#46692A',
        rimInner: '#FFFFFF',
        glyphMain: '#FCFBF0',
        glyphAccent: '#395A22',
        glyphStroke: '#121C0B',
      },
      campBlack: {
        bgTop: '#1F2B20',
        bgBottom: '#101711',
        rimOuter: '#F6F7E8',
        rimInner: '#FFFFFF',
        glyphMain: '#F2F6EE',
        glyphAccent: '#E5CA70',
        glyphStroke: '#F6F7E8',
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
        bgTop: '#FFFFFF',
        bgBottom: '#E0E3EB',
        rimOuter: '#3F4452',
        rimInner: '#FFFFFF',
        glyphMain: '#FFFFFF',
        glyphAccent: '#3F4452',
        glyphStroke: '#141418',
      },
      campBlack: {
        bgTop: '#343944',
        bgBottom: '#14171D',
        rimOuter: '#E5E7EB',
        rimInner: '#F8FAFC',
        glyphMain: '#F4F4F5',
        glyphAccent: '#F4F4F5',
        glyphStroke: '#E5E7EB',
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
        bgTop: '#F8FBFF',
        bgBottom: '#CFE2F6',
        rimOuter: '#235894',
        rimInner: '#FFFFFF',
        glyphMain: '#F8FBFF',
        glyphAccent: '#235894',
        glyphStroke: '#0B1A30',
      },
      campBlack: {
        bgTop: '#152033',
        bgBottom: '#0B121E',
        rimOuter: '#FFFFFF',
        rimInner: '#FFFFFF',
        glyphMain: '#F1F5F9',
        glyphAccent: '#A6C9F0',
        glyphStroke: '#FFFFFF',
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
        bgTop: '#FCF4E6',
        bgBottom: '#DBC4A2',
        rimOuter: '#9A4036',
        rimInner: '#FFFDF7',
        glyphMain: '#FCF4E6',
        glyphAccent: '#964522',
        glyphStroke: '#170D08',
      },
      campBlack: {
        bgTop: '#251F1D',
        bgBottom: '#13100E',
        rimOuter: '#FAF0DC',
        rimInner: '#FFFFFF',
        glyphMain: '#F7EDE0',
        glyphAccent: '#EBC375',
        glyphStroke: '#FAF0DC',
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

function parseHexRgb(hex: string): [number, number, number] {
  const cleaned = hex.trim().replace('#', '');
  const full =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned.slice(0, 6);
  if (full.length !== 6) return [128, 128, 128];
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
  );
}

/** Blend an `rgba(r, g, b, a)` or `#RRGGBB` overlay color over a base hex square color. */
export function blendOverlayOverHex(baseHex: string, overlayColor: string): string {
  const baseRgb = parseHexRgb(baseHex);
  const rgbaMatch = overlayColor
    .trim()
    .match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (rgbaMatch) {
    const r = Number(rgbaMatch[1]);
    const g = Number(rgbaMatch[2]);
    const b = Number(rgbaMatch[3]);
    const a = rgbaMatch[4] !== undefined ? Math.max(0, Math.min(1, Number(rgbaMatch[4]))) : 1;
    return rgbToHex(
      baseRgb[0] * (1 - a) + r * a,
      baseRgb[1] * (1 - a) + g * a,
      baseRgb[2] * (1 - a) + b * a,
    );
  }
  if (overlayColor.trim().startsWith('#')) {
    return overlayColor.trim();
  }
  return baseHex;
}

/** Compute WCAG contrast ratio (>= 1.0) between two `#RRGGBB` colors. */
export function getContrastRatioBetweenHex(hexA: string, hexB: string): number {
  const lumA = getHexRelativeLuminance(hexA);
  const lumB = getHexRelativeLuminance(hexB);
  const bright = Math.max(lumA, lumB);
  const dark = Math.min(lumA, lumB);
  return (bright + 0.05) / (dark + 0.05);
}

export interface CustomThemePiecePaletteSpec {
  readonly lightCampTop: string;
  readonly lightCampBottom: string;
  readonly lightCampAccent: string;
  readonly lightCampStroke?: string;
  readonly darkCampTop: string;
  readonly darkCampBottom: string;
  readonly darkCampAccent: string;
  readonly darkCampStroke?: string;
}

/**
 * Centralized extensible helper: generating any future theme's dual-camp piece palettes requires
 * only specifying its color palette — zero SVG asset duplication needed.
 */
export function createCustomThemePiecePalettes(spec: CustomThemePiecePaletteSpec): {
  readonly campRed: PieceMedallionPalette;
  readonly campBlack: PieceMedallionPalette;
  readonly pieceOnA: PieceMedallionPalette;
  readonly pieceOnB: PieceMedallionPalette;
  readonly pieceNeutral: PieceMedallionPalette;
} {
  const campRed: PieceMedallionPalette = {
    bgTop: spec.lightCampTop,
    bgBottom: spec.lightCampBottom,
    rimOuter: spec.lightCampAccent,
    rimInner: '#FFFFFF',
    glyphMain: spec.lightCampTop,
    glyphAccent: spec.lightCampAccent,
    glyphStroke: spec.lightCampStroke ?? '#18181B',
  };
  const campBlack: PieceMedallionPalette = {
    bgTop: spec.darkCampTop,
    bgBottom: spec.darkCampBottom,
    rimOuter: spec.darkCampStroke ?? '#E2E8F0',
    rimInner: '#F8FAFC',
    glyphMain: '#F8FAFC',
    glyphAccent: spec.darkCampAccent,
    glyphStroke: spec.darkCampStroke ?? '#E2E8F0',
  };
  return {
    campRed,
    campBlack,
    pieceOnA: campBlack,
    pieceOnB: campRed,
    pieceNeutral: campBlack,
  };
}

export type BoardSquareVisualState = 'squareA' | 'squareB' | 'selected' | 'moveValid' | 'attackValid';

export interface PieceSurfaceContrastReport {
  readonly state: BoardSquareVisualState;
  readonly slot: 'a' | 'b';
  readonly owner: 'red' | 'black';
  readonly surfaceHex: string;
  readonly fillContrast: number;
  readonly strokeContrast: number;
  readonly effectiveVisibilityContrast: number;
}

/**
 * Compute objective contrast checks across light/dark squares and selected/move/attack states
 * for both Camp Red and Camp Black under any `BlindWarThemeDefinition`.
 */
export function verifyThemePieceContrastAcrossSquareStates(
  theme: BlindWarThemeDefinition
): readonly PieceSurfaceContrastReport[] {
  const reports: PieceSurfaceContrastReport[] = [];
  const slots: readonly { readonly slot: 'a' | 'b'; readonly hex: string }[] = [
    { slot: 'a', hex: theme.board.squareA },
    { slot: 'b', hex: theme.board.squareB },
  ];

  for (const s of slots) {
    const surfaceEntries: readonly { readonly state: BoardSquareVisualState; readonly hex: string }[] = [
      { state: s.slot === 'a' ? 'squareA' : 'squareB', hex: s.hex },
      { state: 'selected', hex: blendOverlayOverHex(s.hex, theme.board.interactions.selectionBg) },
      { state: 'moveValid', hex: blendOverlayOverHex(s.hex, theme.board.interactions.moveValidBg) },
      { state: 'attackValid', hex: blendOverlayOverHex(s.hex, theme.board.interactions.attackValidBg) },
    ];

    for (const owner of ['red', 'black'] as const) {
      const palette = getThemedPiecePaletteForOwner(theme, owner);
      for (const surf of surfaceEntries) {
        const fillContrast = getContrastRatioBetweenHex(palette.bgTop, surf.hex);
        const strokeContrast = getContrastRatioBetweenHex(palette.glyphStroke, surf.hex);
        const effectiveVisibilityContrast = Math.max(fillContrast, strokeContrast);
        reports.push({
          state: surf.state,
          slot: s.slot,
          owner,
          surfaceHex: surf.hex,
          fillContrast,
          strokeContrast,
          effectiveVisibilityContrast,
        });
      }
    }
  }

  return reports;
}

export type CardPaletteRole = 'offense' | 'defense' | 'recon' | 'maneuver';

export interface CardArtworkPalette {
  readonly fillTop: string;
  readonly fillBottom: string;
  readonly stroke: string;
  readonly accent: string;
  readonly secondary: string;
  readonly frameBg: string;
  readonly frameBorder: string;
}

export const CARD_PALETTE_ROLES: Readonly<Record<CardType, CardPaletteRole>> = {
  kamikaze: 'offense',
  invincibilite: 'defense',
  block: 'defense',
  retreat: 'maneuver',
  revelation_temporaire: 'recon',
  revelation_permanente: 'recon',
  resurrection: 'maneuver',
  brouillard: 'recon',
  espionnage: 'recon',
  teleportation: 'maneuver',
  protection: 'defense',
  recrutement: 'maneuver',
  double_action: 'offense',
  piege: 'offense',
  contre_espionnage: 'defense',
  sacrifice: 'offense',
};

export function getCardPaletteRole(card: CardType): CardPaletteRole {
  return CARD_PALETTE_ROLES[card] ?? 'maneuver';
}

export interface CustomThemeCardPaletteSpec {
  readonly theme: BlindWarThemeDefinition;
  readonly colorMode?: 'dark' | 'light';
}

const BUILTIN_CARD_PALETTES: Readonly<
  Record<ThemeId, Readonly<Record<'dark' | 'light', Readonly<Record<CardPaletteRole, CardArtworkPalette>>>>>
> = {
  rouge_et_noir: {
    dark: {
      offense: {
        fillTop: '#dc2626',
        fillBottom: '#7f1d1d',
        stroke: '#fecaca',
        accent: '#fbbf24',
        secondary: '#18181b',
        frameBg: 'rgba(181, 31, 43, 0.2)',
        frameBorder: 'rgba(239, 68, 68, 0.58)',
      },
      defense: {
        fillTop: '#3f3f46',
        fillBottom: '#18181b',
        stroke: '#f8fafc',
        accent: '#ef4444',
        secondary: '#fca5a5',
        frameBg: 'rgba(39, 39, 42, 0.72)',
        frameBorder: 'rgba(248, 250, 252, 0.36)',
      },
      recon: {
        fillTop: '#b91c1c',
        fillBottom: '#27272a',
        stroke: '#f8fafc',
        accent: '#f59e0b',
        secondary: '#cbd5e1',
        frameBg: 'rgba(127, 29, 29, 0.28)',
        frameBorder: 'rgba(245, 158, 11, 0.5)',
      },
      maneuver: {
        fillTop: '#e4e4e7',
        fillBottom: '#a1a1aa',
        stroke: '#09090b',
        accent: '#dc2626',
        secondary: '#27272a',
        frameBg: 'rgba(228, 228, 231, 0.14)',
        frameBorder: 'rgba(220, 38, 38, 0.55)',
      },
    },
    light: {
      offense: {
        fillTop: '#dc2626',
        fillBottom: '#991b1b',
        stroke: '#18181b',
        accent: '#fef08a',
        secondary: '#fee2e2',
        frameBg: 'rgba(220, 38, 38, 0.1)',
        frameBorder: 'rgba(185, 28, 28, 0.45)',
      },
      defense: {
        fillTop: '#27272a',
        fillBottom: '#09090b',
        stroke: '#18181b',
        accent: '#ef4444',
        secondary: '#f4f4f5',
        frameBg: 'rgba(24, 24, 27, 0.08)',
        frameBorder: 'rgba(24, 24, 27, 0.35)',
      },
      recon: {
        fillTop: '#991b1b',
        fillBottom: '#450a0a',
        stroke: '#18181b',
        accent: '#f59e0b',
        secondary: '#fef2f2',
        frameBg: 'rgba(153, 27, 27, 0.1)',
        frameBorder: 'rgba(180, 83, 9, 0.45)',
      },
      maneuver: {
        fillTop: '#52525b',
        fillBottom: '#27272a',
        stroke: '#09090b',
        accent: '#dc2626',
        secondary: '#e4e4e7',
        frameBg: 'rgba(82, 82, 91, 0.1)',
        frameBorder: 'rgba(220, 38, 38, 0.4)',
      },
    },
  },
  classique: {
    dark: {
      offense: {
        fillTop: '#c2410c',
        fillBottom: '#7c2d12',
        stroke: '#fef3c7',
        accent: '#fbbf24',
        secondary: '#f0d9b5',
        frameBg: 'rgba(194, 65, 12, 0.22)',
        frameBorder: 'rgba(245, 158, 11, 0.55)',
      },
      defense: {
        fillTop: '#b58863',
        fillBottom: '#734f30',
        stroke: '#fdf8f0',
        accent: '#fbbf24',
        secondary: '#291d14',
        frameBg: 'rgba(181, 136, 99, 0.2)',
        frameBorder: 'rgba(240, 217, 181, 0.48)',
      },
      recon: {
        fillTop: '#f0d9b5',
        fillBottom: '#d4b483',
        stroke: '#2b1e16',
        accent: '#b45309',
        secondary: '#78350f',
        frameBg: 'rgba(240, 217, 181, 0.14)',
        frameBorder: 'rgba(227, 168, 91, 0.52)',
      },
      maneuver: {
        fillTop: '#d97706',
        fillBottom: '#92400e',
        stroke: '#fdf8f0',
        accent: '#fef3c7',
        secondary: '#451a03',
        frameBg: 'rgba(217, 119, 6, 0.2)',
        frameBorder: 'rgba(251, 191, 36, 0.5)',
      },
    },
    light: {
      offense: {
        fillTop: '#b91c1c',
        fillBottom: '#7f1d1d',
        stroke: '#291d14',
        accent: '#f59e0b',
        secondary: '#fef3c7',
        frameBg: 'rgba(185, 28, 28, 0.1)',
        frameBorder: 'rgba(185, 28, 28, 0.38)',
      },
      defense: {
        fillTop: '#8b5e34',
        fillBottom: '#5c3c1e',
        stroke: '#291d14',
        accent: '#fbbf24',
        secondary: '#f5ead6',
        frameBg: 'rgba(139, 94, 52, 0.12)',
        frameBorder: 'rgba(110, 87, 66, 0.42)',
      },
      recon: {
        fillTop: '#b45309',
        fillBottom: '#78350f',
        stroke: '#291d14',
        accent: '#fef08a',
        secondary: '#fde68a',
        frameBg: 'rgba(180, 83, 9, 0.1)',
        frameBorder: 'rgba(180, 83, 9, 0.4)',
      },
      maneuver: {
        fillTop: '#5c4033',
        fillBottom: '#3b261d',
        stroke: '#1e130e',
        accent: '#d97706',
        secondary: '#f0d9b5',
        frameBg: 'rgba(92, 64, 51, 0.12)',
        frameBorder: 'rgba(110, 87, 66, 0.42)',
      },
    },
  },
  vert_et_beige: {
    dark: {
      offense: {
        fillTop: '#e8b948',
        fillBottom: '#b47d19',
        stroke: '#f6f8f1',
        accent: '#769656',
        secondary: '#1e2e1a',
        frameBg: 'rgba(232, 185, 72, 0.18)',
        frameBorder: 'rgba(232, 185, 72, 0.55)',
      },
      defense: {
        fillTop: '#769656',
        fillBottom: '#4b6633',
        stroke: '#eeeed2',
        accent: '#e8b948',
        secondary: '#192217',
        frameBg: 'rgba(118, 150, 86, 0.22)',
        frameBorder: 'rgba(141, 181, 103, 0.55)',
      },
      recon: {
        fillTop: '#eeeed2',
        fillBottom: '#cfd4a8',
        stroke: '#1b2e16',
        accent: '#4b7a2c',
        secondary: '#56754e',
        frameBg: 'rgba(238, 238, 210, 0.14)',
        frameBorder: 'rgba(238, 238, 210, 0.46)',
      },
      maneuver: {
        fillTop: '#4ade80',
        fillBottom: '#15803d',
        stroke: '#f6f8f1',
        accent: '#eeeed2',
        secondary: '#14532d',
        frameBg: 'rgba(74, 222, 128, 0.16)',
        frameBorder: 'rgba(74, 222, 128, 0.5)',
      },
    },
    light: {
      offense: {
        fillTop: '#b45309',
        fillBottom: '#78350f',
        stroke: '#1b2e16',
        accent: '#e8b948',
        secondary: '#eeeed2',
        frameBg: 'rgba(180, 83, 9, 0.12)',
        frameBorder: 'rgba(180, 83, 9, 0.4)',
      },
      defense: {
        fillTop: '#4e7330',
        fillBottom: '#2f491b',
        stroke: '#162412',
        accent: '#e8b948',
        secondary: '#eeeed2',
        frameBg: 'rgba(78, 115, 48, 0.12)',
        frameBorder: 'rgba(78, 115, 48, 0.45)',
      },
      recon: {
        fillTop: '#2f5c3e',
        fillBottom: '#1a3a25',
        stroke: '#122619',
        accent: '#4ade80',
        secondary: '#eeeed2',
        frameBg: 'rgba(47, 92, 62, 0.12)',
        frameBorder: 'rgba(47, 92, 62, 0.45)',
      },
      maneuver: {
        fillTop: '#6b7f36',
        fillBottom: '#44541f',
        stroke: '#162412',
        accent: '#facc15',
        secondary: '#eeeed2',
        frameBg: 'rgba(107, 127, 54, 0.12)',
        frameBorder: 'rgba(107, 127, 54, 0.45)',
      },
    },
  },
  noir_et_blanc: {
    dark: {
      offense: {
        fillTop: '#ffffff',
        fillBottom: '#d4d4d4',
        stroke: '#141414',
        accent: '#525252',
        secondary: '#262626',
        frameBg: 'rgba(255, 255, 255, 0.14)',
        frameBorder: 'rgba(255, 255, 255, 0.56)',
      },
      defense: {
        fillTop: '#d4d4d4',
        fillBottom: '#8c8c8c',
        stroke: '#f5f5f5',
        accent: '#171717',
        secondary: '#fafafa',
        frameBg: 'rgba(163, 163, 163, 0.16)',
        frameBorder: 'rgba(212, 212, 212, 0.52)',
      },
      recon: {
        fillTop: '#e5e5e5',
        fillBottom: '#a3a3a3',
        stroke: '#171717',
        accent: '#262626',
        secondary: '#ffffff',
        frameBg: 'rgba(229, 229, 229, 0.14)',
        frameBorder: 'rgba(229, 229, 229, 0.5)',
      },
      maneuver: {
        fillTop: '#fafafa',
        fillBottom: '#b8b8b8',
        stroke: '#0a0a0a',
        accent: '#404040',
        secondary: '#e5e5e5',
        frameBg: 'rgba(250, 250, 250, 0.14)',
        frameBorder: 'rgba(250, 250, 250, 0.54)',
      },
    },
    light: {
      offense: {
        fillTop: '#262626',
        fillBottom: '#0a0a0a',
        stroke: '#0a0a0a',
        accent: '#e5e5e5',
        secondary: '#d4d4d4',
        frameBg: 'rgba(23, 23, 23, 0.09)',
        frameBorder: 'rgba(23, 23, 23, 0.45)',
      },
      defense: {
        fillTop: '#404040',
        fillBottom: '#171717',
        stroke: '#171717',
        accent: '#fafafa',
        secondary: '#a3a3a3',
        frameBg: 'rgba(64, 64, 64, 0.1)',
        frameBorder: 'rgba(64, 64, 64, 0.45)',
      },
      recon: {
        fillTop: '#525252',
        fillBottom: '#262626',
        stroke: '#171717',
        accent: '#ffffff',
        secondary: '#d4d4d4',
        frameBg: 'rgba(82, 82, 82, 0.1)',
        frameBorder: 'rgba(82, 82, 82, 0.45)',
      },
      maneuver: {
        fillTop: '#333333',
        fillBottom: '#121212',
        stroke: '#0a0a0a',
        accent: '#d4d4d4',
        secondary: '#f5f5f5',
        frameBg: 'rgba(51, 51, 51, 0.1)',
        frameBorder: 'rgba(51, 51, 51, 0.45)',
      },
    },
  },
  bleu_et_argent: {
    dark: {
      offense: {
        fillTop: '#60a5fa',
        fillBottom: '#1d4ed8',
        stroke: '#f1f6fc',
        accent: '#e2e8f0',
        secondary: '#0f2747',
        frameBg: 'rgba(37, 99, 235, 0.24)',
        frameBorder: 'rgba(96, 165, 250, 0.6)',
      },
      defense: {
        fillTop: '#94a3b8',
        fillBottom: '#475569',
        stroke: '#f1f6fc',
        accent: '#38bdf8',
        secondary: '#0f172a',
        frameBg: 'rgba(148, 163, 184, 0.2)',
        frameBorder: 'rgba(203, 213, 225, 0.52)',
      },
      recon: {
        fillTop: '#38bdf8',
        fillBottom: '#0284c7',
        stroke: '#f1f6fc',
        accent: '#e0f2fe',
        secondary: '#0c4a6e',
        frameBg: 'rgba(56, 189, 248, 0.22)',
        frameBorder: 'rgba(56, 189, 248, 0.58)',
      },
      maneuver: {
        fillTop: '#dbeafe',
        fillBottom: '#93c5fd',
        stroke: '#0c2340',
        accent: '#1d4ed8',
        secondary: '#334155',
        frameBg: 'rgba(219, 234, 254, 0.16)',
        frameBorder: 'rgba(147, 197, 253, 0.56)',
      },
    },
    light: {
      offense: {
        fillTop: '#1d4ed8',
        fillBottom: '#1e3a8a',
        stroke: '#0f172a',
        accent: '#38bdf8',
        secondary: '#dbeafe',
        frameBg: 'rgba(29, 78, 216, 0.12)',
        frameBorder: 'rgba(29, 78, 216, 0.45)',
      },
      defense: {
        fillTop: '#334155',
        fillBottom: '#1e293b',
        stroke: '#0f172a',
        accent: '#60a5fa',
        secondary: '#e2e8f0',
        frameBg: 'rgba(51, 65, 85, 0.12)',
        frameBorder: 'rgba(51, 65, 85, 0.42)',
      },
      recon: {
        fillTop: '#0369a1',
        fillBottom: '#0c4a6e',
        stroke: '#082f49',
        accent: '#7dd3fc',
        secondary: '#e0f2fe',
        frameBg: 'rgba(3, 105, 161, 0.12)',
        frameBorder: 'rgba(3, 105, 161, 0.45)',
      },
      maneuver: {
        fillTop: '#2563eb',
        fillBottom: '#1e40af',
        stroke: '#0f172a',
        accent: '#cbd5e1',
        secondary: '#eff6ff',
        frameBg: 'rgba(37, 99, 235, 0.11)',
        frameBorder: 'rgba(37, 99, 235, 0.42)',
      },
    },
  },
  ambre_et_ebene: {
    dark: {
      offense: {
        fillTop: '#f59e0b',
        fillBottom: '#b45309',
        stroke: '#fef3c7',
        accent: '#fde68a',
        secondary: '#2d1c0c',
        frameBg: 'rgba(245, 158, 11, 0.2)',
        frameBorder: 'rgba(245, 158, 11, 0.58)',
      },
      defense: {
        fillTop: '#a8742a',
        fillBottom: '#66400d',
        stroke: '#fdf8f2',
        accent: '#fbbf24',
        secondary: '#1e1815',
        frameBg: 'rgba(168, 116, 42, 0.2)',
        frameBorder: 'rgba(229, 169, 76, 0.5)',
      },
      recon: {
        fillTop: '#fde68a',
        fillBottom: '#d97706',
        stroke: '#1c1410',
        accent: '#78350f',
        secondary: '#451a03',
        frameBg: 'rgba(253, 230, 138, 0.15)',
        frameBorder: 'rgba(245, 158, 11, 0.52)',
      },
      maneuver: {
        fillTop: '#fb923c',
        fillBottom: '#c2410c',
        stroke: '#fdf8f2',
        accent: '#fef3c7',
        secondary: '#291710',
        frameBg: 'rgba(251, 146, 60, 0.18)',
        frameBorder: 'rgba(251, 146, 60, 0.52)',
      },
    },
    light: {
      offense: {
        fillTop: '#b45309',
        fillBottom: '#78350f',
        stroke: '#1e1815',
        accent: '#fbbf24',
        secondary: '#fef3c7',
        frameBg: 'rgba(180, 83, 9, 0.12)',
        frameBorder: 'rgba(180, 83, 9, 0.45)',
      },
      defense: {
        fillTop: '#5c4128',
        fillBottom: '#332215',
        stroke: '#1c1410',
        accent: '#f59e0b',
        secondary: '#f5ead6',
        frameBg: 'rgba(92, 65, 40, 0.12)',
        frameBorder: 'rgba(92, 65, 40, 0.42)',
      },
      recon: {
        fillTop: '#92400e',
        fillBottom: '#572408',
        stroke: '#1c1410',
        accent: '#fde68a',
        secondary: '#fef3c7',
        frameBg: 'rgba(146, 64, 14, 0.12)',
        frameBorder: 'rgba(146, 64, 14, 0.42)',
      },
      maneuver: {
        fillTop: '#78350f',
        fillBottom: '#451a03',
        stroke: '#1c1410',
        accent: '#e5a94c',
        secondary: '#fef3c7',
        frameBg: 'rgba(120, 53, 15, 0.12)',
        frameBorder: 'rgba(120, 53, 15, 0.42)',
      },
    },
  },
};

/**
 * Derive harmonious card palettes for any future custom `BlindWarThemeDefinition`
 * without duplicating vector illustrations.
 */
export function createCustomThemeCardPalettes(
  spec: CustomThemeCardPaletteSpec,
): Readonly<Record<CardPaletteRole, CardArtworkPalette>> {
  const { theme, colorMode = 'dark' } = spec;
  const ui = resolveThemeUiForColorMode(theme, colorMode);
  const stroke = colorMode === 'light' ? '#18181b' : '#f8fafc';
  const sec = colorMode === 'light' ? ui.bgElevated : theme.ui.bgPanel;

  return {
    offense: {
      fillTop: ui.accentBright,
      fillBottom: ui.accent,
      stroke,
      accent: ui.gold,
      secondary: sec,
      frameBg: ui.accentSoftBg,
      frameBorder: ui.borderBright,
    },
    defense: {
      fillTop: ui.borderBright,
      fillBottom: ui.bgElevated,
      stroke,
      accent: ui.accentBright,
      secondary: ui.textSecondary,
      frameBg: ui.accentSoftBg,
      frameBorder: ui.borderBright,
    },
    recon: {
      fillTop: ui.cyan,
      fillBottom: ui.accent,
      stroke,
      accent: ui.gold,
      secondary: sec,
      frameBg: ui.accentSoftBg,
      frameBorder: ui.borderBright,
    },
    maneuver: {
      fillTop: ui.green,
      fillBottom: ui.borderBright,
      stroke,
      accent: ui.gold,
      secondary: sec,
      frameBg: ui.accentSoftBg,
      frameBorder: ui.borderBright,
    },
  };
}

/** Resolve the theme-adapted palette for any card or card role under any theme & color mode. */
export function getThemedCardPalette(
  themeOrId: BlindWarThemeDefinition | ThemeId | string | null | undefined,
  cardOrRole: CardType | CardPaletteRole,
  colorMode: 'dark' | 'light' = 'dark',
): CardArtworkPalette {
  const role: CardPaletteRole =
    cardOrRole in CARD_PALETTE_ROLES
      ? CARD_PALETTE_ROLES[cardOrRole as CardType]
      : (cardOrRole as CardPaletteRole);

  if (typeof themeOrId === 'object' && themeOrId !== null && 'ui' in themeOrId) {
    const custom = themeOrId;
    const builtinPack = BUILTIN_CARD_PALETTES[custom.id];
    if (builtinPack && custom === BLIND_WAR_THEMES[custom.id]) {
      return builtinPack[colorMode][role];
    }
    return createCustomThemeCardPalettes({ theme: custom, colorMode })[role];
  }

  const resolvedTheme = getThemeDefinition(themeOrId);
  return BUILTIN_CARD_PALETTES[resolvedTheme.id][colorMode][role];
}

export interface CardSurfaceContrastReport {
  readonly role: CardPaletteRole;
  readonly colorMode: 'dark' | 'light';
  readonly panelHex: string;
  readonly fillContrast: number;
  readonly strokeContrast: number;
  readonly effectiveVisibilityContrast: number;
}

/**
 * Verify objective contrast across all 4 card roles under any theme in dark or light mode.
 */
export function verifyThemeCardContrast(
  theme: BlindWarThemeDefinition,
  colorMode: 'dark' | 'light' = 'dark',
): readonly CardSurfaceContrastReport[] {
  const ui = resolveThemeUiForColorMode(theme, colorMode);
  const panelHex = ui.bgPanel;
  const roles: readonly CardPaletteRole[] = ['offense', 'defense', 'recon', 'maneuver'];
  return roles.map((role) => {
    const pal = getThemedCardPalette(theme, role, colorMode);
    const fillContrast = getContrastRatioBetweenHex(pal.fillTop, panelHex);
    const strokeContrast = getContrastRatioBetweenHex(pal.stroke, panelHex);
    return {
      role,
      colorMode,
      panelHex,
      fillContrast,
      strokeContrast,
      effectiveVisibilityContrast: Math.max(fillContrast, strokeContrast),
    };
  });
}
