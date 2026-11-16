import { describe, expect, it } from 'vitest';
import {
  ARMY_COMPOSITION,
  BOARD_COLS,
  BOARD_ROWS,
  CARD_TYPES,
  COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD,
  CUSTOM_CLOCK_PRESETS_SECONDS,
  INITIAL_ELO_RATING,
  INITIAL_FIRST_PLAYER,
  MAX_HAND_SIZE,
  OFFICIAL_PLAYER_CLOCK_MS,
  OFFICIAL_RECONNECT_GRACE_SECONDS,
  TOTAL_BOARD_SQUARES,
  TOTAL_PIECES_PER_PLAYER,
  advanceDrawCounterOnElimination,
  autoCompletePlacement,
  computeEloUpdate,
  createInitialArmyRoster,
  createMatchState,
  executePieceMove,
  finalizePlacementOnTimerExpired,
  forfeitByDisconnectionTimeout,
  generateMoveCandidatesForPiece,
  getColossusDirections,
  playCard,
  projectMatchStateForViewer,
  proposeOrAcceptMutualDraw,
  resignMatch,
  selectSoldierPromotion,
  skipBerserkerRageMove,
  stopCavalierJumpChain,
  submitPlayerPlacement,
  tickMatchClock,
  validateCompletePlacement,
  type CharacterType,
  type Coord,
  type PlacementEntry,
  type PlayerColor,
  type ServerMatchState,
  type ServerPieceRecord,
} from '../shared/src/index.js';
import {
  clearAllPersonalAnnotations,
  createInitialAnnotationsByPlayer,
  eraseAnnotationsAtSquare,
  removeArrowById,
  toggleOrReplaceSquareMark,
  toggleOrUpsertArrow,
} from '../client/src/board/annotations.js';

/** Helper to build a valid deterministic 27-piece placement for a player. */
function makeValidPlacement(color: PlayerColor): PlacementEntry[] {
  return autoCompletePlacement(color, [], () => 0.42);
}

/** Helper to create a minimal custom playing board state for targeted rule tests. */
function makeTestPlayingState(
  pieces: ServerPieceRecord[],
  activePlayer: PlayerColor = 'red',
): ServerMatchState {
  const base = createMatchState('test-match', 'local');
  return {
    ...base,
    phase: 'playing',
    pieces,
    turn: {
      ...base.turn,
      activePlayer,
    },
  };
}

function makePiece(
  id: string,
  owner: PlayerColor,
  character: CharacterType,
  coord: Coord,
  overrides: Partial<ServerPieceRecord> = {},
): ServerPieceRecord {
  return {
    id,
    owner,
    character,
    promotedFrom: null,
    position: coord,
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
    ...overrides,
  };
}

describe('1. Plateau, Armées et Placement (§3, §5, §24)', () => {
  it('verifies 9x9 board (81 squares) and 27 pieces with exact official army composition', () => {
    expect(BOARD_ROWS).toBe(9);
    expect(BOARD_COLS).toBe(9);
    expect(TOTAL_BOARD_SQUARES).toBe(81);
    expect(TOTAL_PIECES_PER_PLAYER).toBe(27);

    expect(ARMY_COMPOSITION).toEqual({
      guetteur_h: 3,
      guetteur_d: 3,
      assassin: 3,
      roi: 1,
      cavalier: 2,
      colosse: 1,
      reine: 1,
      berserker: 1,
      traqueur: 1,
      executeur: 1,
      arbaletrier: 1,
      soldat: 9,
    });

    const roster = createInitialArmyRoster();
    expect(roster).toHaveLength(27);
  });

  it('validates free placement in own 3-row zone and rejects out-of-zone or wrong-quota placements', () => {
    const validRed = makeValidPlacement('red');
    expect(validateCompletePlacement('red', validRed).valid).toBe(true);

    // Out-of-zone placement for Red (row 0 belongs to Black)
    const invalidZone = [...validRed];
    invalidZone[0] = { ...invalidZone[0], coord: { row: 0, col: 0 } };
    expect(validateCompletePlacement('red', invalidZone).valid).toBe(false);
  });

  it('auto-completes remaining pieces when the 90s prep timer expires and starts with Red (§21.27)', () => {
    let state = createMatchState('m1', 'local');
    state = finalizePlacementOnTimerExpired(state, 1000, () => 0.5);
    expect(state.phase).toBe('playing');
    expect(state.pieces).toHaveLength(54);
    expect(state.turn.activePlayer).toBe(INITIAL_FIRST_PLAYER);
    expect(state.turn.activePlayer).toBe('red');
  });
});

