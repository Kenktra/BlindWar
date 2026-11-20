import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CARD_TYPES,
  CHARACTER_TYPES,
  CLASSIC_THEMES_CATALOG,
  DEFAULT_USER_PREFERENCES,
  OFFICIAL_RULESET_CONFIG,
  PIXEL_ART_THEMES_CATALOG,
  autoCompletePlacement,
  createMatchState,
  executePieceMove,
  generateMoveCandidatesForPiece,
  generateTraqueurMarkCandidates,
  getThemePresetForVisualStyle,
  getThemesForVisualStyle,
  markTraqueurTarget,
  projectMatchStateForViewer,
  proposeOrAcceptMutualDraw,
  resignMatch,
  sanitizeUserPreferences,
  skipBerserkerRageMove,
  stopCavalierJumpChain,
  submitPlayerPlacement,
  type ClientActionLogEntryView,
  type ServerMatchState,
  type ServerPieceRecord,
  type VisibilityContext,
} from '../shared/src/index.js';
import { PhaserBoardCanvas } from '../client/src/board/PhaserBoardCanvas.js';
import { CardArtwork } from '../client/src/components/CardArtwork.js';
import { PieceArtwork } from '../client/src/components/PieceArtwork.js';
import { SettingsScreen } from '../client/src/components/SettingsScreen.js';
import { ThemeProvider } from '../client/src/themes/themeManager.js';
import {
  GameBoardScreen,
  buildPairedTurnHistory,
} from '../client/src/ui/GameBoardScreen.js';

const TEST_VISIBILITY_CONTEXT: VisibilityContext = {
  fogTurnsRemainingByOwner: { red: 0, black: 0 },
  viewerGuetteurReconKeys: new Set<string>(),
};

function makeTestPiece(
  id: string,
  owner: 'red' | 'black',
  character: ServerPieceRecord['character'],
  row: number,
  col: number,
  extra?: Partial<ServerPieceRecord>,
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
    arbaletrierCooldownTurnsRemaining: 0,
    traqueurMarkedTargetId: null,
    ...extra,
  };
}

function makePlayingLocalMatch(pieces: ServerPieceRecord[]): ServerMatchState {
  const base = createMatchState('local-full-test', 'local', OFFICIAL_RULESET_CONFIG);
  return {
    ...base,
    phase: 'playing',
    pieces,
    players: {
      red: { ...base.players.red, placementConfirmed: true },
      black: { ...base.players.black, placementConfirmed: true },
    },
  };
}

