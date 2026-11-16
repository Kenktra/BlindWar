import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CARD_CATALOG,
  CARD_DOSSIERS,
  CARD_TYPES,
  DEFAULT_USER_PREFERENCES,
  THEME_LIST,
  autoCompletePlacement,
  createCustomThemeCardPalettes,
  createCustomThemePiecePalettes,
  createMatchState,
  getCardUsageDetails,
  getThemeDefinition,
  getThemedCardPalette,
  playCard,
  projectMatchStateForViewer,
  submitPlayerPlacement,
  verifyThemeCardContrast,
  type BlindWarThemeDefinition,
} from '../shared/src/index.js';
import {
  ALL_CARD_ART_KINDS,
  CARD_THEME_ASSET_PACKS,
  resolveCardThemeAsset,
} from '../client/src/assets/cards/index.js';
import { CardArtwork } from '../client/src/components/CardArtwork.js';
import { CardDescriptionPanel } from '../client/src/components/CardDescriptionPanel.js';
import { HomeLandingPage } from '../client/src/components/HomeLandingPage.js';
import { InGameHelpModal } from '../client/src/components/InGameHelpModal.js';
import { LearnToPlayHub } from '../client/src/components/LearnToPlayHub.js';
import { ThemeProvider } from '../client/src/themes/themeManager.js';

function isMonochromeHex(hex: string): boolean {
  const cleaned = hex.trim().replace('#', '');
  if (cleaned.length !== 6) return false;
  return cleaned.slice(0, 2).toLowerCase() === cleaned.slice(2, 4).toLowerCase() &&
    cleaned.slice(2, 4).toLowerCase() === cleaned.slice(4, 6).toLowerCase();
}

