import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CARD_CATALOG,
  LEARN_TO_PLAY_CATEGORIES,
  PIECE_TUTORIALS,
  SPECIAL_RULE_TUTORIALS,
  TUTORIAL_SCENARIOS,
  filterTutorialsByQuery,
} from '../shared/src/index.js';
import { InGameHelpModal } from '../client/src/components/InGameHelpModal.js';
import { LearnToPlayHub } from '../client/src/components/LearnToPlayHub.js';

const noop = () => {};

describe('Tutoriels complets des règles spéciales, Section Apprendre à jouer & Aide en partie (§3.2–3.5)', () => {
  it('defines all 8 official learning categories and complete step-by-step tutorials for BlindWar special mechanics', () => {
    expect(LEARN_TO_PLAY_CATEGORIES).toHaveLength(8);
    expect(LEARN_TO_PLAY_CATEGORIES.map((c) => c.label)).toEqual([
      'Règles générales',
      'Présentation des pièces',
      'Déplacements',
      'Attaques et captures',
      'Règles spéciales',
      'Situations particulières',
      'Stratégies et conseils',
      'Exemples de parties',
    ]);

    expect(SPECIAL_RULE_TUTORIALS.length).toBeGreaterThanOrEqual(8);
    const scenarioIds = new Set(TUTORIAL_SCENARIOS.map((s) => s.id));
    for (const rule of SPECIAL_RULE_TUTORIALS) {
      expect(rule.howItWorksSteps.length).toBeGreaterThanOrEqual(3);
      expect(rule.whenToUse.length).toBeGreaterThan(15);
      expect(rule.conditions.length).toBeGreaterThanOrEqual(1);
      expect(rule.limits.length).toBeGreaterThanOrEqual(1);
      expect(rule.examples.length).toBeGreaterThanOrEqual(1);
      expect(rule.consequences.length).toBeGreaterThanOrEqual(1);
      expect(rule.demoSteps.length).toBeGreaterThanOrEqual(1);
      if (rule.linkedScenarioId) {
        expect(scenarioIds.has(rule.linkedScenarioId)).toBe(true);
      }
    }

    // Verify key special rules are present & match real engine thresholds
    const colosseRule = SPECIAL_RULE_TUTORIALS.find((r) => r.id === 'rule-colosse-kamikaze');
    expect(colosseRule).toBeDefined();
    expect(colosseRule!.title).toContain('2 Kamikazes');
    expect(colosseRule!.howItWorksSteps.join(' ')).toContain('SURVIT à 1/2');
    expect(colosseRule!.howItWorksSteps.join(' ')).toContain('2/2');

    const arbRule = SPECIAL_RULE_TUTORIALS.find((r) => r.id === 'rule-arbaletrier-cadence');
    expect(arbRule).toBeDefined();
    expect(arbRule!.title).toContain('1 tir / 3 tours personnels');

    // Search filters accurately without accent sensitivity
    const foundTraq = filterTutorialsByQuery(SPECIAL_RULE_TUTORIALS, 'poursuite', (r) => r.summary);
    expect(foundTraq.some((r) => r.id === 'rule-traqueur-marquage')).toBe(true);
    const foundExec = filterTutorialsByQuery(
      Object.values(PIECE_TUTORIALS),
      'executeur',
      (p) => p.specialAbilities,
    );
    expect(foundExec.some((p) => p.id === 'executeur')).toBe(true);
  });

  it('renders LearnToPlayHub with all 8 categories, search input, 12 piece guides, special mechanics and interactive demos', () => {
    const html = renderToStaticMarkup(
      React.createElement(LearnToPlayHub, {
        completedTutorialIds: ['pions-et-promotion'],
        dismissedContextualCount: 2,
        enableContextualTutorials: true,
        onToggleContextualTutorials: noop,
        onResetContextualTips: noop,
        onStartScenario: noop,
      }),
    );

    expect(html).toContain('Apprendre à jouer');
    for (const cat of LEARN_TO_PLAY_CATEGORIES) {
      expect(html).toContain(cat.label);
    }
    expect(html).toContain('type="search"');
    expect(html).toContain(`1/${TUTORIAL_SCENARIOS.length}`);
    expect(html).toContain('bw-idiagram-board-wrap');
    expect(html).toContain('Frappe traversante de l’Exécuteur');
  });

  it('renders InGameHelpModal non-destructively during a live game with search and rule tabs', () => {
    const html = renderToStaticMarkup(
      React.createElement(InGameHelpModal, {
        isOpen: true,
        viewerColor: 'red',
        initialTab: 'mechanics',
        dismissedContextualCount: 1,
        canResetContextualTips: true,
        onResetContextualTips: noop,
        onClose: noop,
      }),
    );

    expect(html).toContain('Aide en Partie');
    expect(html).toContain('Votre partie reste intacte');
    expect(html).toContain('type="search"');
    expect(html).toContain('12 Pièces (12)');
    expect(html).toContain(`16 Cartes &amp; FAQ (${Object.keys(CARD_CATALOG).length})`);
    expect(html).toContain('bw-idiagram-board-wrap');

    const closedHtml = renderToStaticMarkup(
      React.createElement(InGameHelpModal, {
        isOpen: false,
        viewerColor: 'red',
        dismissedContextualCount: 0,
        canResetContextualTips: false,
        onResetContextualTips: noop,
        onClose: noop,
      }),
    );
    expect(closedHtml).toBe('');
  });
});
