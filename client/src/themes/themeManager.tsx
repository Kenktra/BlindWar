import React, { createContext, useContext, useEffect, useMemo } from 'react';
import {
  DEFAULT_USER_PREFERENCES,
  THEME_LIST,
  getThemeDefinition,
  sanitizeUserPreferences,
  type BlindWarThemeDefinition,
  type ColorMode,
  type ThemeId,
  type UserPreferences,
  resolveThemeUiForColorMode,
} from '../../../shared/src/index.js';

export interface ResolvedThemeState {
  readonly preferences: UserPreferences;
  readonly colorMode: ColorMode;
  readonly siteTheme: BlindWarThemeDefinition;
  readonly boardTheme: BlindWarThemeDefinition;
  readonly effectiveMotionReduced: boolean;
}

const DEFAULT_THEME = getThemeDefinition('rouge_et_noir');

const DEFAULT_RESOLVED_THEME: ResolvedThemeState = {
  preferences: DEFAULT_USER_PREFERENCES,
  colorMode: DEFAULT_USER_PREFERENCES.colorMode,
  siteTheme: DEFAULT_THEME,
  boardTheme: DEFAULT_THEME,
  effectiveMotionReduced: false,
};

const ThemeContext = createContext<ResolvedThemeState | null>(null);

/** Resolve a UserPreferences object into its site theme and board theme definitions. */
export function resolveThemeState(
  rawPrefs?: Partial<UserPreferences> | null,
): ResolvedThemeState {
  const preferences = sanitizeUserPreferences(rawPrefs);
  const siteTheme = getThemeDefinition(preferences.siteThemeId);
  const boardTheme =
    preferences.boardThemeId === 'match_site'
      ? siteTheme
      : getThemeDefinition(preferences.boardThemeId);

  return {
    preferences,
    colorMode: preferences.colorMode,
    siteTheme,
    boardTheme,
    effectiveMotionReduced:
      preferences.reduceMotion || preferences.animationSpeed === 'reduced',
  };
}

/** Build the complete map of CSS custom properties for a given preference set. */
export function buildThemeCssVariables(
  rawPrefs?: Partial<UserPreferences> | null,
): Readonly<Record<string, string>> {
  const { preferences, colorMode, siteTheme, boardTheme } = resolveThemeState(rawPrefs);
  const ui = resolveThemeUiForColorMode(siteTheme, colorMode);
  const { board } = boardTheme;

  const isBright = preferences.brightness === 'bright';
  const isDim = preferences.brightness === 'dim';
  const brightnessFilter = isBright
    ? 'brightness(1.07) saturate(1.04)'
    : isDim
      ? 'brightness(0.91)'
      : 'none';

  const animScale =
    preferences.reduceMotion || preferences.animationSpeed === 'reduced'
      ? '0.01'
      : preferences.animationSpeed === 'fast'
        ? '0.55'
        : '1';

  return {
    '--bw-color-scheme': colorMode,
    '--bw-bg-deep': ui.bgDeep,
    '--bw-bg-radial': ui.bgRadialGlow,
    '--bw-bg-navbar': ui.bgNavbar,
    '--bw-bg-panel': ui.bgPanel,
    '--bw-bg-panel-alt': ui.bgPanelAlt,
    '--bw-bg-elevated': ui.bgElevated,
    '--bw-border': ui.border,
    '--bw-border-bright': ui.borderBright,
    '--bw-accent': ui.accent,
    '--bw-accent-bright': ui.accentBright,
    '--bw-accent-soft': ui.accentSoftBg,
    '--bw-accent-glow': ui.accentGlow,
    '--bw-accent-badge-text': ui.accentBadgeText,
    '--bw-btn-primary-start': ui.btnPrimaryStart,
    '--bw-btn-primary-end': ui.btnPrimaryEnd,
    '--bw-btn-primary-hover-start': ui.btnPrimaryHoverStart,
    '--bw-btn-primary-hover-end': ui.btnPrimaryHoverEnd,
    '--bw-btn-primary-text': ui.btnPrimaryText,
    '--bw-btn-primary-border': ui.btnPrimaryBorder,
    '--bw-text-primary': ui.textPrimary,
    '--bw-text-secondary': ui.textSecondary,
    '--bw-text-muted': ui.textMuted,
    '--bw-notif-bg': ui.notifBg,
    '--bw-notif-border': ui.notifBorder,
    '--bw-notif-accent': ui.notifAccent,
    '--bw-gold': ui.gold,
    '--bw-green': ui.green,
    '--bw-cyan': ui.cyan,
    '--bw-danger-text': ui.dangerText,
    '--bw-danger-border': ui.dangerBorder,
    '--bw-board-square-a': board.squareA,
    '--bw-board-square-b': board.squareB,
    '--bw-board-frame-bg': board.frameBg,
    '--bw-board-frame-border': board.frameBorder,
    '--bw-board-coord-a': board.coordOnA,
    '--bw-board-coord-b': board.coordOnB,
    '--bw-ally-badge-bg': board.allyBadgeBg,
    '--bw-ally-badge-text': board.allyBadgeText,
    '--bw-enemy-badge-bg': board.enemyBadgeBg,
    '--bw-enemy-badge-border': board.enemyBadgeBorder,
    '--bw-enemy-badge-text': board.enemyBadgeText,
    '--bw-board-cell-border': board.interactions.cellBorder,
    '--bw-board-cell-hover-border': board.interactions.cellHoverBorder,
    '--bw-cell-select-bg': board.interactions.selectionBg,
    '--bw-cell-select-border': board.interactions.selectionBorder,
    '--bw-cell-move-bg': board.interactions.moveValidBg,
    '--bw-cell-move-border': board.interactions.moveValidBorder,
    '--bw-cell-attack-bg': board.interactions.attackValidBg,
    '--bw-cell-attack-border': board.interactions.attackValidBorder,
    '--bw-cell-jump-bg': board.interactions.jumpValidBg,
    '--bw-cell-jump-border': board.interactions.jumpValidBorder,
    '--bw-cell-special-bg': board.interactions.specialZoneBg,
    '--bw-cell-special-border': board.interactions.specialZoneBorder,
    '--bw-cell-card-bg': board.interactions.cardTargetBg,
    '--bw-cell-card-border': board.interactions.cardTargetBorder,
    '--bw-cell-recon-glow': board.interactions.reconGlow,
    '--bw-cell-last-from-bg': board.interactions.lastMoveFromBg,
    '--bw-cell-last-to-bg': board.interactions.lastMoveToBg,
    '--bw-cell-last-accent': board.interactions.lastMoveAccent,
    '--bw-board-hud-bg': board.interactions.boardHudBg,
    '--bw-board-hud-border': board.interactions.boardHudBorder,
    '--bw-brightness-filter': brightnessFilter,
    '--bw-anim-scale': animScale,
    // Aliases mapped cleanly for legacy CSS variables across existing views
    '--bg-deep': ui.bgDeep,
    '--bg-panel': ui.bgPanel,
    '--bg-panel-alt': ui.bgPanelAlt,
    '--bg-elevated': ui.bgElevated,
    '--border': ui.border,
    '--text-primary': ui.textPrimary,
    '--text-secondary': ui.textSecondary,
    '--red-accent': ui.accent,
    '--red-glow': ui.accentGlow,
    '--gold-accent': ui.gold,
    '--green-accent': ui.green,
    '--cyan-accent': ui.cyan,
  };
}

