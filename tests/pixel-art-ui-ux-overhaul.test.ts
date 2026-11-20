import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  AI_DIFFICULTIES,
  AI_DIFFICULTY_CATALOG,
  BLIND_WAR_THEMES,
  DEFAULT_USER_PREFERENCES,
  TRAINING_SITUATIONS,
  chooseAiPlacement,
  createAiTrainingMatch,
  executeAiTurnStep,
  executePieceMove,
  generateTraqueurMarkCandidates,
  getThemeDefinition,
  markTraqueurTarget,
  projectMatchStateForSpectator,
  projectMatchStateForViewer,
  resolveThemeIdAlias,
  sanitizeUserPreferences,
  verifyThemeCardContrast,
  verifyThemePieceContrastAcrossSquareStates,
} from '../shared/src/index.js';
import { PhaserBoardCanvas } from '../client/src/board/PhaserBoardCanvas.js';
import { SettingsScreen } from '../client/src/components/SettingsScreen.js';
import { ThemeProvider } from '../client/src/themes/themeManager.js';
import {
  GameBoardScreen,
  buildPairedTurnHistory,
  extractCompactMoveMeta,
} from '../client/src/ui/GameBoardScreen.js';

describe('Refonte UI/UX Pixel Art Minimaliste, Échiquier Dynamique, Historique à Gauche, Ciblage Direct Traqueur & Modes IA/Spectateur (§1–15)', () => {
  it('1. resolves all 5 requested customizable themes (Pixel Red, Classic Chess, Monochrome, Ocean, Purple Night) with >= 4.0 WCAG contrast', () => {
    expect(resolveThemeIdAlias('pixel_red')).toBe('rouge_et_noir');
    expect(resolveThemeIdAlias('classic_chess')).toBe('vert_et_beige');
    expect(resolveThemeIdAlias('monochrome')).toBe('noir_et_blanc');
    expect(resolveThemeIdAlias('ocean')).toBe('bleu_et_argent');
    expect(resolveThemeIdAlias('purple_night')).toBe('purple_night');

    expect(getThemeDefinition('pixel_red').name).toContain('Pixel Red');
    expect(getThemeDefinition('classic_chess').name).toContain('Classic Chess');
    expect(getThemeDefinition('monochrome').name).toContain('Monochrome');
    expect(getThemeDefinition('ocean').name).toContain('Ocean');
    expect(getThemeDefinition('purple_night').name).toContain('Purple Night');

    const purpleTheme = BLIND_WAR_THEMES.purple_night;
    expect(purpleTheme.board.squareA).toBe('#6D28D9');
    expect(purpleTheme.board.squareB).toBe('#120C1C');

    for (const r of verifyThemePieceContrastAcrossSquareStates(purpleTheme)) {
      expect(r.effectiveVisibilityContrast).toBeGreaterThanOrEqual(4.0);
    }
    for (const mode of ['dark', 'light'] as const) {
      for (const r of verifyThemeCardContrast(purpleTheme, mode)) {
        expect(r.effectiveVisibilityContrast).toBeGreaterThanOrEqual(4.0);
      }
    }
  });

  it('2. adapts board size dynamically according to active player turn (bw-board-turn-yours vs bw-board-turn-opponent) without layout shift', () => {
    const drill = TRAINING_SITUATIONS[0]!.createInitialState();
    const redView = projectMatchStateForViewer(drill, 'red');

    const myTurnHtml = renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        {
          preferences: DEFAULT_USER_PREFERENCES,
          children: React.createElement(PhaserBoardCanvas, {
            phase: 'playing',
            viewerColor: 'red',
            isViewerTurn: true,
            dynamicBoardScale: true,
            boardScale: 'normal',
            pieces: redView.pieces,
            selectedCoord: null,
            highlightedMoves: [],
            highlightedCardSquares: [],
            guetteurReconCoords: [],
            ownTraps: [],
            showCoordinates: true,
            showReconZones: true,
            onSquareClick: () => {},
          }),
        },
      ),
    );
    expect(myTurnHtml).toContain('bw-board-turn-yours');
    expect(myTurnHtml).toContain('data-board-turn-state="yours"');
    expect(myTurnHtml).toContain('À VOTRE TOUR — INTERACTIONS ACTIVES');

    const oppTurnHtml = renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        {
          preferences: DEFAULT_USER_PREFERENCES,
          children: React.createElement(PhaserBoardCanvas, {
            phase: 'playing',
            viewerColor: 'red',
            isViewerTurn: false,
            opponentStatusLabel: '🤖 L’IA réfléchit…',
            dynamicBoardScale: true,
            boardScale: 'compact',
            pieces: redView.pieces,
            selectedCoord: null,
            highlightedMoves: [],
            highlightedCardSquares: [],
            guetteurReconCoords: [],
            ownTraps: [],
            showCoordinates: true,
            showReconZones: true,
            onSquareClick: () => {},
          }),
        },
      ),
    );
    expect(oppTurnHtml).toContain('bw-board-turn-opponent');
    expect(oppTurnHtml).toContain('bw-board-scale-compact');
    expect(oppTurnHtml).toContain('data-board-turn-state="opponent"');
    expect(oppTurnHtml).toContain('🤖 L’IA réfléchit…');
  });

  it('3. renders the collapsible Left Move History Panel paired by turn (Player 1 / Player 2, known piece, captures, latest highlight)', () => {
    let state = TRAINING_SITUATIONS[0]!.createInitialState();
    // Red moves Soldier C3 (row 6, col 2) -> C4 (row 5, col 2)
    state = executePieceMove(state, 'red', 'r-sol1', { row: 5, col: 2 }, 1000);
    // Black moves Soldier E8 (row 1, col 4) -> E7 (row 2, col 4)
    state = executePieceMove(state, 'black', 'b-sol1', { row: 2, col: 4 }, 2000);

    const view = projectMatchStateForViewer(state, 'red');
    const paired = buildPairedTurnHistory(view.actionLog, view.pieces);
    expect(paired.length).toBeGreaterThanOrEqual(1);
    expect(paired[0]!.turnNumber).toBe(1);
    expect(paired[0]!.redMoves.length).toBeGreaterThanOrEqual(1);
    expect(paired[0]!.redMoves[0]!.pieceLabel).toBe('Soldat');
    expect(paired[0]!.redMoves[0]!.compactMove).toContain('C3');
    // Unrevealed enemy move in the same turn does not leak its secret identity to Red!
    expect(paired[0]!.blackMoves[0]!.pieceLabel).toBe('Pion');

    const screenHtml = renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        {
          preferences: DEFAULT_USER_PREFERENCES,
          children: React.createElement(GameBoardScreen, {
            mode: 'training_ai',
            aiDifficulty: 'easy',
            trainingSituationTitle: TRAINING_SITUATIONS[0]!.title,
            initialLocalState: state,
            settings: DEFAULT_USER_PREFERENCES,
            onMatchConcluded: () => {},
            onExitToMenu: () => {},
          }),
        },
      ),
    );

    expect(screenHtml).toContain('bw-left-move-history-panel');
    expect(screenHtml).toContain('bw-left-history-toggle');
    expect(screenHtml).toContain('bw-left-turn-row');
    expect(screenHtml).toContain('🔴 Joueur 1');
    expect(screenHtml).toContain('⚫ Joueur 2');
  });

  it('4. highlights Traqueur targets directly on the board with 🎯 VISER reticle and marks at 0 PA without changing active turn', () => {
    let state = TRAINING_SITUATIONS[0]!.createInitialState();
    const traq = state.pieces.find((p) => p.id === 'r-traq')!;
    const candidates = generateTraqueurMarkCandidates(traq, state.pieces, {
      fogTurnsRemainingByOwner: { red: 0, black: 0 },
      viewerGuetteurReconKeys: new Set(),
    });
    expect(candidates.map((c) => c.id)).toContain('b-target');

    const view = projectMatchStateForViewer(state, 'red');
    const boardWithTraqueurSelected = renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        {
          preferences: DEFAULT_USER_PREFERENCES,
          children: React.createElement(PhaserBoardCanvas, {
            phase: 'playing',
            viewerColor: 'red',
            isViewerTurn: true,
            pieces: view.pieces,
            selectedCoord: traq.position,
            highlightedMoves: [],
            highlightedCardSquares: [],
            highlightedTraqueurMarkCoords: [{ row: 3, col: 4 }],
            recentlyMarkedCoord: { row: 3, col: 4 },
            guetteurReconCoords: [],
            ownTraps: [],
            showCoordinates: true,
            showReconZones: true,
            onSquareClick: () => {},
          }),
        },
      ),
    );

    expect(boardWithTraqueurSelected).toContain('bw-cell-traqueur-mark-valid');
    expect(boardWithTraqueurSelected).toContain('bw-pixel-target-reticle');
    expect(boardWithTraqueurSelected).toContain('🎯 VISER');
    expect(boardWithTraqueurSelected).toContain('bw-pixel-lock-burst');

    // Marking directly costs 0 PA: activePlayer remains 'red' and remainingActions stays 1
    state = markTraqueurTarget(state, 'red', 'r-traq', 'b-target', 1500);
    expect(state.turn.activePlayer).toBe('red');
    expect(state.turn.remainingActions).toBe(1);
    const updatedTraq = state.pieces.find((p) => p.id === 'r-traq')!;
    expect(updatedTraq.traqueurMarkedTargetId).toBe('b-target');
  });

  it('5. executes anti-cheat AI turns across Easy, Medium and Hard difficulties and enforces neutral secrecy in Spectator mode', () => {
    for (const diff of AI_DIFFICULTIES) {
      expect(AI_DIFFICULTY_CATALOG[diff].label.length).toBeGreaterThan(5);
      const placement = chooseAiPlacement('black', diff);
      expect(placement).toHaveLength(27);
    }

    let aiMatch = createAiTrainingMatch('medium', true);
    expect(aiMatch.phase).toBe('playing');
    expect(aiMatch.turn.activePlayer).toBe('red');

    // Advance 1 human turn then 1 AI turn
    aiMatch = executeAiTurnStep(aiMatch, 'medium', 1000);
    expect(aiMatch.actionLog.length).toBeGreaterThanOrEqual(1);
    if (aiMatch.turn.activePlayer === 'black') {
      const beforeLen = aiMatch.actionLog.length;
      aiMatch = executeAiTurnStep(aiMatch, 'hard', 2000);
      expect(aiMatch.actionLog.length).toBeGreaterThan(beforeLen);
    }

    // Spectator projection strictly hides unrevealed identities of BOTH camps
    const specView = projectMatchStateForSpectator(aiMatch);
    expect(specView.ownHand).toHaveLength(0);
    expect(specView.ownTraps).toHaveLength(0);
    const unrevealedPieces = specView.pieces.filter((p) => p.character === null);
    expect(unrevealedPieces.length).toBeGreaterThan(20);
  });

  it('6. sanitizes independent masterVolume, soundVolume, boardScale, dynamicBoardScale and showMoveHistory in SettingsScreen', () => {
    const prefs = sanitizeUserPreferences({
      siteThemeId: 'purple_night',
      masterVolume: 90,
      soundVolume: 65,
      boardScale: 'large',
      dynamicBoardScale: true,
      showMoveHistory: true,
    });
    expect(prefs.siteThemeId).toBe('purple_night');
    expect(prefs.masterVolume).toBe(90);
    expect(prefs.soundVolume).toBe(65);
    expect(prefs.boardScale).toBe('large');
    expect(prefs.dynamicBoardScale).toBe(true);
    expect(prefs.showMoveHistory).toBe(true);

    const settingsHtml = renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        {
          preferences: prefs,
          children: React.createElement(SettingsScreen, {
            preferences: prefs,
            userProfile: null,
            onUpdatePreferences: () => {},
            onResetAll: () => {},
            onGoToProfile: () => {},
            onGoToAuth: () => {},
          }),
        },
      ),
    );
    expect(settingsHtml).toContain('Purple Night');
    expect(settingsHtml).toContain('Pixel Red');
    expect(settingsHtml).toContain('Classic Chess');
    expect(settingsHtml).toContain('Monochrome');
    expect(settingsHtml).toContain('Ocean');
    expect(settingsHtml).toContain('Taille de l’échiquier');
    expect(settingsHtml).toContain('Échiquier dynamique selon le tour');

    const css = fs.readFileSync(path.resolve(process.cwd(), 'client/src/styles.css'), 'utf8');
    expect(css).toContain('.bw-board-wrapper.bw-board-turn-yours');
    expect(css).toContain('.bw-board-wrapper.bw-board-turn-opponent');
    expect(css).toContain('.bw-left-move-history-panel');
    expect(css).toContain('.bw-pixel-target-reticle');
  });
});