describe('Stabilisation complète du Mode Local, Traqueur multi-tours, Historique et Double Style Visuel (Classique vs Pixel Art)', () => {
  it('1. démarre une partie locale, valide le placement des 2 joueurs, alterne les tours et exclut les messages de début/placement de l’historique des coups', () => {
    let match = createMatchState('local-start-1', 'local', OFFICIAL_RULESET_CONFIG);
    expect(match.phase).toBe('placement');

    const redEntries = autoCompletePlacement('red', []);
    const blackEntries = autoCompletePlacement('black', []);
    expect(redEntries).toHaveLength(27);
    expect(blackEntries).toHaveLength(27);

    match = submitPlayerPlacement(match, 'red', redEntries, 1000);
    expect(match.players.red.placementConfirmed).toBe(true);
    expect(match.phase).toBe('placement');

    match = submitPlayerPlacement(match, 'black', blackEntries, 2000);
    expect(match.players.black.placementConfirmed).toBe(true);
    expect(match.phase).toBe('playing');
    expect(match.turn.activePlayer).toBe('red');
    expect(match.turn.turnNumber).toBe(1);

    // Match start log exists in actionLog, but buildPairedTurnHistory must ignore it before moves are played
    const viewAtStart = projectMatchStateForViewer(match, 'red');
    expect(buildPairedTurnHistory(viewAtStart.actionLog, viewAtStart.pieces)).toHaveLength(0);

    // Play 4 alternating turns (Red -> Black -> Red -> Black)
    for (let step = 0; step < 4; step += 1) {
      const active = match.turn.activePlayer;
      const inactive = active === 'red' ? 'black' : 'red';

      // Verify out-of-turn action by inactive player is strictly rejected
      const inactivePiece = match.pieces.find((p) => p.alive && p.owner === inactive)!;
      expect(() =>
        executePieceMove(match, inactive, inactivePiece.id, { row: 4, col: 4 }, 3000 + step * 100),
      ).toThrow();

      // Execute a legal move for active player
      let moved = false;
      for (const piece of match.pieces.filter((p) => p.alive && p.owner === active)) {
        const candidates = generateMoveCandidatesForPiece(
          piece,
          match.pieces,
          TEST_VISIBILITY_CONTEXT,
        );
        if (candidates.length > 0) {
          match = executePieceMove(
            match,
            active,
            piece.id,
            candidates[0]!.to,
            3050 + step * 100,
            Math.random,
            candidates[0]!.kind,
          );
          moved = true;
          break;
        }
      }
      expect(moved).toBe(true);
      expect(match.turn.activePlayer).toBe(inactive);
    }

    const viewAfter4Plies = projectMatchStateForViewer(match, 'red');
    const pairedHistory = buildPairedTurnHistory(
      viewAfter4Plies.actionLog,
      viewAfter4Plies.pieces,
    );
    expect(pairedHistory).toHaveLength(2);
    expect(pairedHistory[0]!.turnNumber).toBe(1);
    expect(pairedHistory[0]!.redMoves.length).toBeGreaterThan(0);
    expect(pairedHistory[0]!.blackMoves.length).toBeGreaterThan(0);
    expect(pairedHistory[1]!.turnNumber).toBe(2);
    expect(pairedHistory[1]!.redMoves.length).toBeGreaterThan(0);
    expect(pairedHistory[1]!.blackMoves.length).toBeGreaterThan(0);
  });

  it('2. empêche la rétro-altération des étiquettes de l’historique lorsqu’une autre pièce occupe plus tard la même case', () => {
    const match = makePlayingLocalMatch([
      makeTestPiece('r-roi', 'red', 'roi', 8, 4),
      makeTestPiece('b-roi', 'black', 'roi', 0, 4),
      // Now a Cavalier sits on E5 (row 4, col 4), whereas turn 1 log entry was a mysterious move to E5
      makeTestPiece('r-cav', 'red', 'cavalier', 4, 4),
    ]);
    const view = projectMatchStateForViewer(match, 'red');
    const logs: readonly ClientActionLogEntryView[] = [
      {
        seq: 1,
        turnNumber: 1,
        timestampMs: 1000,
        actor: 'red',
        eventType: 'PIECE_MOVED',
        icon: 'DEPL',
        text: 'Rouge déplace un pion de E4 vers E5.',
        cardNotification: null,
      },
      {
        seq: 2,
        turnNumber: 1,
        timestampMs: 2000,
        actor: 'black',
        eventType: 'PIECE_MOVED',
        icon: 'DEPL',
        text: 'Noir déplace un pion de D7 vers D6.',
        cardNotification: null,
      },
      {
        seq: 3,
        turnNumber: 2,
        timestampMs: 3000,
        actor: 'red',
        eventType: 'PIECE_MOVED',
        icon: 'DEPL',
        text: 'Rouge déplace un pion de E5 vers E6.',
        cardNotification: null,
      },
      {
        seq: 4,
        turnNumber: 2,
        timestampMs: 4000,
        actor: 'red',
        eventType: 'PIECE_MOVED',
        icon: 'DEPL',
        text: 'Rouge déplace Cavalier de C4 vers E5.',
        cardNotification: null,
      },
    ];

    const paired = buildPairedTurnHistory(logs, view.pieces);
    const metaTurn1 = paired[0]!.redMoves[0]!;
    // Because E5 was modified later in logs (seq 3 and seq 4), seq 1 must NOT be mislabeled as Cavalier
    expect(metaTurn1.pieceTypeKnown).toBeNull();
    expect(metaTurn1.compactMove).toBe('E4→E5');
  });

  it('3. gère plusieurs cycles du Traqueur (portée 2, capture normale à 1-2 sans détournement, ciblage 0 PA sur l’échiquier et Poursuite à 4 cases)', () => {
    let state = makePlayingLocalMatch([
      makeTestPiece('r-roi', 'red', 'roi', 8, 4),
      makeTestPiece('b-roi', 'black', 'roi', 0, 4),
      makeTestPiece('r-traq', 'red', 'traqueur', 7, 4),
      // Enemy 1 at distance 2 (adjacent capture or normal range)
      makeTestPiece('b-near', 'black', 'soldat', 5, 4, {
        permanentlyRevealedTo: { red: true, black: false },
      }),
      // Enemy 2 at distance 4 (out of base range 2, reachable only via Pursuit 4)
      makeTestPiece('b-far', 'black', 'reine', 1, 4, {
        permanentlyRevealedTo: { red: true, black: false },
      }),
      // Enemy 3 for second Traqueur cycle
      makeTestPiece('b-second', 'black', 'assassin', 1, 0, {
        permanentlyRevealedTo: { red: true, black: false },
      }),
    ]);

    const traq0 = state.pieces.find((p) => p.id === 'r-traq')!;

    // Base range without mark: max 2 squares -> can capture b-near at (5,4), cannot reach (1,4)
    const baseMoves = generateMoveCandidatesForPiece(traq0, state.pieces, TEST_VISIBILITY_CONTEXT);
    expect(
      baseMoves.some((m) => m.to.row === 5 && m.to.col === 4 && m.kind === 'capture_move'),
    ).toBe(true);
    expect(baseMoves.some((m) => Math.abs(m.to.row - 7) > 2)).toBe(false);

    // Cycle 1A: Normal capture at distance 2 (without marking) works directly
    state = executePieceMove(
      state,
      'red',
      'r-traq',
      { row: 5, col: 4 },
      1000,
      Math.random,
      'capture_move',
    );
    expect(state.pieces.find((p) => p.id === 'b-near')?.alive).toBe(false);
    expect(state.turn.activePlayer).toBe('black');

    // Black passes a turn with King move
    state = executePieceMove(
      state,
      'black',
      'b-roi',
      { row: 0, col: 5 },
      2000,
      Math.random,
      'normal_move',
    );
    expect(state.turn.activePlayer).toBe('red');

    // Cycle 1B: Red Traqueur at (5,4) targets b-far at (1,4) (distance 4) for 0 PA
    const traqAt54 = state.pieces.find((p) => p.id === 'r-traq')!;
    const markCandidates = generateTraqueurMarkCandidates(
      traqAt54,
      state.pieces,
      TEST_VISIBILITY_CONTEXT,
    );
    expect(markCandidates.some((target) => target.id === 'b-far')).toBe(true);

    state = markTraqueurTarget(state, 'red', 'r-traq', 'b-far', 3000);
    expect(state.turn.activePlayer).toBe('red');
    expect(state.turn.remainingActions).toBe(1);

    const traqMarked = state.pieces.find((p) => p.id === 'r-traq')!;
    expect(traqMarked.traqueurMarkedTargetId).toBe('b-far');

    // Now Pursuit unlocks 4-square capture on b-far at (1,4)
    const pursuitMoves = generateMoveCandidatesForPiece(
      traqMarked,
      state.pieces,
      TEST_VISIBILITY_CONTEXT,
    );
    expect(
      pursuitMoves.some(
        (m) => m.to.row === 1 && m.to.col === 4 && m.kind === 'capture_move',
      ),
    ).toBe(true);

    // Execute 4-square Pursuit capture on b-far
    state = executePieceMove(
      state,
      'red',
      'r-traq',
      { row: 1, col: 4 },
      3500,
      Math.random,
      'capture_move',
    );
    expect(state.pieces.find((p) => p.id === 'b-far')?.alive).toBe(false);
    expect(state.pieces.find((p) => p.id === 'r-traq')?.traqueurMarkedTargetId).toBeNull();

    // Black moves King
    state = executePieceMove(
      state,
      'black',
      'b-roi',
      { row: 0, col: 6 },
      4000,
      Math.random,
      'normal_move',
    );

    // Cycle 2: Red Traqueur at (1,4) marks b-second at (1,0) (horizontal distance 4) and captures it
    state = markTraqueurTarget(state, 'red', 'r-traq', 'b-second', 5000);
    expect(state.pieces.find((p) => p.id === 'r-traq')?.traqueurMarkedTargetId).toBe('b-second');
    state = executePieceMove(
      state,
      'red',
      'r-traq',
      { row: 1, col: 0 },
      5500,
      Math.random,
      'capture_move',
    );
    expect(state.pieces.find((p) => p.id === 'b-second')?.alive).toBe(false);
    expect(state.pieces.find((p) => p.id === 'r-traq')?.traqueurMarkedTargetId).toBeNull();
  });

  it('4. vérifie les capacités spéciales (Cavalier chaîne de sauts, Berserker Rage, Exécuteur frappe perforante, Arbalétrier tir à distance) et les fins de partie', () => {
    let state = makePlayingLocalMatch([
      makeTestPiece('r-roi', 'red', 'roi', 8, 4),
      makeTestPiece('b-roi', 'black', 'roi', 0, 4),
      makeTestPiece('r-cav', 'red', 'cavalier', 6, 2),
      makeTestPiece('b-victim1', 'black', 'soldat', 5, 2),
      makeTestPiece('r-ber', 'red', 'berserker', 6, 6),
      makeTestPiece('b-victim2', 'black', 'soldat', 5, 6),
      makeTestPiece('r-exec', 'red', 'executeur', 6, 0),
      makeTestPiece('b-front', 'black', 'soldat', 5, 0),
      makeTestPiece('b-victim3', 'black', 'soldat', 4, 0),
      makeTestPiece('r-arba', 'red', 'arbaletrier', 6, 8),
      makeTestPiece('b-victim4', 'black', 'soldat', 4, 8, {
        permanentlyRevealedTo: { red: true, black: false },
      }),
    ]);

    // 1) Cavalier jump over b-victim1 from (6,2) to (4,2), then voluntary stop if chain open
    state = executePieceMove(
      state,
      'red',
      'r-cav',
      { row: 4, col: 2 },
      1000,
      Math.random,
      'cavalier_jump',
    );
    expect(state.pieces.find((p) => p.id === 'b-victim1')?.alive).toBe(false);
    if (state.turn.pendingCavalierJumpPieceId) {
      state = stopCavalierJumpChain(state, 'red', 1100);
    }
    expect(state.turn.activePlayer).toBe('black');

    // Black moves King
    state = executePieceMove(
      state,
      'black',
      'b-roi',
      { row: 0, col: 5 },
      2000,
      Math.random,
      'normal_move',
    );

    // 2) Berserker captures b-victim2 -> triggers Berserker Rage -> skip rage
    state = executePieceMove(
      state,
      'red',
      'r-ber',
      { row: 5, col: 6 },
      3000,
      Math.random,
      'capture_move',
    );
    expect(state.turn.pendingBerserkerRagePieceId).toBe('r-ber');
    state = skipBerserkerRageMove(state, 'red', 3100);
    expect(state.turn.activePlayer).toBe('black');

    // Black moves King
    state = executePieceMove(
      state,
      'black',
      'b-roi',
      { row: 0, col: 4 },
      4000,
      Math.random,
      'normal_move',
    );

    // 3) Exécuteur piercing strike through b-front at (5,0) to eliminate b-victim3 at (4,0)
    state = executePieceMove(
      state,
      'red',
      'r-exec',
      { row: 4, col: 0 },
      5000,
      Math.random,
      'piercing_strike',
    );
    expect(state.pieces.find((p) => p.id === 'b-front')?.alive).toBe(true);
    expect(state.pieces.find((p) => p.id === 'b-victim3')?.alive).toBe(false);
    expect(state.turn.activePlayer).toBe('black');

    // Black moves King
    state = executePieceMove(
      state,
      'black',
      'b-roi',
      { row: 0, col: 5 },
      6000,
      Math.random,
      'normal_move',
    );

    // 4) Arbalétrier ranged shot on b-victim4 at (4,8) without moving from (6,8)
    state = executePieceMove(
      state,
      'red',
      'r-arba',
      { row: 4, col: 8 },
      7000,
      Math.random,
      'crossbow_shot',
    );
    expect(state.pieces.find((p) => p.id === 'b-victim4')?.alive).toBe(false);
    expect(state.pieces.find((p) => p.id === 'r-arba')?.position).toEqual({ row: 6, col: 8 });
    expect(
      state.pieces.find((p) => p.id === 'r-arba')?.arbaletrierCooldownTurnsRemaining,
    ).toBeGreaterThan(0);

    // 5) End of game via resignation and mutual draw
    const resigned = resignMatch(state, 'black', 8000);
    expect(resigned.phase).toBe('finished');
    expect(resigned.winner).toBe('red');

    const drawOffered = proposeOrAcceptMutualDraw(state, 'black', 8100);
    const drawAccepted = proposeOrAcceptMutualDraw(drawOffered, 'red', 8200);
    expect(drawAccepted.phase).toBe('finished');
    expect(drawAccepted.winner).toBe('draw');
  });

  it('5. sépare clairement le Style classique et le Style Pixel Art (13 pièces, 16 cartes, échiquier, catalogue filtré et bascule en cours de partie)', () => {
    // Catalog separation
    const classicThemes = getThemesForVisualStyle('classic');
    const pixelThemes = getThemesForVisualStyle('pixel_art');
    expect(classicThemes).toHaveLength(CLASSIC_THEMES_CATALOG.length);
    expect(pixelThemes).toHaveLength(PIXEL_ART_THEMES_CATALOG.length);
    expect(classicThemes.every((t) => t.styleCategory === 'classic')).toBe(true);
    expect(pixelThemes.every((t) => t.styleCategory === 'pixel_art')).toBe(true);
    expect(pixelThemes.some((t) => t.themeId === 'purple_night')).toBe(true);

    // Safe fallback for invalid or cross-category theme ID
    const fallbackClassic = getThemePresetForVisualStyle('unknown_theme_xyz', 'classic');
    expect(fallbackClassic.styleCategory).toBe('classic');
    expect(fallbackClassic.themeId).toBe('rouge_et_noir');

    // All 13 pieces + secret render vector silhouettes in 'classic' and 16x16 sprites in 'pixel_art'
    for (const char of [...CHARACTER_TYPES, 'secret'] as const) {
      const classicPieceHtml = renderToStaticMarkup(
        React.createElement(PieceArtwork, {
          character: char,
          owner: 'red',
          visualStyle: 'classic',
        }),
      );
      const pixelPieceHtml = renderToStaticMarkup(
        React.createElement(PieceArtwork, {
          character: char,
          owner: 'red',
          visualStyle: 'pixel_art',
        }),
      );
      expect(classicPieceHtml).toContain('data-visual-style="classic"');
      expect(classicPieceHtml).not.toContain('data-pixel-grid="16x16"');
      expect(pixelPieceHtml).toContain('data-visual-style="pixel_art"');
      expect(pixelPieceHtml).toContain('data-pixel-grid="16x16"');
      expect(pixelPieceHtml).not.toBe(classicPieceHtml);
    }

    // All 16 cards render classic vector silhouettes in 'classic' and 16x16 sprites in 'pixel_art'
    for (const card of CARD_TYPES) {
      const classicCardHtml = renderToStaticMarkup(
        React.createElement(CardArtwork, {
          card,
          visualStyle: 'classic',
        }),
      );
      const pixelCardHtml = renderToStaticMarkup(
        React.createElement(CardArtwork, {
          card,
          visualStyle: 'pixel_art',
        }),
      );
      expect(classicCardHtml).toContain('data-visual-style="classic"');
      expect(classicCardHtml).not.toContain('data-pixel-grid="16x16"');
      expect(pixelCardHtml).toContain('data-visual-style="pixel_art"');
      expect(pixelCardHtml).toContain('data-pixel-grid="16x16"');
      expect(pixelCardHtml).not.toBe(classicCardHtml);
    }

    // SettingsScreen filters the theme cards grid by selected category ('classic' vs 'pixel_art')
    const classicPrefs = sanitizeUserPreferences({
      ...DEFAULT_USER_PREFERENCES,
      visualStyle: 'classic',
      siteThemeId: 'rouge_et_noir',
    });
    const pixelPrefs = sanitizeUserPreferences({
      ...DEFAULT_USER_PREFERENCES,
      visualStyle: 'pixel_art',
      siteThemeId: 'purple_night',
    });

    const classicSettingsHtml = renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        {
          preferences: classicPrefs,
          children: React.createElement(SettingsScreen, {
            preferences: classicPrefs,
            userProfile: null,
            onUpdatePreferences: () => {},
            onResetAll: () => {},
            onGoToProfile: () => {},
            onGoToAuth: () => {},
          }),
        },
      ),
    );
    expect(classicSettingsHtml).toContain('data-theme-category="classic"');
    expect(classicSettingsHtml).toContain('data-theme-card-style="classic"');
    expect(classicSettingsHtml).not.toContain('data-theme-card-style="pixel_art"');

    const pixelSettingsHtml = renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        {
          preferences: pixelPrefs,
          children: React.createElement(SettingsScreen, {
            preferences: pixelPrefs,
            userProfile: null,
            onUpdatePreferences: () => {},
            onResetAll: () => {},
            onGoToProfile: () => {},
            onGoToAuth: () => {},
          }),
        },
      ),
    );
    expect(pixelSettingsHtml).toContain('data-theme-category="pixel_art"');
    expect(pixelSettingsHtml).toContain('data-theme-card-style="pixel_art"');
    expect(pixelSettingsHtml).not.toContain('data-theme-card-style="classic"');

    // Switching style mid-game updates the board rendering without resetting or altering match state
    const ongoingMatch = makePlayingLocalMatch([
      makeTestPiece('r-roi', 'red', 'roi', 8, 4),
      makeTestPiece('b-roi', 'black', 'roi', 0, 4),
      makeTestPiece('r-traq', 'red', 'traqueur', 6, 4),
    ]);

    const classicGameHtml = renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        {
          preferences: classicPrefs,
          children: React.createElement(GameBoardScreen, {
            mode: 'local',
            initialLocalState: ongoingMatch,
            settings: classicPrefs,
            onChangeTheme: () => {},
            onChangeVisualStyle: () => {},
            onMatchConcluded: () => {},
            onExitToMenu: () => {},
          }),
        },
      ),
    );
    expect(classicGameHtml).toContain('bw-game-layout bw-style-classic');
    expect(classicGameHtml).toContain('data-pixel-board="false"');
    expect(classicGameHtml).not.toContain('bw-pixel-tile-sprite');
    expect(classicGameHtml).toContain('🔄 Recommencer');

    const pixelGameHtml = renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        {
          preferences: pixelPrefs,
          children: React.createElement(GameBoardScreen, {
            mode: 'local',
            initialLocalState: ongoingMatch,
            settings: pixelPrefs,
            onChangeTheme: () => {},
            onChangeVisualStyle: () => {},
            onMatchConcluded: () => {},
            onExitToMenu: () => {},
          }),
        },
      ),
    );
    expect(pixelGameHtml).toContain('bw-game-layout bw-style-pixel_art');
    expect(pixelGameHtml).toContain('data-pixel-board="true"');
    expect(pixelGameHtml).toContain('bw-pixel-tile-sprite');
    expect(pixelGameHtml).toContain('🔄 Recommencer');
  });
});