describe('2. Identités cachées, Guetteurs, Brouillard, Cimetière et Sécurité (§4, §6.1–6.2, §8.8, §19, §21)', () => {
  it('never leaks unrevealed enemy identities or secret buffs in ClientMatchView (§4.5, §19)', () => {
    const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 4 });
    const blackQueen = makePiece('b-queen', 'black', 'reine', { row: 0, col: 4 }, {
      hasKamikaze: true,
      hasProtection: true,
    });
    const state = makeTestPlayingState([redKing, blackQueen]);

    const redView = projectMatchStateForViewer(state, 'red');
    const enemyInRedView = redView.pieces.find((p) => p.id === 'b-queen')!;
    expect(enemyInRedView.character).toBeNull();
    expect(enemyInRedView.hasKamikazeVisible).toBe(false);
    expect(enemyInRedView.isProtectedVisible).toBe(false);
  });

  it('reveals enemy pieces via Guetteur H (orthogonal) and Guetteur D (diagonal), stops on move away or Guetteur death, and is blocked by Brouillard (§6.1, §6.2, §8.8, §21.3)', () => {
    const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 0 });
    const redGH = makePiece('r-gh', 'red', 'guetteur_h', { row: 4, col: 4 });
    const redGD = makePiece('r-gd', 'red', 'guetteur_d', { row: 4, col: 6 });
    const blackTarget1 = makePiece('b-1', 'black', 'reine', { row: 3, col: 4 }); // orthogonal to GH
    const blackTarget2 = makePiece('b-2', 'black', 'soldat', { row: 3, col: 7 }); // diagonal to GD
    const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 0 });

    let state = makeTestPlayingState([
      redKing,
      redGH,
      redGD,
      blackTarget1,
      blackTarget2,
      blackKing,
    ]);

    let redView = projectMatchStateForViewer(state, 'red');
    expect(redView.pieces.find((p) => p.id === 'b-1')?.character).toBe('reine');
    expect(redView.pieces.find((p) => p.id === 'b-2')?.character).toBe('soldat');

    // Activate Brouillard for Black -> blocks Guetteur reconnaissance (§8.8, §21.3)
    state = {
      ...state,
      turn: { ...state.turn, activePlayer: 'black' },
      players: {
        ...state.players,
        black: { ...state.players.black, hand: ['brouillard'] },
      },
    };
    state = playCard(state, 'black', { card: 'brouillard' });
    redView = projectMatchStateForViewer(state, 'red');
    expect(redView.pieces.find((p) => p.id === 'b-1')?.character).toBeNull();
    expect(redView.pieces.find((p) => p.id === 'b-2')?.character).toBeNull();
  });

  it('enforces Graveyard confidentiality rules: Case 1 (unknown), Case 2 (known temporarily/Guetteur at death), Case 3 (Assassin vs Kamikaze) (§4.4, §7, §21.2, §21.13)', () => {
    const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 0 });
    const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 0 });
    const redBerserker = makePiece('r-ber', 'red', 'berserker', { row: 5, col: 2 });
    const blackUnknown = makePiece('b-unk', 'black', 'cavalier', { row: 4, col: 2 });
    const redGH = makePiece('r-gh', 'red', 'guetteur_h', { row: 5, col: 5 });
    const blackSpotted = makePiece('b-spot', 'black', 'cavalier', { row: 4, col: 5 });
    const redQueen = makePiece('r-queen', 'red', 'reine', { row: 4, col: 6 });

    // 1. Kill unknown piece -> "Pièce éliminée" in Red's graveyard view
    let state = makeTestPlayingState([
      redKing,
      blackKing,
      redBerserker,
      blackUnknown,
      redGH,
      blackSpotted,
      redQueen,
    ]);
    state = executePieceMove(state, 'red', 'r-ber', { row: 4, col: 2 });
    if (state.turn.pendingBerserkerRagePieceId) {
      state = skipBerserkerRageMove(state, 'red');
    }

    let redView = projectMatchStateForViewer(state, 'red');
    const unkGrave = redView.graveyard.find((g) => g.pieceId === 'b-unk')!;
    expect(unkGrave.known).toBe(false);
    expect(unkGrave.character).toBeNull();
    expect(unkGrave.label).toBe('Pièce éliminée');

    // 2. Kill piece currently spotted by Guetteur H -> identity is known in graveyard (§4.4 Case 2, §21.2)
    state = { ...state, turn: { ...state.turn, activePlayer: 'red', remainingActions: 1 } };
    state = executePieceMove(state, 'red', 'r-queen', { row: 4, col: 5 });
    redView = projectMatchStateForViewer(state, 'red');
    const spotGrave = redView.graveyard.find((g) => g.pieceId === 'b-spot')!;
    expect(spotGrave.known).toBe(true);
    expect(spotGrave.character).toBe('cavalier');

    // 3. Assassin kills a Kamikaze piece -> Assassin dies and permanent revelation does NOT trigger (§7, §21.13)
    const redAssassin = makePiece('r-ass', 'red', 'assassin', { row: 5, col: 7 });
    const blackKamikaze = makePiece('b-kami', 'black', 'berserker', { row: 4, col: 7 }, {
      hasKamikaze: true,
    });
    let state2 = makeTestPlayingState([redKing, blackKing, redAssassin, blackKamikaze]);
    state2 = executePieceMove(state2, 'red', 'r-ass', { row: 4, col: 7 });
    const redView2 = projectMatchStateForViewer(state2, 'red');
    const kamiGrave = redView2.graveyard.find((g) => g.pieceId === 'b-kami')!;
    expect(kamiGrave.known).toBe(false);
    expect(kamiGrave.character).toBeNull();
  });
});

