import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CHARACTER_DOSSIERS,
  autoCompletePlacement,
  createMatchState,
  projectMatchStateForViewer,
  submitPlayerPlacement,
  type ClientPieceView,
  type MatchPhase,
} from '../shared/src/index.js';
import { PieceDescriptionPanel } from '../client/src/components/PieceDescriptionPanel.js';

function unescapeHtml(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function makePieceView(overrides: Partial<ClientPieceView> = {}): ClientPieceView {
  return {
    id: 'piece-1',
    owner: 'red',
    position: { row: 6, col: 4 },
    character: 'roi',
    revealKind: 'permanent',
    isInvincible: false,
    isImmobilized: false,
    isExposedByEnemyEspionage: false,
    isProtectedVisible: false,
    hasKamikazeVisible: false,
    hasCounterEspionageVisible: false,
    kamikazeHitsTakenVisible: null,
    progressionDirectionVisible: null,
    ...overrides,
  };
}

describe('Panneau de description dynamique des pièces à gauche de l’échiquier (§4)', () => {
  it('displays a clean idle prompt when no piece or brush is active', () => {
    const html = renderToStaticMarkup(
      React.createElement(PieceDescriptionPanel, {
        viewerColor: 'red',
        phase: 'playing',
        inspectedCoord: null,
        piece: null,
      }),
    );
    expect(html).toContain('Fiche de pièce');
    expect(html).toContain('Cliquez sur un pion');
    expect(html).toContain('data-transparent-bg="true"');
  });

  it('displays full tactical details (transparent icon, name, role, moves, attacks, capabilities, restrictions) and updates dynamically', () => {
    const traqueurPiece = makePieceView({
      owner: 'red',
      position: { row: 5, col: 3 },
      character: 'traqueur',
      traqueurHasActiveMarkVisible: true,
      traqueurPursuitReadyVisible: true,
    });
    const traqueurHtml = renderToStaticMarkup(
      React.createElement(PieceDescriptionPanel, {
        viewerColor: 'red',
        phase: 'playing',
        inspectedCoord: traqueurPiece.position,
        piece: traqueurPiece,
        onClearSelection: () => {},
      }),
    );

    const traqueurDoc = CHARACTER_DOSSIERS.traqueur;
    const traqueurText = unescapeHtml(traqueurHtml);
    expect(traqueurHtml).toContain('data-transparent-bg="true"');
    expect(traqueurHtml).toContain('data-piece-kind="traqueur"');
    expect(traqueurText).toContain(traqueurDoc.name);
    expect(traqueurText).toContain(traqueurDoc.roleSummary);
    expect(traqueurText).toContain(traqueurDoc.movementSummary);
    expect(traqueurText).toContain(traqueurDoc.attackSummary);
    expect(traqueurText).toContain(traqueurDoc.specialAbility);
    expect(traqueurText).toContain(traqueurDoc.restrictions[0]!);
    expect(traqueurText).toContain('Poursuite (+1) prête');

    // Switching selection dynamically updates to another piece (e.g. Arbalétrier recharging)
    const arbaletrierPiece = makePieceView({
      owner: 'red',
      position: { row: 7, col: 2 },
      character: 'arbaletrier',
      arbaletrierCooldownTurnsVisible: 2,
    });
    const arbaletrierHtml = renderToStaticMarkup(
      React.createElement(PieceDescriptionPanel, {
        viewerColor: 'red',
        phase: 'playing',
        inspectedCoord: arbaletrierPiece.position,
        piece: arbaletrierPiece,
        onClearSelection: () => {},
      }),
    );

    expect(arbaletrierHtml).toContain(CHARACTER_DOSSIERS.arbaletrier.name);
    expect(arbaletrierHtml).toContain('Tir en recharge : 2 tour(s) perso');
    expect(arbaletrierHtml).not.toContain(traqueurDoc.name);
  });

  it('strictly hides identity, role, movements, attacks, and secret buffs for unrevealed enemy pieces (§4.3)', () => {
    // Even if an engine state holds a black King/Colossus with Protection+Kamikaze, client projection sets character=null
    let match = createMatchState('dossier-secrecy-test', 'online_custom');
    match = submitPlayerPlacement(match, 'red', autoCompletePlacement('red', []));
    match = submitPlayerPlacement(match, 'black', autoCompletePlacement('black', []));
    const view = projectMatchStateForViewer(match, 'red');
    const enemyPiece = view.pieces.find((p) => p.owner === 'black');
    expect(enemyPiece).toBeDefined();
    expect(enemyPiece!.character).toBeNull();

    const secretHtml = renderToStaticMarkup(
      React.createElement(PieceDescriptionPanel, {
        viewerColor: 'red',
        phase: view.phase as MatchPhase,
        inspectedCoord: enemyPiece!.position,
        piece: {
          ...enemyPiece!,
          isInvincible: true,
          traqueurMarkedByViewer: true,
        },
        onClearSelection: () => {},
      }),
    );

    expect(secretHtml).toContain('Unité adverse secrète');
    expect(secretHtml).toContain('Identité masquée');
    expect(secretHtml).toContain('Invincible');
    expect(secretHtml).toContain('Marquée par votre Traqueur');

    const secretTextWithoutOwnMark = secretHtml.replace('Marquée par votre Traqueur', '');
    for (const dossier of Object.values(CHARACTER_DOSSIERS)) {
      expect(secretTextWithoutOwnMark).not.toContain(dossier.name);
      expect(secretTextWithoutOwnMark).not.toContain(dossier.movementSummary);
      expect(secretTextWithoutOwnMark).not.toContain(dossier.attackSummary);
    }
    expect(secretHtml).not.toContain('Protection active');
    expect(secretHtml).not.toContain('Kamikaze armé');
  });

  it('mounts PieceDescriptionPanel inside the left sidebar before the board and adapts compact mobile mode without duplicate desktop strip', () => {
    const compactHtml = renderToStaticMarkup(
      React.createElement(PieceDescriptionPanel, {
        viewerColor: 'red',
        phase: 'playing',
        inspectedCoord: { row: 6, col: 4 },
        piece: makePieceView({ character: 'colosse', kamikazeHitsTakenVisible: 1 }),
        compact: true,
        onClearSelection: () => {},
      }),
    );
    expect(compactHtml).toContain('bw-piece-dossier-compact');
    expect(compactHtml).toContain('Kamikaze encaissés : 1/2');
    expect(compactHtml).not.toContain('Particularités &amp; interactions');

    const boardSource = fs.readFileSync(
      path.resolve(process.cwd(), 'client/src/ui/GameBoardScreen.tsx'),
      'utf8',
    );
    const leftSidebarIdx = boardSource.indexOf('<aside className="bw-sidebar bw-sidebar-left">');
    const centerBoardIdx = boardSource.indexOf('<main className="bw-board-center">');
    const dossierInLeftIdx = boardSource.indexOf('<PieceDescriptionPanel', leftSidebarIdx);
    const mobileSlotIdx = boardSource.indexOf('bw-mobile-piece-dossier-slot');

    expect(leftSidebarIdx).toBeGreaterThan(-1);
    expect(dossierInLeftIdx).toBeGreaterThan(leftSidebarIdx);
    expect(dossierInLeftIdx).toBeLessThan(centerBoardIdx);
    expect(mobileSlotIdx).toBeGreaterThan(centerBoardIdx);
    expect(boardSource).not.toContain('className="bw-piece-inspector"');
  });
});
