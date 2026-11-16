import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CHARACTER_DOSSIERS,
  autoCompletePlacement,
  createMatchState,
  projectMatchStateForViewer,
  submitPlayerPlacement,
  type ClientPieceView,
} from '../shared/src/index.js';
import { BlindWarDatabase } from '../server/src/database/db.js';
import { GameRoomManager } from '../server/src/rooms/roomManager.js';
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
    id: 'piece-layout-1',
    owner: 'red',
    position: { row: 6, col: 4 },
    character: 'traqueur',
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

describe("Réorganisation complète de l'interface de partie sans scroll inutile (§4)", () => {
  let tempDbPath: string;
  let db: BlindWarDatabase;
  let rooms: GameRoomManager;

  beforeEach(() => {
    tempDbPath = path.join(os.tmpdir(), `bw-ui-layout-${Date.now()}-${Math.random()}.json`);
    db = new BlindWarDatabase({ diskFilePath: tempDbPath });
    rooms = new GameRoomManager(db);
  });

  afterEach(() => {
    rooms.dispose();
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  });

  it('renders PieceDescriptionPanel in compact 2-column Move/Attack layout with collapsible interactions and strict secrecy on hidden pieces', () => {
    const pieceHtml = renderToStaticMarkup(
      React.createElement(PieceDescriptionPanel, {
        viewerColor: 'red',
        phase: 'playing',
        inspectedCoord: { row: 5, col: 4 },
        piece: makePieceView({
          character: 'executeur',
          position: { row: 5, col: 4 },
        }),
      }),
    );
    const pieceText = unescapeHtml(pieceHtml);
    expect(pieceHtml).toContain('bw-piece-dossier-duo');
    expect(pieceHtml).toContain('bw-piece-dossier-details');
    expect(pieceText).toContain(CHARACTER_DOSSIERS.executeur.name);
    expect(pieceText).toContain(CHARACTER_DOSSIERS.executeur.movementSummary);
    expect(pieceText).toContain(CHARACTER_DOSSIERS.executeur.attackSummary);
    expect(pieceText).toContain(CHARACTER_DOSSIERS.executeur.specialAbility);

    // Mobile / compact drawer variant still applies compact container class
    const compactHtml = renderToStaticMarkup(
      React.createElement(PieceDescriptionPanel, {
        viewerColor: 'red',
        phase: 'playing',
        inspectedCoord: { row: 5, col: 4 },
        piece: makePieceView({ character: 'arbaletrier' }),
        compact: true,
      }),
    );
    expect(compactHtml).toContain('bw-piece-dossier-compact');

    // Hidden enemy piece must NEVER leak its character identity
    let match = createMatchState('layout-secrecy-test', 'local');
    match = submitPlayerPlacement(match, 'red', autoCompletePlacement('red', []));
    match = submitPlayerPlacement(match, 'black', autoCompletePlacement('black', []));
    const redView = projectMatchStateForViewer(match, 'red');
    const hiddenEnemy = redView.pieces.find((p) => p.owner === 'black' && p.character === null);
    expect(hiddenEnemy).toBeDefined();

    const secretHtml = renderToStaticMarkup(
      React.createElement(PieceDescriptionPanel, {
        viewerColor: 'red',
        phase: 'playing',
        inspectedCoord: hiddenEnemy!.position,
        piece: hiddenEnemy!,
      }),
    );
    expect(secretHtml).toContain('Unité adverse secrète');
    expect(secretHtml).not.toContain('Arbalétrier');
    expect(secretHtml).not.toContain('Traqueur');
  });

  it('propagates optional player displayName, avatarBadge, avatarImage and eloRating into RoomLobbySnapshot without breaking room mechanics', () => {
    const room = rooms.createCustomRoom({
      userId: 'red-ui-1',
      username: 'StrategistRed',
      displayName: 'Commandant Rouge',
      avatarBadge: '♔',
      avatarImage: null,
      eloRating: 1340,
      socketId: 'sock-r1',
    });

    rooms.joinCustomRoomByCode(room.roomCode, {
      userId: 'black-ui-1',
      username: 'TacticianBlack',
      displayName: 'Ombre Noire',
      avatarBadge: '♛',
      avatarImage: 'data:image/png;base64,iVBORw0KGgo=',
      eloRating: 1410,
      socketId: 'sock-b1',
    });

    const snapshot = rooms.getLobbySnapshot(room, 1_000);
    expect(snapshot.redPlayer?.displayName).toBe('Commandant Rouge');
    expect(snapshot.redPlayer?.avatarBadge).toBe('♔');
    expect(snapshot.redPlayer?.eloRating).toBe(1340);
    expect(snapshot.blackPlayer?.displayName).toBe('Ombre Noire');
    expect(snapshot.blackPlayer?.avatarBadge).toBe('♛');
    expect(snapshot.blackPlayer?.avatarImage).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(snapshot.blackPlayer?.eloRating).toBe(1410);
  });

  it('structures GameBoardScreen and styles.css with top player banners, left dossier, tabbed right hub, bottom bar, collapsible annotations and 100vh desktop fit', () => {
    const gameScreenSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'client/src/ui/GameBoardScreen.tsx'),
      'utf8',
    );
    const css = fs.readFileSync(path.resolve(process.cwd(), 'client/src/styles.css'), 'utf8');

    // Top player banners with ELO + PieceAvatar + turn indicator
    expect(gameScreenSrc).toContain('bw-player-banner bw-player-banner-red');
    expect(gameScreenSrc).toContain('bw-player-banner bw-player-banner-black');
    expect(gameScreenSrc).toContain('bw-elo-mini');
    expect(gameScreenSrc).toContain('PieceAvatar');

    // Right sidebar tabbed hub (Partie | Historique | Aide + tablet tabs Pièce | Cartes)
    expect(gameScreenSrc).toContain('bw-right-hub-panel');
    expect(gameScreenSrc).toContain('bw-right-hub-tabs');
    expect(gameScreenSrc).toContain('📊 Partie');
    expect(gameScreenSrc).toContain('📜 Historique');
    expect(gameScreenSrc).toContain('📖 Aide');
    expect(gameScreenSrc).toContain('♟️ Pièce');
    expect(gameScreenSrc).toContain('🃏 Cartes');

    // Contextual bottom bar + collapsible Annotations popover + non-blocking InGameHelpModal
    expect(gameScreenSrc).toContain('bw-game-bottombar');
    expect(gameScreenSrc).toContain('bw-annotation-popover');
    expect(gameScreenSrc).toContain('InGameHelpModal');

    // Desktop 100vh no-scroll shell + tablet 2-col layout + 2-column compact placement palette
    expect(css).toContain('@media (min-width: 1041px)');
    expect(css).toContain('height: 100vh;');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(css).toContain('.bw-right-hub-panel');
    expect(css).toContain('.bw-game-bottombar');
  });
});