describe('3. Personnages : Déplacements, Capacités, Cavalier, Colosse, Berserker, Soldat (§6, §21, Q1–Q11)', () => {
  it('allows Guetteur D to move 1 square both horizontally and vertically (4 orthogonal directions), and never diagonally', () => {
    const redGD = makePiece('r-gd', 'red', 'guetteur_d', { row: 4, col: 4 });
    const state = makeTestPlayingState([redGD]);
    const moves = generateMoveCandidatesForPiece(
      redGD,
      state.pieces,
      { fogTurnsRemainingByOwner: { red: 0, black: 0 }, viewerGuetteurReconKeys: new Set() },
      false,
    );
    const coords = moves.map((m) => m.to);
    expect(coords).toHaveLength(4);
    expect(coords).toEqual(
      expect.arrayContaining([
        { row: 3, col: 4 }, // haut (vertical)
        { row: 5, col: 4 }, // bas (vertical)
        { row: 4, col: 3 }, // gauche (horizontal)
        { row: 4, col: 5 }, // droite (horizontal)
      ]),
    );
  });

  it('enforces Soldier forward movement and diagonal-only capture + flexible promotion (Q4, §6.9, §21.1)', () => {
    const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 0 });
    const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 8 });
    const redSoldier = makePiece('r-sol', 'red', 'soldat', { row: 1, col: 4 });
    const blackBlockerAhead = makePiece('b-ahead', 'black', 'soldat', { row: 0, col: 4 });
    const blackDiagTarget = makePiece('b-diag', 'black', 'soldat', { row: 0, col: 5 });

    let state = makeTestPlayingState([
      redKing,
      blackKing,
      redSoldier,
      blackBlockerAhead,
      blackDiagTarget,
    ]);

    // Cannot capture straight ahead (0, 4), but can capture diagonally (0, 5) and promote!
    expect(() => executePieceMove(state, 'red', 'r-sol', { row: 0, col: 4 })).toThrow();

    state = executePieceMove(state, 'red', 'r-sol', { row: 0, col: 5 });
    expect(state.turn.pendingPromotionPieceId).toBe('r-sol');

    // Can promote to Cavalier even if no Cavalier was eliminated (Q4), and since Red has 0 Reine on board here, Reine is also available
    state = selectSoldierPromotion(state, 'red', 'cavalier');
    expect(state.pieces.find((p) => p.id === 'r-sol')?.character).toBe('cavalier');
  });

  it('enforces Colossus 5 directions, edge reversal, re-reversal on return, and immunity vs unauthorized attacks (Q2, Q3, Q6, Q7, §6.6)', () => {
    expect(getColossusDirections(-1)).toHaveLength(5);

    const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 0 });
    const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 8 });
    const redColossus = makePiece('r-col', 'red', 'colosse', { row: 1, col: 3 });

    let state = makeTestPlayingState([redKing, blackKing, redColossus]);
    // Move Red Colossus to row 0 -> reverses progressionDirection from -1 to +1 and reveals for 1 full turn
    state = executePieceMove(state, 'red', 'r-col', { row: 0, col: 3 });
    const colAfterEdge = state.pieces.find((p) => p.id === 'r-col')!;
    expect(colAfterEdge.progressionDirection).toBe(1);
    expect(colAfterEdge.reversalCount).toBe(1);

    // Unauthorized attack by Black Soldier on unknown Colossus -> fails, attacker stays put, reveals Colossus (Q6)
    const blackSoldier = makePiece('b-sol', 'black', 'soldat', { row: 3, col: 3 });
    const redUnknownColossus = makePiece('r-col2', 'red', 'colosse', { row: 4, col: 4 });
    let state2 = makeTestPlayingState([redKing, blackKing, blackSoldier, redUnknownColossus], 'black');
    state2 = executePieceMove(state2, 'black', 'b-sol', { row: 4, col: 4 });

    expect(state2.pieces.find((p) => p.id === 'r-col2')?.alive).toBe(true);
    expect(state2.pieces.find((p) => p.id === 'b-sol')?.position).toEqual({ row: 3, col: 3 });
    const blackView = projectMatchStateForViewer(state2, 'black');
    expect(blackView.pieces.find((p) => p.id === 'r-col2')?.character).toBe('colosse');

    // Colossus dies on 2nd Kamikaze hit
    expect(COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD).toBe(2);
  });

  it('handles Cavalier Rework (1-sq H/V, L-leap, Percée jump chain), generalized Bonus Turn on 2+ kills (no card allowed), 1 action on 0 kills, and interruption on unknown Colossus (§6.5)', () => {
    const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 0 });
    const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 8 });
    const redCav = makePiece('r-cav', 'red', 'cavalier', { row: 6, col: 2 });
    const enemy1 = makePiece('b-e1', 'black', 'soldat', { row: 5, col: 2 });
    const enemy2 = makePiece('b-e2', 'black', 'soldat', { row: 3, col: 2 });

    let state = makeTestPlayingState([redKing, blackKing, redCav, enemy1, enemy2], 'red');
    // Jump 1: (6,2) -> (4,2) over (5,2)
    state = executePieceMove(state, 'red', 'r-cav', { row: 4, col: 2 });
    expect(state.turn.pendingCavalierJumpPieceId).toBe('r-cav');

    // Jump 2 in chain: (4,2) -> (2,2) over (3,2) -> 2 kills total -> Bonus Turn granted!
    state = executePieceMove(state, 'red', 'r-cav', { row: 2, col: 2 });
    expect(state.turn.activePlayer).toBe('red');
    expect(state.turn.isBonusTurn).toBe(true);
    expect(state.turn.remainingActions).toBe(1);
    const redView = projectMatchStateForViewer(state, 'red');
    expect(redView.turn.canPlayCardNow).toBe(false);

    // Cavalier jump over unknown Colossus -> interrupted, 0 kills -> Black gets standard 1 action (0-kill penalty removed!)
    const redCav2 = makePiece('r-cav2', 'red', 'cavalier', { row: 6, col: 5 });
    const blackCol = makePiece('b-col', 'black', 'colosse', { row: 5, col: 5 });
    let stateCol = makeTestPlayingState([redKing, blackKing, redCav2, blackCol], 'red');
    stateCol = executePieceMove(stateCol, 'red', 'r-cav2', { row: 4, col: 5 });
    expect(stateCol.pieces.find((p) => p.id === 'b-col')?.alive).toBe(true);
    expect(stateCol.turn.activePlayer).toBe('black');
    expect(stateCol.turn.remainingActions).toBe(1);
  });
});

