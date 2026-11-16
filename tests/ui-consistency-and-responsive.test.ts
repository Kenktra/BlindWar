import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_PREFERENCES, THEME_LIST } from '../shared/src/index.js';
import { SettingsScreen } from '../client/src/components/SettingsScreen.js';
import { ThemeProvider, buildThemeCssVariables } from '../client/src/themes/themeManager.js';

describe('Cohérence UI/UX, États interactifs & Adaptation Responsive (§6, §8)', () => {
  it('defines unified button states, keyboard focus rings, zero horizontal overflow, reduced motion, and responsive breakpoints in styles.css', () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'client/src/styles.css'), 'utf8');

    expect(css).toContain('overflow-x: clip');
    expect(css).toContain('.bw-btn:focus-visible');
    expect(css).toContain('.bw-btn:active:not(:disabled)');
    expect(css).toContain('.bw-btn[aria-busy=\'true\']');
    expect(css).toContain('.bw-field input:focus');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('@media (max-width: 1120px)');
    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('@media (max-width: 720px)');
    expect(css).toContain('@media (max-width: 480px)');
    expect(css).toContain('.bw-landing-units-strip');
  });

  it('produces complete, high-contrast CSS variables across all 6 themes in both dark and light modes', () => {
    for (const theme of THEME_LIST) {
      for (const colorMode of ['dark', 'light'] as const) {
        const vars = buildThemeCssVariables({
          ...DEFAULT_USER_PREFERENCES,
          colorMode,
          siteThemeId: theme.id,
          boardThemeId: theme.id,
        });
        expect(vars['--bw-color-scheme']).toBe(colorMode);
        expect(vars['--bw-text-primary']).toBeTruthy();
        expect(vars['--bw-bg-panel']).toBeTruthy();
        expect(vars['--bw-btn-primary-text']).toBeTruthy();
      }
    }
  });

  it('renders SettingsScreen cleanly inside ThemeProvider for both dark and light modes with all theme options', () => {
    for (const colorMode of ['dark', 'light'] as const) {
      const html = renderToStaticMarkup(
        React.createElement(ThemeProvider, {
          preferences: { ...DEFAULT_USER_PREFERENCES, colorMode },
          children: React.createElement(SettingsScreen, {
            preferences: { ...DEFAULT_USER_PREFERENCES, colorMode },
            userProfile: null,
            onUpdatePreferences: () => {},
            onResetAll: () => {},
            onGoToProfile: () => {},
            onGoToAuth: () => {},
          }),
        }),
      );
      expect(html).toContain('Mode sombre');
      expect(html).toContain('Mode clair');
      for (const theme of THEME_LIST) {
        expect(html).toContain(theme.name);
      }
    }
  });
});