function unescapeHtml(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

describe('Assets vectoriels personnalisés pour toutes les 16 cartes & tous les thèmes (§1–8)', () => {
  it('covers all 16 official cards without omission or fictional cards, with 16 distinct transparent geometric SVGs', () => {
    expect(CARD_TYPES).toHaveLength(16);
    expect(ALL_CARD_ART_KINDS).toEqual(CARD_TYPES);

    const geometries = new Set<string>();
    for (const cardId of CARD_TYPES) {
      const html = renderToStaticMarkup(
        React.createElement(CardArtwork, { card: cardId, size: 'lg' }),
      );
      expect(html).toContain('viewBox="0 0 64 64"');
      expect(html).toContain('data-transparent-bg="true"');
      expect(html).toContain(`data-card-kind="${cardId}"`);
      expect(html).toContain('<linearGradient');
      expect(html).toContain('width="48"');
      expect(html).toContain('height="48"');

      // Base SVG stays truly transparent (no opaque 64x64 frame rect baked into SVG)
      expect(html).not.toMatch(/<rect[^>]*x="0"[^>]*y="0"[^>]*width="64"[^>]*height="64"/);

      const geomMatch = html.match(/data-card-geometry="([^"]+)"/);
      expect(geomMatch).not.toBeNull();
      geometries.add(geomMatch![1]!);
    }

    expect(geometries.size).toBe(16);

    // Optional framed UI badge adds wrapper frame outside SVG while SVG itself remains transparent
    const framedHtml = renderToStaticMarkup(
      React.createElement(CardArtwork, { card: 'kamikaze', size: 'xl', framed: true }),
    );
    expect(framedHtml).toContain('bw-card-artwork-framed');
    expect(framedHtml).toContain('width="64"');
    expect(framedHtml).toContain('data-transparent-bg="true"');
  });

  it('organizes asset files under assets/cards/base and assets/cards/themes and preserves unified silhouettes across all 6 themes + custom themes', () => {
    const assetPaths = [
      'client/src/assets/cards/base/silhouettes.tsx',
      'client/src/assets/cards/themes/classic.ts',
      'client/src/assets/cards/themes/chesscom.ts',
      'client/src/assets/cards/themes/monochrome.ts',
      'client/src/assets/cards/themes/blue.ts',
      'client/src/assets/cards/themes/red-black.ts',
      'client/src/assets/cards/themes/index.ts',
      'client/src/assets/cards/index.ts',
    ];
    for (const rel of assetPaths) {
      expect(fs.existsSync(path.resolve(process.cwd(), rel))).toBe(true);
    }

    const baseGeom = (themeId: string, cardId: (typeof CARD_TYPES)[number], mode: 'dark' | 'light') => {
      const html = renderToStaticMarkup(
        React.createElement(CardArtwork, {
          card: cardId,
          theme: getThemeDefinition(themeId),
          colorMode: mode,
          size: 'md',
        }),
      );
      return {
        html,
        geom: html.match(/data-card-geometry="([^"]+)"/)?.[1],
      };
    };

    // Every theme adapts colors & preserves identical geometry and crisp contrast
    for (const theme of THEME_LIST) {
      expect(CARD_THEME_ASSET_PACKS[theme.id]).toBeDefined();
      for (const mode of ['dark', 'light'] as const) {
        const contrastReports = verifyThemeCardContrast(theme, mode);
        expect(contrastReports).toHaveLength(4);
        for (const rep of contrastReports) {
          expect(rep.effectiveVisibilityContrast).toBeGreaterThanOrEqual(4.0);
        }

        const samplePal = getThemedCardPalette(theme, 'kamikaze', mode);
        if (theme.id === 'noir_et_blanc') {
          expect(isMonochromeHex(samplePal.fillTop)).toBe(true);
          expect(isMonochromeHex(samplePal.fillBottom)).toBe(true);
          expect(isMonochromeHex(samplePal.stroke)).toBe(true);
          expect(isMonochromeHex(samplePal.accent)).toBe(true);
        }
      }

      for (const cardId of CARD_TYPES) {
        const resolved = resolveCardThemeAsset(theme, cardId, 'dark');
        expect(resolved.transparentBackground).toBe(true);
        expect(resolved.assetId).toContain(cardId);
      }

      const redKam = baseGeom('rouge_et_noir', 'kamikaze', 'dark');
      const curKam = baseGeom(theme.id, 'kamikaze', 'dark');
      expect(curKam.geom).toBe(redKam.geom);
      expect(curKam.html).toContain(`data-card-theme="${theme.id}"`);
    }

    // Monochrome and Blue themes produce distinctly different palette colors while keeping silhouette identical
    const monoHtml = baseGeom('noir_et_blanc', 'espionnage', 'dark').html;
    const blueHtml = baseGeom('bleu_et_argent', 'espionnage', 'dark').html;
    const greenHtml = baseGeom('vert_et_beige', 'espionnage', 'dark').html;
    expect(monoHtml).not.toBe(blueHtml);
    expect(blueHtml).not.toBe(greenHtml);

    // Extensible helper works seamlessly for any future custom BlindWarThemeDefinition
    const customPalettes = createCustomThemePiecePalettes({
      lightCampTop: '#f43f5e',
      lightCampBottom: '#9f1239',
      lightCampAccent: '#fef08a',
      darkCampTop: '#334155',
      darkCampBottom: '#0f172a',
      darkCampAccent: '#38bdf8',
    });
    const baseTheme = getThemeDefinition('rouge_et_noir');
    const customTheme: BlindWarThemeDefinition = {
      ...baseTheme,
      id: 'violet_future' as typeof baseTheme.id,
      name: 'Violet Synthétique',
      ui: {
        ...baseTheme.ui,
        accent: '#7c3aed',
        accentBright: '#a78bfa',
        gold: '#fbbf24',
        cyan: '#22d3ee',
        green: '#34d399',
      },
      board: {
        ...baseTheme.board,
        ...customPalettes,
      },
    };
    const customCardPal = createCustomThemeCardPalettes({ theme: customTheme, colorMode: 'dark' });
    expect(customCardPal.offense.fillTop).toBe('#a78bfa');
    const customHtml = renderToStaticMarkup(
      React.createElement(CardArtwork, { card: 'teleportation', theme: customTheme, size: 'md' }),
    );
    expect(customHtml).toContain('data-card-geometry="warp-portal-arc"');
    expect(customHtml).toContain('data-card-theme="violet_future"');
  });

  it('renders CardDescriptionPanel with complete details across all 16 cards and integrates CardArtwork across all game UIs', () => {
    for (const cardId of CARD_TYPES) {
      const details = getCardUsageDetails(cardId);
      const html = renderToStaticMarkup(
        React.createElement(
          ThemeProvider,
          {
            preferences: { ...DEFAULT_USER_PREFERENCES, siteThemeId: 'bleu_et_argent' },
            children: React.createElement(CardDescriptionPanel, { card: cardId }),
          },
        ),
      );
      const text = unescapeHtml(html);
      expect(html).toContain(`data-card-kind="${cardId}"`);
      expect(html).toContain('data-card-theme="bleu_et_argent"');
      expect(text).toContain(CARD_DOSSIERS[cardId].name);
      expect(text).toContain(CARD_DOSSIERS[cardId].effectDescription);
      expect(text).toContain('Conditions d’utilisation');
      expect(text).toContain('Restrictions');
      expect(text).toContain('Particularités');
      expect(details.usageConditions.length).toBeGreaterThanOrEqual(3);
      expect(details.particularities.length).toBeGreaterThanOrEqual(2);
    }

    const noop = () => {};
    // HomeLandingPage renders CardArtwork for featured cards
    const homeHtml = renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        {
          preferences: { ...DEFAULT_USER_PREFERENCES, siteThemeId: 'vert_et_beige' },
          children: React.createElement(HomeLandingPage, {
            userProfile: null,
            onPlayLocal: noop,
            onOpenMatchmaking: noop,
            onOpenCustomCreate: noop,
            onOpenTutorial: noop,
            onOpenLeaderboard: noop,
            onOpenProfileOrAuth: noop,
            onOpenRegister: noop,
            onOpenCharacters: noop,
            onOpenCards: noop,
            onOpenRules: noop,
            onOpenSettings: noop,
          }),
        },
      ),
    );
    expect(homeHtml).toContain('data-card-kind="espionnage"');
    expect(homeHtml).toContain('data-card-theme="vert_et_beige"');

    // InGameHelpModal & LearnToPlayHub integrate CardArtwork & CardDescriptionPanel
    const helpHtml = renderToStaticMarkup(
      React.createElement(InGameHelpModal, {
        isOpen: true,
        viewerColor: 'red',
        initialTab: 'faq',
        dismissedContextualCount: 0,
        canResetContextualTips: false,
        onResetContextualTips: noop,
        onClose: noop,
      }),
    );
    expect(helpHtml).toContain('data-card-kind="kamikaze"');
    expect(helpHtml).toContain('bw-card-dossier-panel');

    const learnHtml = renderToStaticMarkup(
      React.createElement(LearnToPlayHub, {
        completedTutorialIds: [],
        dismissedContextualCount: 0,
        enableContextualTutorials: true,
        onToggleContextualTutorials: noop,
        onResetContextualTips: noop,
        onStartScenario: noop,
      }),
    );
    expect(learnHtml).toContain('bw-learn-cards-strip');
    expect(learnHtml).toContain('data-card-kind="espionnage"');

    // App.tsx & GameBoardScreen.tsx wire CardArtwork and CardDescriptionPanel cleanly everywhere
    const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'client/src/App.tsx'), 'utf8');
    const gameSrc = fs.readFileSync(path.resolve(process.cwd(), 'client/src/ui/GameBoardScreen.tsx'), 'utf8');
    expect(appSrc).toContain('<CardDescriptionPanel card={selectedCardDossier} />');
    expect(appSrc).toContain('<CardArtwork card={cid}');
    expect(gameSrc).toContain('CardArtwork card={activeOpponentCardAlert.card}');
    expect(gameSrc).toContain('CardArtwork card={activeNewCardAlert.card}');
    expect(gameSrc).toContain('<CardDescriptionPanel');
    expect(gameSrc).toContain('CardArtwork card={notif.card}');
    expect(gameSrc).toContain('entry.cardNotification &&');
  });

  it('preserves strict secrecy and authentic card rules without leaking hidden target squares or pieces', () => {
    let match = createMatchState('card-asset-secrecy', 'local');
    match = submitPlayerPlacement(match, 'red', autoCompletePlacement('red', []));
    match = submitPlayerPlacement(match, 'black', autoCompletePlacement('black', []));

    const redPawn = match.pieces.find((p) => p.owner === 'red' && p.character === 'soldat')!;
    match = {
      ...match,
      players: {
        ...match.players,
        red: { ...match.players.red, hand: ['kamikaze', 'piege'] },
      },
    };

    // Play Kamikaze (secret piece target) on own soldier
    const afterKamikaze = playCard(match, 'red', {
      card: 'kamikaze',
      targetPieceId: redPawn.id,
    });
    const blackView = projectMatchStateForViewer(afterKamikaze, 'black');
    const redNotifForBlack = blackView.cardNotifications.find((n) => n.card === 'kamikaze');
    expect(redNotifForBlack).toBeDefined();
    expect(redNotifForBlack!.cardName).toBe(CARD_CATALOG.kamikaze.name);
    expect(redNotifForBlack!.visibleTargetNotation).toBeNull();
    expect(JSON.stringify(redNotifForBlack)).not.toContain(redPawn.id);
    // Secret target piece stays unrevealed on Black's projected board
    const projectedTarget = blackView.pieces.find((p) => p.id === redPawn.id);
    expect(projectedTarget?.hasKamikazeVisible).toBe(false);
    expect(projectedTarget?.character).toBeNull();
  });
});