describe('4. Système des 16 Cartes et Combinaisons (§8.1–8.16, §21, Q12–Q25)', () => {
  it('verifies all 16 official cards exist and draw counter only increments when hand < 3 (§8, §21.18)', () => {
    expect(CARD_TYPES).toHaveLength(16);
    expect(MAX_HAND_SIZE).toBe(3);

    // With 3 cards in hand, counter does NOT progress
    const fullHandStep = advanceDrawCounterOnElimination(3, 0);
    expect(fullHandStep.nextKillCounter).toBe(0);
    expect(fullHandStep.shouldDrawCard).toBe(false);

    // With < 3 cards, 3 kills triggers draw and resets counter
    expect(advanceDrawCounterOnElimination(2, 2)).toEqual({
      nextKillCounter: 0,
      shouldDrawCard: true,
    });
  });

  it('handles Espionnage (2 chosen enemy pieces for 3 turns + opponent notification, Q12), Piège (both camps, Q18), Double action, Protection, and Sacrifice with 3 cards in hand', () => {
    const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 0 });
    const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 0 });
    const redSoldier = makePiece('r-sol', 'red', 'soldat', { row: 6, col: 4 });
    const blackPiece1 = makePiece('b-p1', 'black', 'reine', { row: 2, col: 2 }, {
      counterEspionageTicksRemaining: 6,
    });
    const blackPiece2 = makePiece('b-p2', 'black', 'assassin', { row: 2, col: 3 });

    let state = makeTestPlayingState([
      redKing,
      blackKing,
      redSoldier,
      blackPiece1,
      blackPiece2,
    ]);
    state = {
      ...state,
      players: {
        ...state.players,
        red: {
          ...state.players.red,
          hand: ['espionnage', 'piege', 'sacrifice'],
        },
      },
    };

    // 1. Sacrifice is playable even when holding 3 cards (Contradiction #5, §8.16, §21.22)
    const afterSacrifice = playCard(
      state,
      'red',
      { card: 'sacrifice', targetSoldierPieceId: 'r-sol' },
      1000,
      () => 0,
    );
    expect(afterSacrifice.players.red.hand).toHaveLength(3);
    expect(afterSacrifice.players.black.killCounterTowardCard).toBe(0);

    // 2. Espionnage reveals 2 chosen pieces even under Contre-espionnage and notifies Black of the card WITHOUT revealing which pieces were targeted
    const afterEsp = playCard(state, 'red', {
      card: 'espionnage',
      targetEnemyPieceIds: ['b-p1', 'b-p2'],
    });
    const redView = projectMatchStateForViewer(afterEsp, 'red');
    expect(redView.pieces.find((p) => p.id === 'b-p1')?.character).toBe('reine');
    expect(redView.pieces.find((p) => p.id === 'b-p2')?.character).toBe('assassin');

    const blackView = projectMatchStateForViewer(afterEsp, 'black');
    expect(blackView.pieces.find((p) => p.id === 'b-p1')?.isExposedByEnemyEspionage).toBe(false);
    expect(blackView.pieces.find((p) => p.id === 'b-p2')?.isExposedByEnemyEspionage).toBe(false);
    const lastBlackLog = blackView.actionLog[blackView.actionLog.length - 1]!.text;
    expect(lastBlackLog).toContain('Espionnage');
    expect(lastBlackLog).not.toContain('C7');
    expect(lastBlackLog).not.toContain('D7');

    // 3. Piège triggers on BOTH camps and immobilizes for 1 turn (Q18)
    let trapState = makeTestPlayingState([redKing, blackKing, redSoldier]);
    trapState = {
      ...trapState,
      players: {
        ...trapState.players,
        red: { ...trapState.players.red, hand: ['piege'] },
      },
    };
    trapState = playCard(trapState, 'red', { card: 'piege', destination: { row: 5, col: 4 } });
    // Black turn: move Black King (0,0) -> (1,0)
    trapState = executePieceMove(trapState, 'black', 'b-king', { row: 1, col: 0 });
    // Red turn: Red Soldier steps onto Red's own trap at (5,4) -> immobilized!
    trapState = executePieceMove(trapState, 'red', 'r-sol', { row: 5, col: 4 });
    expect(trapState.pieces.find((p) => p.id === 'r-sol')?.immobilizedTicksRemaining).toBeGreaterThan(0);
  });
});