/**
 * Apply theme CSS variables and accessibility/brightness classes directly onto `document.documentElement`
 * so the entire interface updates immediately without page reload.
 */
export function applyThemePreferencesToDocument(
  rawPrefs?: Partial<UserPreferences> | null,
): ResolvedThemeState {
  const state = resolveThemeState(rawPrefs);
  if (typeof document === 'undefined' || !document.documentElement) {
    return state;
  }

  const root = document.documentElement;
  const vars = buildThemeCssVariables(state.preferences);
  for (const [prop, val] of Object.entries(vars)) {
    root.style.setProperty(prop, val);
  }

  const themeClasses = THEME_LIST.map((t) => `bw-theme-${t.id}`);
  const boardClasses = THEME_LIST.map((t) => `bw-board-theme-${t.id}`);
  root.classList.remove(
    ...themeClasses,
    ...boardClasses,
    'bw-brightness-standard',
    'bw-brightness-bright',
    'bw-brightness-dim',
    'bw-a11y-text-large',
    'bw-a11y-text-xlarge',
    'bw-a11y-high-contrast',
    'bw-a11y-reduce-motion',
    'bw-a11y-strong-selection',
    'bw-a11y-pattern-markers',
  );

  root.classList.add(
    'bw-theme-' + state.siteTheme.id,
    'bw-board-theme-' + state.boardTheme.id,
    'bw-color-' + state.colorMode,
    'bw-brightness-' + state.preferences.brightness,
  );
  root.classList.remove(state.colorMode === 'light' ? 'bw-color-dark' : 'bw-color-light');
  root.style.colorScheme = state.colorMode;

  if (state.preferences.textScale === 'large') {
    root.classList.add('bw-a11y-text-large');
  } else if (state.preferences.textScale === 'xlarge') {
    root.classList.add('bw-a11y-text-xlarge');
  }
  if (state.preferences.highContrast) {
    root.classList.add('bw-a11y-high-contrast');
  }
  if (state.effectiveMotionReduced) {
    root.classList.add('bw-a11y-reduce-motion');
  }
  if (state.preferences.highlightSelectionStrong) {
    root.classList.add('bw-a11y-strong-selection');
  }
  if (state.preferences.showPatternMarkers) {
    root.classList.add('bw-a11y-pattern-markers');
  }

  root.dataset.bwTheme = state.siteTheme.id;
  root.dataset.bwBoardTheme = state.boardTheme.id;
  root.dataset.bwColorMode = state.colorMode;
  root.dataset.bwAnimSpeed = state.preferences.animationSpeed;

  return state;
}

export const ThemeProvider: React.FC<{
  readonly preferences: UserPreferences;
  readonly children: React.ReactNode;
}> = ({ preferences, children }) => {
  const value = useMemo(() => resolveThemeState(preferences), [preferences]);

  useEffect(() => {
    applyThemePreferencesToDocument(preferences);
  }, [preferences]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useBlindWarTheme(): ResolvedThemeState {
  return useContext(ThemeContext) ?? DEFAULT_RESOLVED_THEME;
}

export function useOptionalBlindWarTheme(): ResolvedThemeState | null {
  return useContext(ThemeContext);
}

export function getThemePrimaryLabel(themeId: ThemeId): string {
  return getThemeDefinition(themeId).name;
}
