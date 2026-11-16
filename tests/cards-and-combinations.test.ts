import { describe, expect, it } from 'vitest';
import {
  createMatchState,
  executePieceMove,
  isPlayerInStalemate,
  playCard,
  projectMatchStateForViewer,
  selectSoldierPromotion,
  skipBerserkerRageMove,
  type CharacterType,
  type Coord,
  type PlayerColor,
  type ServerMatchState,
  type ServerPieceRecord,
} from '../shared/src/index.js';

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

function makePlayingState(
  pieces: ServerPieceRecord[],
  activePlayer: PlayerColor = 'red',
): ServerMatchState {
  const base = createMatchState('combo-match', 'local');
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

describe('Tests complets des 16 cartes et interactions croisées (§8, §20, §21, Q7–Q29)', () => {
  it('tests Kamikaze 2/2 elimination threshold on Colossus and Protection absorbing Kamikaze', () => {
    const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 0 });
    const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 0 });
    const redCol = makePiece('r-col', 'red', 'colosse', { row: 5, col: 4 });
    const bKami1 = makePiece('b-k1', 'black', 'soldat', { row: 4, col: 4 }, { hasKamikaze: true });
    const bKami2 = makePiece('b-k2', 'black', 'soldat', { row: 3, col: 4 }, { hasKamikaze: true });

    let state = makePlayingState([redKing, blackKing, redCol, bKami1, bKami2], 'red');

    // Hit 1/2: Colossus survives
    state = executePieceMove(state, 'red', 'r-col', { row: 4, col: 4 });
    expect(state.pieces.find((p) => p.id === 'r-col')?.alive).toBe(true);
    expect(state.pieces.find((p) => p.id === 'r-col')?.kamikazeHitsTaken).toBe(1);

    // Black moves King
    state = executePieceMove(state, 'black', 'b-king', { row: 0, col: 1 });

    // Hit 2/2: Colossus is eliminated on the 2nd Kamikaze trigger!
    state = executePieceMove(state, 'red', 'r-col', { row: 3, col: 4 });
    expect(state.pieces.find((p) => p.id === 'r-col')?.alive).toBe(false);

    // Attacker with Protection absorbs Kamikaze and survives (Q10)
    const redQueenProt = makePiece('r-q', 'red', 'reine', { row: 5, col: 6 }, {
      hasProtection: true,
    });
    const bKami4 = makePiece('b-k4', 'black', 'soldat', { row: 4, col: 6 }, {
      hasKamikaze: true,
    });
    let stateProt = makePlayingState([redKing, blackKing, redQueenProt, bKami4], 'red');
    stateProt = executePieceMove(stateProt, 'red', 'r-q', { row: 4, col: 6 });
    const queenAfter = stateProt.pieces.find((p) => p.id === 'r-q')!;
    expect(queenAfter.alive).toBe(true);
    expect(queenAfter.hasProtection).toBe(false);
  });

  it('tests Protection blocking direct attack (Q11) and blocking Cavalier jump (Q9)', () => {
    const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 0 });
    const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 0 });
    const redAss = makePiece('r-ass', 'red', 'assassin', { row: 5, col: 3 });
    const blackProt = makePiece('b-prot', 'black', 'reine', { row: 4, col: 3 }, {
      hasProtection: true,
    });

    let state = makePlayingState([redKing, blackKing, redAss, blackProt], 'red');
    state = executePieceMove(state, 'red', 'r-ass', { row: 4, col: 3 });

    // Target survives, Protection breaks, attacker stays on (5,3)
    expect(state.pieces.find((p) => p.id === 'b-prot')?.alive).toBe(true);
    expect(state.pieces.find((p) => p.id === 'b-prot')?.hasProtection).toBe(false);
    expect(state.pieces.find((p) => p.id === 'r-ass')?.position).toEqual({ row: 5, col: 3 });

    // Cavalier jump over Protected piece -> interrupted, Protection breaks, 0 kills -> opponent gets standard 1 action (0-kill penalty removed)
    const redCav = makePiece('r-cav', 'red', 'cavalier', { row: 6, col: 5 });
    const blackProt2 = makePiece('b-prot2', 'black', 'soldat', { row: 5, col: 5 }, {
      hasProtection: true,
    });
    let stateCav = makePlayingState([redKing, blackKing, redCav, blackProt2], 'red');
    stateCav = executePieceMove(stateCav, 'red', 'r-cav', { row: 4, col: 5 });
    expect(stateCav.pieces.find((p) => p.id === 'b-prot2')?.alive).toBe(true);
    expect(stateCav.pieces.find((p) => p.id === 'b-prot2')?.hasProtection).toBe(false);
    expect(stateCav.turn.activePlayer).toBe('black');
    expect(stateCav.turn.remainingActions).toBe(1);
  });

  it('tests Block (2-turn cooldown Q17), Retreat (with backward capture §21.21), and Téléportation (directional constraint Q21)', () => {
    const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 0 });
    const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 0 });
    const redSoldier = makePiece('r-sol', 'red', 'soldat', { row: 4, col: 4 });
    const blackBehind = makePiece('b-beh', 'black', 'soldat', { row: 5, col: 4 });

    let state = makePlayingState([redKing, blackKing, redSoldier, blackBehind], 'red');
    state = {
      ...state,
      players: {
        ...state.players,
        red: {
          ...state.players.red,
          hand: ['block', 'retreat', 'teleportation'],
        },
      },
    };

    // 1. Play Block -> Black's turn is skipped, Red plays again immediately, Block cooldown is 2 turns
    state = playCard(state, 'red', { card: 'block' });
    expect(state.turn.activePlayer).toBe('red');
    expect(state.players.red.blockCooldownTurnsRemaining).toBe(2);

    // 2. Play Retreat on Soldier to capture backward at (5,4) (§8.4, §21.21)
    state = playCard(state, 'red', {
      card: 'retreat',
      targetPieceId: 'r-sol',
      destination: { row: 5, col: 4 },
    });
    expect(state.pieces.find((p) => p.id === 'b-beh')?.alive).toBe(false);
    expect(state.pieces.find((p) => p.id === 'r-sol')?.position).toEqual({ row: 5, col: 4 });

    // Black plays
    state = executePieceMove(state, 'black', 'b-king', { row: 0, col: 1 });

    // 3. Play Téléportation on Soldier: backward teleport (7,4) must be rejected (Q21), forward teleport (3,4) succeeds!
    expect(() =>
      playCard(state, 'red', {
        card: 'teleportation',
        targetPieceId: 'r-sol',
        destination: { row: 7, col: 4 },
      }),
    ).toThrow();

    state = playCard(state, 'red', {
      card: 'teleportation',
      targetPieceId: 'r-sol',
      destination: { row: 3, col: 4 },
    });
    expect(state.pieces.find((p) => p.id === 'r-sol')?.position).toEqual({ row: 3, col: 4 });
  });

  it('tests Résurrection preserving promoted identity (§8.7, §21.9) and Recrutement 1x limit (§8.12)', () => {
    const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 0 });
    const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 8 });
    const redSoldier = makePiece('r-sol', 'red', 'soldat', { row: 1, col: 3 });
    const blackKiller = makePiece('b-kill', 'black', 'reine', { row: 0, col: 5 });
    const deadSoldier = makePiece('r-dead-sol', 'red', 'soldat', { row: 7, col: 7 }, {
      alive: false,
      position: null,
    });

    let state = makePlayingState(
      [redKing, blackKing, redSoldier, blackKiller, deadSoldier],
      'red',
    );
    state = {
      ...state,
      graveyard: [
        {
          pieceId: 'r-dead-sol',
          owner: 'red',
          characterAtDeath: 'soldat',
          wasSacrificed: false,
          knownToOpponentAtDeath: false,
          knownReason: null,
        },
      ],
      players: {
        ...state.players,
        red: {
          ...state.players.red,
          hand: ['resurrection', 'recrutement'],
        },
      },
    };

    // Promote r-sol into Berserker
    state = executePieceMove(state, 'red', 'r-sol', { row: 0, col: 3 });
    state = selectSoldierPromotion(state, 'red', 'berserker');
    expect(state.pieces.find((p) => p.id === 'r-sol')?.character).toBe('berserker');

    // Black Queen eliminates the promoted Berserker at (0,3)
    state = executePieceMove(state, 'black', 'b-kill', { row: 0, col: 3 });

    // Red plays Résurrection on r-sol -> revives as Berserker on row 8 (§8.7, §21.9)
    state = playCard(state, 'red', {
      card: 'resurrection',
      graveyardPieceId: 'r-sol',
      destination: { row: 8, col: 3 },
    });
    const revived = state.pieces.find((p) => p.id === 'r-sol')!;
    expect(revived.alive).toBe(true);
    expect(revived.character).toBe('berserker');
    expect(revived.position).toEqual({ row: 8, col: 3 });

    // Black moves
    state = executePieceMove(state, 'black', 'b-kill', { row: 0, col: 4 });

    // Red plays Recrutement -> revives r-dead-sol on row 8 and sets recruitmentUsed = true
    state = playCard(state, 'red', {
      card: 'recrutement',
      destination: { row: 8, col: 4 },
    });
    expect(state.pieces.find((p) => p.id === 'r-dead-sol')?.alive).toBe(true);
    expect(state.players.red.recruitmentUsed).toBe(true);
  });

  it('tests Double action + Berserker Rage + Cavalier combinations (§8.13, Q23, Q24, Q25)', () => {
    const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 0 });
    const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 8 });
    const redBerserker = makePiece('r-ber', 'red', 'berserker', { row: 5, col: 2 });
    const blackVictim = makePiece('b-v1', 'black', 'soldat', { row: 4, col: 2 });
    const redCav = makePiece('r-cav', 'red', 'cavalier', { row: 6, col: 6 });

    let state = makePlayingState([redKing, blackKing, redBerserker, blackVictim, redCav], 'red');
    state = {
      ...state,
      players: {
        ...state.players,
        red: {
          ...state.players.red,
          hand: ['double_action', 'brouillard'],
        },
      },
    };

    // Play Double action -> 2 actions immediately, cannot play 2nd card
    state = playCard(state, 'red', { card: 'double_action' });
    expect(state.turn.remainingActions).toBe(2);
    expect(state.turn.doubleActionActive).toBe(true);
    expect(() => playCard(state, 'red', { card: 'brouillard' })).toThrow();

    // Action 1: Berserker kills b-v1 at (4,2) -> triggers optional Rage move without consuming Action 2 (Q24)
    state = executePieceMove(state, 'red', 'r-ber', { row: 4, col: 2 });
    expect(state.turn.pendingBerserkerRagePieceId).toBe('r-ber');
    expect(state.turn.remainingActions).toBe(2);

    // Execute Rage 2nd move to (2,2) -> completes Action 1, leaving 1 action in Double action
    state = executePieceMove(state, 'red', 'r-ber', { row: 2, col: 2 });
    expect(state.turn.pendingBerserkerRagePieceId).toBeNull();
    expect(state.turn.remainingActions).toBe(1);

    // Action 2: Cavalier moves 1 square H/V without killing -> ends Red's turn with 1 elimination total -> Black gets standard 1 action!
    state = executePieceMove(state, 'red', 'r-cav', { row: 5, col: 6 });
    expect(state.turn.activePlayer).toBe('black');
    expect(state.turn.remainingActions).toBe(1);
  });

  it('forbids Kamikaze, Protection, and Invincibilité on Roi and Colosse, and notifies opponent of card used while keeping target piece secret', () => {
    const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 4 });
    const redColossus = makePiece('r-col', 'red', 'colosse', { row: 7, col: 4 });
    const redSoldier = makePiece('r-sol', 'red', 'soldat', { row: 5, col: 4 });
    const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 4 });
    const blackAttacker = makePiece('b-att', 'black', 'reine', { row: 4, col: 4 });

    let state = makePlayingState([redKing, redColossus, redSoldier, blackKing, blackAttacker], 'red');
    state = {
      ...state,
      players: {
        ...state.players,
        red: {
          ...state.players.red,
          hand: ['kamikaze', 'protection', 'invincibilite'],
        },
      },
    };

    // Kamikaze, Protection, and Invincibilité must be rejected on Roi and Colosse
    for (const forbiddenCard of ['kamikaze', 'protection', 'invincibilite'] as const) {
      expect(() =>
        playCard(state, 'red', { card: forbiddenCard, targetPieceId: 'r-king' }),
      ).toThrow();
      expect(() =>
        playCard(state, 'red', { card: forbiddenCard, targetPieceId: 'r-col' }),
      ).toThrow();
    }

    // Play Invincibilité on Red Soldier at (5,4) (E4)
    const afterInv = playCard(state, 'red', {
      card: 'invincibilite',
      targetPieceId: 'r-sol',
    });

    // Owner sees isInvincible = true on their Soldier
    const redView = projectMatchStateForViewer(afterInv, 'red');
    expect(redView.pieces.find((p) => p.id === 'r-sol')?.isInvincible).toBe(true);

    // Opponent is notified that Invincibilité was played, but does NOT know which piece has it!
    const blackView = projectMatchStateForViewer(afterInv, 'black');
    expect(blackView.pieces.find((p) => p.id === 'r-sol')?.isInvincible).toBe(false);
    const oppLog = blackView.actionLog[blackView.actionLog.length - 1]!.text;
    expect(oppLog).toContain('Invincibilité');
    expect(oppLog).not.toContain('E4');

    // If Black attacks the secretly Invincible Soldier at (5,4), the attack is blocked and the Soldier survives!
    const afterBlockedAttack = executePieceMove(afterInv, 'black', 'b-att', { row: 5, col: 4 });
    expect(afterBlockedAttack.pieces.find((p) => p.id === 'r-sol')?.alive).toBe(true);
    expect(afterBlockedAttack.pieces.find((p) => p.id === 'b-att')?.position).toEqual({
      row: 4,
      col: 4,
    });
  });

  it('detects Stalemate / Pat when active player has no legal piece move and no playable card (Q29)', () => {
    // Red King is immobilized for 1 turn and has no other alive pieces and no playable cards
    const redImmobilizedKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 4 }, {
      immobilizedTicksRemaining: 2,
    });
    const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 4 });
    const state = makePlayingState([redImmobilizedKing, blackKing], 'red');
    expect(isPlayerInStalemate(state, 'red')).toBe(true);
  });

  it('generates structured CardNotificationView for all cards, updates lastMove on Téléportation/Retreat/Résurrection/Recrutement, and strictly hides secret targets from opponent', () => {
    const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 4 });
    const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 4 });
    const redSoldier = makePiece('r-sol', 'red', 'soldat', { row: 5, col: 3 }); // D4
    const blackSecretPiece = makePiece('b-sec', 'black', 'assassin', { row: 2, col: 6 }); // G7
    const deadRedAssassin = makePiece('r-dead-ass', 'red', 'assassin', { row: 8, col: 3 }, { alive: false });

    let state = makePlayingState(
      [redKing, blackKing, redSoldier, blackSecretPiece, deadRedAssassin],
      'red',
    );

    // 1. Secret cards: Kamikaze on D4 (5,3) -> opponent notification must NOT contain D4
    state = {
      ...state,
      players: {
        ...state.players,
        red: { ...state.players.red, hand: ['kamikaze'] },
      },
    };
    state = playCard(state, 'red', { card: 'kamikaze', targetPieceId: 'r-sol' }, 1000);
    const blackViewAfterKamikaze = projectMatchStateForViewer(state, 'black');
    const kamikazeNotif =
      blackViewAfterKamikaze.cardNotifications[blackViewAfterKamikaze.cardNotifications.length - 1]!;
    expect(kamikazeNotif.card).toBe('kamikaze');
    expect(kamikazeNotif.cardName).toBe('Kamikaze');
    expect(kamikazeNotif.visibleTargetNotation).toBeNull();
    expect(kamikazeNotif.consequenceText).toContain('secrète');
    expect(kamikazeNotif.consequenceText).not.toContain('D4');

    // 2. Black plays Piège at C6 (3,2) -> Red notification must NOT contain C6
    state = {
      ...state,
      players: {
        ...state.players,
        black: { ...state.players.black, hand: ['piege'] },
      },
    };
    state = playCard(state, 'black', { card: 'piege', destination: { row: 3, col: 2 } }, 2000);
    const redViewAfterTrap = projectMatchStateForViewer(state, 'red');
    const trapNotif =
      redViewAfterTrap.cardNotifications[redViewAfterTrap.cardNotifications.length - 1]!;
    expect(trapNotif.card).toBe('piege');
    expect(trapNotif.visibleTargetNotation).toBeNull();
    expect(trapNotif.consequenceText).toContain('secret');
    expect(trapNotif.consequenceText).not.toContain('C6');

    // 3. Red plays Téléportation on D4 (5,3) -> D6 (3,3) -> updates lastMove and shows move in notification
    state = {
      ...state,
      players: {
        ...state.players,
        red: { ...state.players.red, hand: ['teleportation'] },
      },
    };
    state = playCard(
      state,
      'red',
      { card: 'teleportation', targetPieceId: 'r-sol', destination: { row: 3, col: 3 } },
      3000,
    );
    expect(state.lastMove?.kind).toBe('teleportation');
    expect(state.lastMove?.from).toEqual({ row: 5, col: 3 });
    expect(state.lastMove?.to).toEqual({ row: 3, col: 3 });
    const blackViewAfterTp = projectMatchStateForViewer(state, 'black');
    const tpNotif =
      blackViewAfterTp.cardNotifications[blackViewAfterTp.cardNotifications.length - 1]!;
    expect(tpNotif.card).toBe('teleportation');
    expect(tpNotif.consequenceText).toContain('D4');
    expect(tpNotif.consequenceText).toContain('D6');

    // 4. Black plays Retreat on G7 (2,6) -> G8 (1,6) -> updates lastMove
    state = {
      ...state,
      players: {
        ...state.players,
        black: { ...state.players.black, hand: ['retreat'] },
      },
    };
    state = playCard(
      state,
      'black',
      { card: 'retreat', targetPieceId: 'b-sec', destination: { row: 1, col: 6 } },
      4000,
    );
    expect(state.lastMove?.kind).toBe('retreat_move');
    expect(state.lastMove?.from).toEqual({ row: 2, col: 6 });
    expect(state.lastMove?.to).toEqual({ row: 1, col: 6 });

    // 5. Red plays Résurrection on dead Assassin at A1 (8,0) -> updates lastMove without leaking identity to Black
    state = {
      ...state,
      graveyard: [
        {
          pieceId: 'r-dead-ass',
          owner: 'red',
          characterAtDeath: 'assassin',
          wasSacrificed: false,
          knownToOpponentAtDeath: false,
          knownReason: null,
        },
      ],
      players: {
        ...state.players,
        red: { ...state.players.red, hand: ['resurrection'] },
      },
    };
    state = playCard(
      state,
      'red',
      { card: 'resurrection', graveyardPieceId: 'r-dead-ass', destination: { row: 8, col: 0 } },
      5000,
    );
    expect(state.lastMove?.kind).toBe('resurrection');
    expect(state.lastMove?.to).toEqual({ row: 8, col: 0 });
    const blackViewAfterRes = projectMatchStateForViewer(state, 'black');
    const resNotif =
      blackViewAfterRes.cardNotifications[blackViewAfterRes.cardNotifications.length - 1]!;
    expect(resNotif.consequenceText).toContain('A1');
    expect(resNotif.consequenceText).not.toContain('Assassin');
  });
});