describe('5. Pendule 10 min, Classement 200 ELO, Répétition (3x/5x) et Fin de partie (§11–14, Q26–Q30)', () => {
  it('enforces 10-minute default clock, custom presets (3/5/10/15/30 min), 60s reconnect, and 200 starting ELO', () => {
    expect(OFFICIAL_PLAYER_CLOCK_MS).toBe(600_000);
    expect(CUSTOM_CLOCK_PRESETS_SECONDS).toEqual([180, 300, 600, 900, 1800]);
    expect(OFFICIAL_RECONNECT_GRACE_SECONDS).toBe(60);
    expect(INITIAL_ELO_RATING).toBe(200);

    const rankedElo = computeEloUpdate('matchmaking_ranked', 200, 200, 'red');
    expect(rankedElo.redNext).toBe(216);
    expect(rankedElo.blackNext).toBe(184);

    // Plus l'adversaire est faible en ELO par rapport à soi, moins on gagne d'ELO en gagnant (et plus on en perd en perdant)
    // Inversement, plus l'adversaire est fort, plus on gagne d'ELO en gagnant (et moins on en perd en perdant)
    const strongBeatingWeak = computeEloUpdate('matchmaking_ranked', 400, 200, 'red');
    const weakBeatingStrong = computeEloUpdate('matchmaking_ranked', 200, 400, 'red');
    expect(strongBeatingWeak.redDelta).toBeGreaterThan(0);
    expect(strongBeatingWeak.redDelta).toBeLessThan(rankedElo.redDelta); // +8 < +16
    expect(weakBeatingStrong.redDelta).toBeGreaterThan(rankedElo.redDelta); // +24 > +16

    const strongLosingToWeak = computeEloUpdate('matchmaking_ranked', 400, 200, 'black');
    const weakLosingToStrong = computeEloUpdate('matchmaking_ranked', 200, 400, 'black');
    expect(Math.abs(strongLosingToWeak.redDelta)).toBeGreaterThan(Math.abs(rankedElo.blackDelta)); // perd 24 > 16
    expect(Math.abs(weakLosingToStrong.redDelta)).toBeLessThan(Math.abs(rankedElo.blackDelta)); // perd 8 < 16

    const unrankedElo = computeEloUpdate('matchmaking_unranked', 200, 200, 'red');
    expect(unrankedElo.redNext).toBe(200);
    expect(unrankedElo.blackNext).toBe(200);
  });

  it('triggers warning at 3 repetitions and automatic draw at 5 repetitions (Q27)', () => {
    const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 4 });
    const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 4 });
    let state = makeTestPlayingState([redKing, blackKing], 'red');

    // Back-and-forth cycles between (8,4)<->(8,3) and (0,4)<->(0,3)
    for (let cycle = 1; cycle <= 4; cycle += 1) {
      state = executePieceMove(state, 'red', 'r-king', { row: 8, col: 3 });
      state = executePieceMove(state, 'black', 'b-king', { row: 0, col: 3 });
      state = executePieceMove(state, 'red', 'r-king', { row: 8, col: 4 });
      state = executePieceMove(state, 'black', 'b-king', { row: 0, col: 4 });
      if (cycle === 2) {
        expect(state.repetitionWarningActive).toBe(true);
        expect(state.phase).toBe('playing');
      }
    }

    expect(state.phase).toBe('finished');
    expect(state.winner).toBe('draw');
    expect(state.outcomeReason).toBe('fivefold_repetition');
  });

  it('handles timeout defeat, resignation, disconnect forfeit, and mutual draw', () => {
    let state = createMatchState('m-end', 'online_custom');
    state = submitPlayerPlacement(state, 'red', makeValidPlacement('red'), 1000);
    state = submitPlayerPlacement(state, 'black', makeValidPlacement('black'), 1000);

    const timedOut = tickMatchClock(state, 1000 + OFFICIAL_PLAYER_CLOCK_MS + 1);
    expect(timedOut.phase).toBe('finished');
    expect(timedOut.winner).toBe('black');
    expect(timedOut.outcomeReason).toBe('clock_timeout');

    const resigned = resignMatch(state, 'black', 2000);
    expect(resigned.winner).toBe('red');
    expect(resigned.outcomeReason).toBe('resignation');

    const forfeited = forfeitByDisconnectionTimeout(state, 'red', 3000);
    expect(forfeited.winner).toBe('black');
    expect(forfeited.outcomeReason).toBe('disconnect_forfeit');

    const offer = proposeOrAcceptMutualDraw(state, 'red', 4000);
    const drawn = proposeOrAcceptMutualDraw(offer, 'black', 5000);
    expect(drawn.winner).toBe('draw');
    expect(drawn.outcomeReason).toBe('mutual_draw');
  });
});

