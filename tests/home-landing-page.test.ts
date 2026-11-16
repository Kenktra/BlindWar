import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CARD_DOSSIERS,
  CHARACTER_DOSSIERS,
  DEFAULT_USER_PREFERENCES,
} from '../shared/src/index.js';
import { HomeLandingPage } from '../client/src/components/HomeLandingPage.js';
import { ThemeProvider } from '../client/src/themes/themeManager.js';
import type { ClientUserProfile } from '../client/src/services/apiClient.js';

const noop = () => {};

function makeGuestHandlers(userProfile: ClientUserProfile | null) {
  return {
    userProfile,
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
  };
}

describe('Refonte complète de la page d’accueil (§5)', () => {
  it('renders an inviting competitive strategy landing page with transparent piece showcase and all quick CTAs for visitors', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        {
          preferences: { ...DEFAULT_USER_PREFERENCES, boardThemeId: 'vert_et_beige' },
          children: React.createElement(HomeLandingPage, makeGuestHandlers(null)),
        },
      ),
    );

    expect(html).toContain('BLIND WAR');
    expect(html).toContain('Vert et beige');
    expect(html).toContain('data-transparent-bg="true"');
    expect(html).toContain('data-piece-theme="vert_et_beige"');

    // Every required CTA (§5.2)
    expect(html).toContain('Rejoindre une partie / Matchmaking');
    expect(html).toContain('Jouer en Local');
    expect(html).toContain('Créer une partie personnalisée');
    expect(html).toContain('Jouer contre un adversaire');
    expect(html).toContain('Tutoriel interactif');
    expect(html).toContain('Classements ELO');
    expect(html).toContain('Connexion / Profil');

    // Featured units & cards spotlight
    expect(html).toContain(CHARACTER_DOSSIERS.traqueur.name);
    expect(html).toContain(CHARACTER_DOSSIERS.arbaletrier.name);
    expect(html).toContain(CARD_DOSSIERS.espionnage.name);
    expect(html).toContain(CARD_DOSSIERS.kamikaze.name);
  });

  it('displays personalized commander summary and Mon Profil link when authenticated', () => {
    const userProfile: ClientUserProfile = {
      id: 'u-home-1',
      username: 'CommandantTest',
      displayName: 'AlphaTacticien',
      avatarBadge: '♔',
      bio: '',
      eloRating: 412,
      wins: 7,
      losses: 2,
      draws: 1,
      gamesPlayed: 10,
      winRatePercent: 70,
      totalEliminations: 32,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const html = renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        {
          preferences: DEFAULT_USER_PREFERENCES,
          children: React.createElement(HomeLandingPage, makeGuestHandlers(userProfile)),
        },
      ),
    );

    expect(html).toContain('AlphaTacticien');
    expect(html).toContain('412 ELO');
    expect(html).toContain('Mon Profil');
  });
});
