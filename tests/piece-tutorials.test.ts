import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ARMY_COMPOSITION,
  CHARACTER_CATALOG,
  CHARACTER_TYPES,
  PIECE_TUTORIALS,
  TUTORIAL_SCENARIOS,
  generateMoveCandidatesForPiece,
  type ServerPieceRecord,
} from '../shared/src/index.js';
import { InteractiveBoardDiagram } from '../client/src/components/InteractiveBoardDiagram.js';

function makePiece(
  id: string,
  owner: 'red' | 'black',
  character: (typeof CHARACTER_TYPES)[number],
  row: number,
  col: number,
): ServerPieceRecord {
  return {
    id,
    owner,
    character,
    promotedFrom: null,
    position: { row, col },
    alive: true,
    progressionDirection: owner === 'red' ? -1 : 1,
    reversalCount: 0,
    kamikazeHitsTaken: 0,
    hasKamikaze: false,
    invincibleTicksRemaining: 0,
    hasProtection: false,
    counterEspionageTicksRemaining: 0,
    espionageRevealedTicksTo: { red: 0, black: 0 },
    tempRevealedTicksTo: { red: 0, black: 0 },
    permanentlyRevealedTo: { red: false, black: false },
    immobilizedTicksRemaining: 0,
    traqueurMarkedTargetId: null,
    traqueurPursuitReady: false,
    arbaletrierCooldownTurnsRemaining: 0,
  };
}

describe('Tutoriels individuels des 12 pièces & Illustrations interactives (§3.1, §3.3)', () => {
  it('provides a complete 9-section tutorial and interactive diagram steps for every one of the 12 characters', () => {
    const scenarioIds = new Set(TUTORIAL_SCENARIOS.map((s) => s.id));

    for (const ch of CHARACTER_TYPES) {
      const tut = PIECE_TUTORIALS[ch];
      expect(tut).toBeDefined();
      expect(tut.id).toBe(ch);
      expect(tut.name).toBe(CHARACTER_CATALOG[ch].name);
      expect(tut.initialQuantity).toBe(ARMY_COMPOSITION[ch]);
      expect(tut.role.length).toBeGreaterThan(20);
      expect(tut.objective.length).toBeGreaterThan(20);
      expect(tut.movements.length).toBeGreaterThan(20);
      expect(tut.attacks.length).toBeGreaterThan(20);
      expect(tut.specialAbilities.length).toBeGreaterThan(20);
      expect(tut.restrictions.length).toBeGreaterThanOrEqual(2);
      expect(tut.specialConditions.length).toBeGreaterThanOrEqual(1);
      expect(tut.concreteExamples.length).toBeGreaterThanOrEqual(1);
      expect(tut.mistakesToAvoid.length).toBeGreaterThanOrEqual(1);
      expect(tut.demoSteps.length).toBeGreaterThanOrEqual(1);
      expect(scenarioIds.has(tut.linkedScenarioId)).toBe(true);
    }
  });

  it('matches the real game engine movement and capture rules without fictional rules (§3.1 / §7)', () => {
    const emptyVis = {
      fogTurnsRemainingByOwner: { red: 0, black: 0 },
      viewerGuetteurReconKeys: new Set<string>(),
    };

    // Soldat: straight ahead cannot capture; diagonal forward can capture
    const soldat = makePiece('s1', 'red', 'soldat', 4, 4);
    const enemyAhead = makePiece('e1', 'black', 'soldat', 3, 4);
    const enemyDiag = makePiece('e2', 'black', 'soldat', 3, 5);
    const soldatMoves = generateMoveCandidatesForPiece(soldat, [soldat, enemyAhead, enemyDiag], emptyVis);
    expect(soldatMoves.some((m) => m.to.row === 3 && m.to.col === 4)).toBe(false);
    expect(soldatMoves.some((m) => m.to.row === 3 && m.to.col === 5 && m.kind === 'capture_move')).toBe(true);
    expect(PIECE_TUTORIALS.soldat.attacks).toContain('diagonale avant');

    // Guetteur H moves diagonally vs Guetteur D moves orthogonally
    const gh = makePiece('gh1', 'red', 'guetteur_h', 4, 4);
    const gd = makePiece('gd1', 'red', 'guetteur_d', 4, 4);
    const ghMoves = generateMoveCandidatesForPiece(gh, [gh], emptyVis);
    const gdMoves = generateMoveCandidatesForPiece(gd, [gd], emptyVis);
    expect(ghMoves.every((m) => Math.abs(m.to.row - 4) === 1 && Math.abs(m.to.col - 4) === 1)).toBe(true);
    expect(gdMoves.every((m) => Math.abs(m.to.row - 4) + Math.abs(m.to.col - 4) === 1)).toBe(true);
    expect(PIECE_TUTORIALS.guetteur_h.movements).toContain('diagonale');
    expect(PIECE_TUTORIALS.guetteur_d.movements).toContain('horizontalement ou verticalement');

    // Colosse has 5 directions and never retreats
    const colosse = makePiece('co1', 'red', 'colosse', 4, 4);
    const colMoves = generateMoveCandidatesForPiece(colosse, [colosse], emptyVis);
    expect(colMoves).toHaveLength(5);
    expect(colMoves.every((m) => m.to.row <= 4)).toBe(true);
    expect(PIECE_TUTORIALS.colosse.movements).toContain('5 directions');
  });

  it('renders interactive mini-board diagrams with transparent pieces, colored zones, and vector arrows', () => {
    const html = renderToStaticMarkup(
      React.createElement(InteractiveBoardDiagram, {
        steps: PIECE_TUTORIALS.executeur.demoSteps,
        viewerColor: 'red',
      }),
    );

    expect(html).toContain('Frappe traversante');
    expect(html).toContain('bw-idiagram-board-wrap');
    expect(html).toContain('data-transparent-bg="true"');
    expect(html).toContain('<marker');
    expect(html).toContain('<line');
    expect(html).toContain('Étape suiv.');
  });
});