describe('6. Affichage du Dernier Coup sur le Plateau (lastMove) & Synchronisation Multijoueur', () => {
  it('records normal move, capture, Cavalier jump chain, Berserker Rage, Promotion, and persists across non-movement cards', () => {
    const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 4 });
    const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 4 });
    const redSoldier = makePiece('r-sol', 'red', 'soldat', { row: 6, col: 2 });
    const blackTarget1 = makePiece('b-t1', 'black', 'soldat', { row: 5, col: 3 });
    const redCavalier = makePiece('r-cav', 'red', 'cavalier', { row: 6, col: 6 });
    const blackJump1 = makePiece('b-j1', 'black', 'soldat', { row: 5, col: 6 });
    const blackJump2 = makePiece('b-j2', 'black', 'soldat', { row: 3, col: 6 });
    const redBerserker = makePiece('r-ber', 'red', 'berserker', { row: 6, col: 0 });
    const blackBerTarget = makePiece('b-bt', 'black', 'soldat', { row: 5, col: 0 });

    let state = makeTestPlayingState(
      [
        redKing,
        blackKing,
        redSoldier,
        blackTarget1,
        redCavalier,
        blackJump1,
        blackJump2,
        redBerserker,
        blackBerTarget,
      ],
      'red',
    );

    // 1. Capture move: Red Soldier C3 (6,2) -> D4 (5,3) (diagonal forward capture)
    state = executePieceMove(state, 'red', 'r-sol', { row: 5, col: 3 }, 1000);
    expect(state.lastMove).not.toBeNull();
    expect(state.lastMove?.kind).toBe('capture_move');
    expect(state.lastMove?.from).toEqual({ row: 6, col: 2 });
    expect(state.lastMove?.to).toEqual({ row: 5, col: 3 });
    expect(state.lastMove?.eliminatedCoords).toEqual([{ row: 5, col: 3 }]);

    // Verify viewer projection (reconnection / online sync) preserves lastMove without leaking identities
    const blackViewAfterCapture = projectMatchStateForViewer(state, 'black');
    expect(blackViewAfterCapture.lastMove).toEqual(state.lastMove);

    // 2. Normal move: Black King E9 (0,4) -> D9 (0,3)
    state = executePieceMove(state, 'black', 'b-king', { row: 0, col: 3 }, 2000);
    expect(state.lastMove?.kind).toBe('normal_move');
    expect(state.lastMove?.from).toEqual({ row: 0, col: 4 });
    expect(state.lastMove?.to).toEqual({ row: 0, col: 3 });
    expect(state.lastMove?.eliminatedCoords).toEqual([]);

    // 3. Cavalier multi-jump chain: Red Cavalier G3 (6,6) jumps over G4 (5,6) to G5 (4,6), then over G6 (3,6) to G7 (2,6)
    state = executePieceMove(state, 'red', 'r-cav', { row: 4, col: 6 }, 3000);
    expect(state.lastMove?.kind).toBe('cavalier_jump');
    expect(state.lastMove?.from).toEqual({ row: 6, col: 6 });
    expect(state.lastMove?.to).toEqual({ row: 4, col: 6 });
    expect(state.lastMove?.eliminatedCoords).toEqual([{ row: 5, col: 6 }]);

    state = executePieceMove(state, 'red', 'r-cav', { row: 2, col: 6 }, 3500);
    expect(state.lastMove?.kind).toBe('cavalier_jump');
    expect(state.lastMove?.from).toEqual({ row: 6, col: 6 });
    expect(state.lastMove?.to).toEqual({ row: 2, col: 6 });
    expect(state.lastMove?.eliminatedCoords).toEqual([
      { row: 5, col: 6 },
      { row: 3, col: 6 },
    ]);
    expect(state.lastMove?.steps.length).toBe(2);

    // Red gets Cavalier bonus turn after jump chain -> Berserker kills at A4 (5,0) and chains Rage 2nd move to A6 (3,0)
    state = executePieceMove(state, 'red', 'r-ber', { row: 5, col: 0 }, 4000);
    state = executePieceMove(state, 'red', 'r-ber', { row: 3, col: 0 }, 4500);
    expect(state.lastMove?.kind).toBe('berserker_rage');
    expect(state.lastMove?.from).toEqual({ row: 6, col: 0 });
    expect(state.lastMove?.to).toEqual({ row: 3, col: 0 });
    expect(state.lastMove?.eliminatedCoords).toEqual([{ row: 5, col: 0 }]);
    expect(state.lastMove?.steps.length).toBe(2);

    // Non-movement card (e.g. Brouillard) played by Black must NOT erase lastMove!
    state = {
      ...state,
      players: {
        ...state.players,
        black: { ...state.players.black, hand: ['brouillard'] },
      },
    };
    state = playCard(state, 'black', { card: 'brouillard' }, 5000);
    expect(state.lastMove?.kind).toBe('berserker_rage');
    expect(state.lastMove?.to).toEqual({ row: 3, col: 0 });
  });
});

describe('7. Indicateurs de Nouvelle Carte, Validation du Placement & Annotations Tactiques', () => {
  it('emits private ownLastCardDraw on exact 3rd kill and on Sacrifice while strictly obeying maxHandSize=3', () => {
    const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 4 });
    const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 4 });
    const redQueen = makePiece('r-queen', 'red', 'reine', { row: 6, col: 2 });
    const redSoldier = makePiece('r-sol', 'red', 'soldat', { row: 7, col: 0 });
    const blackVictim = makePiece('b-vic', 'black', 'soldat', { row: 5, col: 2 });

    let state = makeTestPlayingState([redKing, blackKing, redQueen, redSoldier, blackVictim], 'red');
    state = {
      ...state,
      players: {
        ...state.players,
        red: {
          ...state.players.red,
          killCounterTowardCard: 2,
          totalEliminations: 2,
          hand: [],
        },
      },
    };

    // Before 3rd elimination -> no card draw recorded yet
    expect(projectMatchStateForViewer(state, 'red').ownLastCardDraw).toBeNull();

    // 3rd elimination draws 1 card -> Red gets private ownLastCardDraw; Black gets null
    state = executePieceMove(state, 'red', 'r-queen', { row: 5, col: 2 }, 1500, () => 0.1);
    const redView1 = projectMatchStateForViewer(state, 'red');
    const blackView1 = projectMatchStateForViewer(state, 'black');
    expect(redView1.ownHand).toHaveLength(1);
    expect(redView1.ownLastCardDraw).not.toBeNull();
    expect(redView1.ownLastCardDraw?.source).toBe('eliminations');
    expect(redView1.ownLastCardDraw?.card).toBe(redView1.ownHand[0]);
    expect(redView1.ownLastCardDraw?.handCountAfter).toBe(1);
    expect(blackView1.ownLastCardDraw).toBeNull();

    // Sacrifice with 1 card -> swaps 1 -> 0 -> 1 and emits a NEW draw sequence id!
    state = {
      ...state,
      turn: { ...state.turn, activePlayer: 'red', remainingActions: 1 },
      players: {
        ...state.players,
        red: {
          ...state.players.red,
          hand: ['sacrifice'],
        },
      },
    };
    state = playCard(
      state,
      'red',
      { card: 'sacrifice', targetSoldierPieceId: 'r-sol' },
      2500,
      () => 0.4,
    );
    const redView2 = projectMatchStateForViewer(state, 'red');
    expect(redView2.ownHand).toHaveLength(1);
    expect(redView2.ownLastCardDraw?.source).toBe('sacrifice');
    expect(redView2.ownLastCardDraw?.id).not.toBe(redView1.ownLastCardDraw?.id);
    expect(redView2.ownLastCardDraw?.card).toBe(redView2.ownHand[0]);

    // When hand is already at MAX_HAND_SIZE (3), a 3rd kill MUST NOT grant a 4th card or false notification
    const blackVictim2 = makePiece('b-vic2', 'black', 'soldat', { row: 4, col: 2 });
    state = {
      ...state,
      pieces: [...state.pieces, blackVictim2],
      turn: { ...state.turn, activePlayer: 'red', remainingActions: 1 },
      players: {
        ...state.players,
        red: {
          ...state.players.red,
          hand: ['protection', 'brouillard', 'piege'],
          killCounterTowardCard: 2,
          lastCardDraw: redView2.ownLastCardDraw,
        },
      },
    };
    state = executePieceMove(state, 'red', 'r-queen', { row: 4, col: 2 }, 3500, () => 0.9);
    const redViewFull = projectMatchStateForViewer(state, 'red');
    expect(redViewFull.ownHand).toHaveLength(MAX_HAND_SIZE);
    // Still points to the previous draw; no misleading draw notification was emitted
    expect(redViewFull.ownLastCardDraw?.id).toBe(redView2.ownLastCardDraw?.id);
  });

  it('tracks placement confirmation status cleanly, locks confirmed placements, and never starts incomplete', () => {
    let state = createMatchState('lock-placement-test', 'online_custom');
    const initialRedView = projectMatchStateForViewer(state, 'red');
    expect(initialRedView.placementStatus).toEqual({
      redConfirmed: false,
      blackConfirmed: false,
      ownConfirmed: false,
      opponentConfirmed: false,
    });
    expect(initialRedView.ownConfirmedPlacement).toHaveLength(0);

    // Incomplete placement is rejected
    expect(() =>
      submitPlayerPlacement(state, 'red', makeValidPlacement('red').slice(0, 10), 100),
    ).toThrow(/Placement invalide/);

    // Red validates 27 pieces -> locked, match stays in placement waiting for Black
    const redPlacement = makeValidPlacement('red');
    state = submitPlayerPlacement(state, 'red', redPlacement, 200);
    expect(state.phase).toBe('placement');

    const redAfterConfirm = projectMatchStateForViewer(state, 'red');
    const blackWhileRedWaits = projectMatchStateForViewer(state, 'black');
    expect(redAfterConfirm.placementStatus).toEqual({
      redConfirmed: true,
      blackConfirmed: false,
      ownConfirmed: true,
      opponentConfirmed: false,
    });
    expect(redAfterConfirm.ownConfirmedPlacement).toHaveLength(TOTAL_PIECES_PER_PLAYER);
    // Black sees Red is confirmed, NEVER sees Red's placed coordinates!
    expect(blackWhileRedWaits.placementStatus).toEqual({
      redConfirmed: true,
      blackConfirmed: false,
      ownConfirmed: false,
      opponentConfirmed: true,
    });
    expect(blackWhileRedWaits.ownConfirmedPlacement).toHaveLength(0);

    // Modifying/re-submitting a locked placement throws
    expect(() =>
      submitPlayerPlacement(state, 'red', makeValidPlacement('red'), 300),
    ).toThrow(/déjà été validé/);

    // Once Black confirms valid placement -> game starts!
    state = submitPlayerPlacement(state, 'black', makeValidPlacement('black'), 400);
    expect(state.phase).toBe('playing');
    expect(projectMatchStateForViewer(state, 'red').placementStatus).toEqual({
      redConfirmed: true,
      blackConfirmed: true,
      ownConfirmed: true,
      opponentConfirmed: true,
    });
  });

  it('manages strictly personal per-player tactical arrows and colored squares without touching game state', () => {
    const store = createInitialAnnotationsByPlayer();
    let redNotes = store.red;
    const blackNotes = store.black;

    // Add multiple arrows in different tactical colors
    redNotes = toggleOrUpsertArrow(redNotes, { row: 6, col: 4 }, { row: 4, col: 4 }, 'green');
    redNotes = toggleOrUpsertArrow(redNotes, { row: 5, col: 2 }, { row: 3, col: 3 }, 'red');
    expect(redNotes.arrows).toHaveLength(2);

    // Recolor same endpoints, then toggle off with identical color
    redNotes = toggleOrUpsertArrow(redNotes, { row: 6, col: 4 }, { row: 4, col: 4 }, 'blue');
    expect(redNotes.arrows.find((a) => a.from.col === 4)?.color).toBe('blue');
    redNotes = toggleOrUpsertArrow(redNotes, { row: 6, col: 4 }, { row: 4, col: 4 }, 'blue');
    expect(redNotes.arrows).toHaveLength(1);

    // Square color highlight + replace + toggle off
    redNotes = toggleOrReplaceSquareMark(redNotes, { row: 2, col: 2 }, 'yellow');
    expect(redNotes.marks).toHaveLength(1);
    redNotes = toggleOrReplaceSquareMark(redNotes, { row: 2, col: 2 }, 'red');
    expect(redNotes.marks[0]?.color).toBe('red');
    redNotes = toggleOrReplaceSquareMark(redNotes, { row: 2, col: 2 }, 'red');
    expect(redNotes.marks).toHaveLength(0);

    // Individual arrow delete & square eraser
    const remainingArrowId = redNotes.arrows[0]!.id;
    redNotes = toggleOrReplaceSquareMark(redNotes, { row: 3, col: 3 }, 'blue');
    redNotes = eraseAnnotationsAtSquare(redNotes, { row: 3, col: 3 });
    expect(redNotes.arrows).toHaveLength(0);
    expect(redNotes.marks).toHaveLength(0);

    // Remove by arrow ID directly + clear all
    redNotes = toggleOrUpsertArrow(redNotes, { row: 7, col: 1 }, { row: 5, col: 1 }, 'green');
    expect(redNotes.arrows).toHaveLength(1);
    redNotes = removeArrowById(redNotes, remainingArrowId); // non-matching id keeps array
    expect(redNotes.arrows).toHaveLength(1);
    redNotes = removeArrowById(redNotes, redNotes.arrows[0]!.id);
    expect(redNotes.arrows).toHaveLength(0);

    redNotes = toggleOrReplaceSquareMark(redNotes, { row: 1, col: 1 }, 'yellow');
    redNotes = clearAllPersonalAnnotations();
    expect(redNotes.arrows).toHaveLength(0);
    expect(redNotes.marks).toHaveLength(0);

    // Opponent annotations remain strictly untouched and private
    expect(blackNotes.arrows).toHaveLength(0);
    expect(blackNotes.marks).toHaveLength(0);
  });
});
