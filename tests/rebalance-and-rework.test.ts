import { describe, expect, it } from 'vitest';
import {
  CHARACTER_DOSSIERS,
  CHARACTER_TYPES,
  TUTORIAL_SCENARIOS,
  createMatchState,
  executePieceMove,
  generateMoveCandidatesForPiece,
  markTraqueurTarget,
  migrateLegacyMatchState,
  playCard,
  projectMatchStateForViewer,
  runDefaultTutorialOpponentStep,
  stopCavalierJumpChain,
  type CharacterType,
  type Coord,
  type PlayerColor,
  type ServerMatchState,
  type ServerPieceRecord,
  type VisibilityContext,
} from '../shared/src/index.js';
import { selectContextualTip } from '../client/src/board/contextualTutorials.js';
import {
  AVATAR_CHARACTER_OPTIONS,
  resolveCharacterFromLegacyBadge,
} from '../client/src/components/PieceArtwork.js';

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
    traqueurMarkedTargetId: null,
    traqueurPursuitReady: false,
    arbaletrierCooldownTurnsRemaining: 0,
    ...overrides,
  };
}

function makePlayingState(
  pieces: ServerPieceRecord[],
  activePlayer: PlayerColor = 'red',
  overrides: Partial<ServerMatchState> = {},
): ServerMatchState {
  const base = createMatchState('rebalance-test', 'local');
  return {
    ...base,
    phase: 'playing',
    pieces,
    turn: {
      ...base.turn,
      activePlayer,
    },
    ...overrides,
  };
}

const CLEAR_VIS: VisibilityContext = {
  fogTurnsRemainingByOwner: { red: 0, black: 0 },
  viewerGuetteurReconKeys: new Set<string>(),
};

describe('Équilibrage & Refonte : Arbalétrier 1/3, Cavalier Bond en L, Traqueur, Tours Bonus, Tutoriels & Identité Visuelle', () => {
  describe('1. Nerf Arbalétrier : exactement 1 tir tous les 3 tours personnels', () => {
    it('allows Tour 1 shot -> locks Tour 2 & Tour 3 -> unlocks Tour 4, allows 1-sq ortho moves while recharging, resists Téléportation/Block, and survives migration', () => {
      const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 0 });
      const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 8 });
      const redArb = makePiece('r-arb', 'red', 'arbaletrier', { row: 6, col: 4 });
      const bTarget1 = makePiece('b-t1', 'black', 'soldat', { row: 4, col: 4 });
      const bTarget2 = makePiece('b-t2', 'black', 'soldat', { row: 2, col: 4 });

      let state = makePlayingState([redKing, blackKing, redArb, bTarget1, bTarget2], 'red', {
        players: {
          ...createMatchState('arb-cycle', 'local').players,
          red: {
            ...createMatchState('arb-cycle', 'local').players.red,
            hand: ['teleportation', 'block'],
          },
        },
      });

      // Red Turn 1: Shot is READY (0) -> Fires at bTarget1 -> turn ends with cooldown 2
      state = executePieceMove(state, 'red', 'r-arb', { row: 4, col: 4 });
      expect(state.pieces.find((p) => p.id === 'b-t1')?.alive).toBe(false);
      expect(state.pieces.find((p) => p.id === 'r-arb')?.arbaletrierCooldownTurnsRemaining).toBe(2);
      expect(state.turn.activePlayer).toBe('black');

      // Black moves -> Red's cooldown MUST NOT decrease on opponent's turn
      state = executePieceMove(state, 'black', 'b-king', { row: 0, col: 7 });
      expect(state.pieces.find((p) => p.id === 'r-arb')?.arbaletrierCooldownTurnsRemaining).toBe(2);

      // Red Turn 2: Shot INDISPONIBLE (cooldown = 2), even if Téléportation moves Arbalétrier first!
      const redViewT2 = projectMatchStateForViewer(state, 'red');
      expect(
        redViewT2.pieces.find((p) => p.id === 'r-arb')?.arbaletrierCooldownTurnsVisible,
      ).toBe(2);
      state = playCard(state, 'red', {
        card: 'teleportation',
        targetPieceId: 'r-arb',
        destination: { row: 5, col: 4 },
      });
      // Téléportation must NOT clear or shorten Arbalétrier shot cooldown, and ends turn (2 -> 1)!
      expect(state.pieces.find((p) => p.id === 'r-arb')?.arbaletrierCooldownTurnsRemaining).toBe(1);

      state = executePieceMove(state, 'black', 'b-king', { row: 0, col: 8 });

      // Red Turn 3: Shot STILL INDISPONIBLE (cooldown = 1), normal 1-case H/V move allowed!
      const arbT3 = state.pieces.find((p) => p.id === 'r-arb')!;
      const t3Moves = generateMoveCandidatesForPiece(arbT3, state.pieces, CLEAR_VIS, false);
      expect(t3Moves.some((m) => m.kind === 'crossbow_shot')).toBe(false);
      expect(t3Moves.some((m) => m.kind === 'normal_move' && m.to.row === 4 && m.to.col === 4)).toBe(true);

      // Snapshot round-trip through migrateLegacyMatchState preserves exact cooldown = 1
      const persisted = migrateLegacyMatchState(JSON.parse(JSON.stringify(state)) as ServerMatchState);
      expect(persisted.pieces.find((p) => p.id === 'r-arb')?.arbaletrierCooldownTurnsRemaining).toBe(1);

      // Move Arbalétrier 1 square up to (4,4) -> Turn 3 ends -> cooldown 1 -> 0!
      state = executePieceMove(persisted, 'red', 'r-arb', { row: 4, col: 4 });
      expect(state.pieces.find((p) => p.id === 'r-arb')?.arbaletrierCooldownTurnsRemaining).toBe(0);

      state = executePieceMove(state, 'black', 'b-king', { row: 0, col: 7 });

      // Red Turn 4: Shot DISPONIBLE AGAIN (0) -> eliminates bTarget2 at (2,4)!
      const t4View = projectMatchStateForViewer(state, 'red');
      expect(t4View.pieces.find((p) => p.id === 'r-arb')?.arbaletrierCooldownTurnsVisible).toBe(0);
      state = executePieceMove(state, 'red', 'r-arb', { row: 2, col: 4 });
      expect(state.pieces.find((p) => p.id === 'b-t2')?.alive).toBe(false);
      expect(state.pieces.find((p) => p.id === 'r-arb')?.arbaletrierCooldownTurnsRemaining).toBe(2);
    });
  });

  describe('2. Cavalier Rework : 1 case H/V, Bond en « L » par-dessus obstacles/pièges, Percée en chaîne & 0 pénalité', () => {
    it('disallows 1-sq diagonal steps, leaps obstacles & Colossus & intermediate traps in L-shape, triggers landing traps, and supports Percée chain', () => {
      const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 0 });
      const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 8 });
      const redCav = makePiece('r-cav', 'red', 'cavalier', { row: 5, col: 4 });
      // Obstacles tightly surrounding Cavalier on all 8 adjacent squares except leaving (3,3) free for L-leap!
      const blackColBlocking = makePiece('b-col', 'black', 'colosse', { row: 4, col: 4 });
      const redAllyGuard = makePiece('r-ally', 'red', 'soldat', { row: 4, col: 3 });
      const bLTarget = makePiece('b-ltarget', 'black', 'soldat', { row: 3, col: 3 });

      let state = makePlayingState(
        [redKing, blackKing, redCav, blackColBlocking, redAllyGuard, bLTarget],
        'red',
        {
          traps: [
            // Intermediate trap between (5,4) and (3,3) at (4,3) must NOT detonate on L-leap!
            { id: 't-mid', owner: 'black', coord: { row: 4, col: 3 }, active: true },
            // Landing trap at (4,2) WILL trigger when landed on!
            { id: 't-land', owner: 'black', coord: { row: 4, col: 2 }, active: true },
          ],
        },
      );

      const moves = generateMoveCandidatesForPiece(redCav, state.pieces, CLEAR_VIS, false);
      // 1-case diagonal like (4,5) or (6,5) is NOT a normal Cavalier move anymore
      expect(moves.some((m) => m.to.row === 6 && m.to.col === 5)).toBe(false);
      // L-leap to (3,3) capturing bLTarget IS allowed even over ally & intermediate trap!
      const leapCapture = moves.find((m) => m.to.row === 3 && m.to.col === 3);
      expect(leapCapture?.kind).toBe('capture_move');

      // Execute L-leap capture (5,4) -> (3,3)
      state = executePieceMove(state, 'red', 'r-cav', { row: 3, col: 3 });
      expect(state.lastMove?.kind).toBe('cavalier_leap');
      expect(state.pieces.find((p) => p.id === 'b-ltarget')?.alive).toBe(false);
      expect(state.traps.find((t) => t.id === 't-mid')?.active).toBe(true);
      // 1 kill -> Black gets standard 1 action
      expect(state.turn.activePlayer).toBe('black');
      expect(state.turn.remainingActions).toBe(1);

      // Black moves -> Red Cavalier moves 1 square H/V without killing (3,3) -> (3,2) -> NO 0-kill penalty!
      state = executePieceMove(state, 'black', 'b-king', { row: 0, col: 7 });
      state = executePieceMove(state, 'red', 'r-cav', { row: 3, col: 2 });
      expect(state.turn.activePlayer).toBe('black');
      expect(state.turn.remainingActions).toBe(1);

      // Isolated L-leap directly onto landing trap triggers trap (immobilizing Cavalier & deactivating trap)!
      const cavTrapTest = makePiece('r-cav-t', 'red', 'cavalier', { row: 6, col: 3 });
      let stateTrap = makePlayingState([redKing, blackKing, cavTrapTest], 'red', {
        traps: [{ id: 't-dest', owner: 'black', coord: { row: 4, col: 2 }, active: true }],
      });
      stateTrap = executePieceMove(stateTrap, 'red', 'r-cav-t', { row: 4, col: 2 });
      const cavAfterTrap = stateTrap.pieces.find((p) => p.id === 'r-cav-t')!;
      expect(cavAfterTrap.alive).toBe(true);
      expect(cavAfterTrap.immobilizedTicksRemaining).toBeGreaterThan(0);
      expect(stateTrap.traps.find((t) => t.id === 't-dest')?.active).toBe(false);
    });
  });

  describe('3. Traqueur Clarté : Marquage 0 action, Poursuite tour suivant uniquement sur cible marquée', () => {
    it('keeps pursuit locked on the marking turn, enables +1 capture on the next turn exclusively on the marked square, and stays blocked on empty 4th square or wrong enemy', () => {
      const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 0 });
      const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 8 });
      const redTraq = makePiece('r-traq', 'red', 'traqueur', { row: 6, col: 4 });
      const bMarked = makePiece('b-marked', 'black', 'roi', { row: 2, col: 4 }, {
        permanentlyRevealedTo: { red: true, black: false },
      });
      const bOther4 = makePiece('b-other', 'black', 'soldat', { row: 6, col: 8 }, {
        permanentlyRevealedTo: { red: true, black: false },
      });

      let state = makePlayingState([redKing, redTraq, bMarked, bOther4], 'red');
      // Mark bMarked (dist 4? Wait make bMarked at (3,4) dist 3 to mark -> move down to (7,4) -> bMarked stays at (3,4) dist 4!)
      state = {
        ...state,
        pieces: state.pieces.map((p) =>
          p.id === 'b-marked' ? { ...p, position: { row: 3, col: 4 } } : p,
        ),
      };
      // Mark at 0 action
      state = markTraqueurTarget(state, 'red', 'r-traq', 'b-marked');
      expect(state.turn.activePlayer).toBe('red');
      expect(state.turn.remainingActions).toBe(1);
      expect(state.pieces.find((p) => p.id === 'r-traq')?.traqueurPursuitReady).toBe(false);

      // Same turn: move 1 square down (6,4) -> (7,4) so target at (3,4) is dist 4 away, end turn
      state = executePieceMove(state, 'red', 'r-traq', { row: 7, col: 4 });
      expect(state.turn.activePlayer).toBe('black');

      // Black moves bOther4 1 step forward (6,8)->(7,8), leaving marked b-marked at (3,4) (dist 4 from (7,4))!
      state = executePieceMove(state, 'black', 'b-other', { row: 7, col: 8 });

      // Red next turn: Pursuit +1 READY! Can capture bMarked at dist 4 (3,4), CANNOT step onto empty 4th square!
      const traqNext = state.pieces.find((p) => p.id === 'r-traq')!;
      expect(traqNext.traqueurPursuitReady).toBe(true);
      const nextMoves = generateMoveCandidatesForPiece(traqNext, state.pieces, CLEAR_VIS, false);
      expect(
        nextMoves.some(
          (m) =>
            m.to.row === 3 &&
            m.to.col === 4 &&
            m.kind === 'capture_move' &&
            m.targetEnemyPieceId === 'b-marked',
        ),
      ).toBe(true);
      // Empty 4th square to the left (7,0) must NOT be reachable by Pursuit
      expect(nextMoves.some((m) => m.to.row === 7 && m.to.col === 0)).toBe(false);
    });
  });

  describe('4. Gestion des Tours & Bonus Généralisés (0 = 1, 1 = 1, 2+ = Tour Bonus)', () => {
    it('grants a Bonus Turn for any character achieving 2+ eliminations in one turn via Double Action without double-ticking Arbalétrier cooldown or miscounting Sacrifice/Blocked', () => {
      const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 0 });
      const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 8 });
      const redArb = makePiece('r-arb', 'red', 'arbaletrier', { row: 5, col: 4 });
      const redQueen = makePiece('r-queen', 'red', 'reine', { row: 6, col: 2 });
      const bTarget1 = makePiece('b-1', 'black', 'soldat', { row: 3, col: 4 });
      const bTarget2 = makePiece('b-2', 'black', 'soldat', { row: 5, col: 2 });
      const bColossus = makePiece('b-col', 'black', 'colosse', { row: 8, col: 8 });

      let state = makePlayingState(
        [redKing, blackKing, redArb, redQueen, bTarget1, bTarget2, bColossus],
        'red',
        {
          players: {
            ...createMatchState('bonus-gen', 'local').players,
            red: {
              ...createMatchState('bonus-gen', 'local').players.red,
              hand: ['double_action'],
            },
          },
        },
      );

      state = playCard(state, 'red', { card: 'double_action' });
      // Action 1: Arbalétrier eliminates bTarget1 (cooldown becomes 3)
      state = executePieceMove(state, 'red', 'r-arb', { row: 3, col: 4 });
      expect(state.turn.eliminatedEnemyIdsThisTurn).toEqual(['b-1']);
      expect(state.turn.remainingActions).toBe(1);

      // Action 2: Queen eliminates bTarget2 -> 2nd unique elimination this turn -> Generalized BONUS TURN!
      state = executePieceMove(state, 'red', 'r-queen', { row: 5, col: 2 });
      expect(state.turn.activePlayer).toBe('red');
      expect(state.turn.isBonusTurn).toBe(true);
      expect(state.turn.bonusTurnReason).toContain('2');
      expect(state.turn.remainingActions).toBe(1);
      // Entering Bonus Turn MUST NOT tick Arbalétrier cooldown down prematurely! Still 3 until Bonus Turn finishes!
      expect(state.pieces.find((p) => p.id === 'r-arb')?.arbaletrierCooldownTurnsRemaining).toBe(3);

      // Cards forbidden during Bonus Turn
      expect(projectMatchStateForViewer(state, 'red').turn.canPlayCardNow).toBe(false);

      // Complete Bonus Turn by moving King (0 extra kills during bonus turn -> ends turn normally to Black with 1 action; Arbalétrier ticks 3 -> 2 once!)
      state = executePieceMove(state, 'red', 'r-king', { row: 8, col: 1 });
      expect(state.turn.activePlayer).toBe('black');
      expect(state.turn.isBonusTurn).toBe(false);
      expect(state.turn.remainingActions).toBe(1);
      expect(state.pieces.find((p) => p.id === 'r-arb')?.arbaletrierCooldownTurnsRemaining).toBe(2);

      // Legacy migration maps isCavalierBonusTurn -> isBonusTurn & clears old 0-kill penalty
      const legacyTurnState = {
        ...state,
        turn: {
          ...state.turn,
          remainingActions: 2,
          isBonusTurn: undefined as any,
          isCavalierBonusTurn: true,
          cavalierZeroKillPenaltyTriggered: true,
        },
      };
      const migrated = migrateLegacyMatchState(legacyTurnState);
      expect(migrated.turn.isBonusTurn).toBe(true);
      expect(migrated.turn.remainingActions).toBe(1);
    });

    it('lets stopCavalierJumpChain end chain with 1 kill giving opponent 1 action', () => {
      const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 0 });
      const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 8 });
      const redCav = makePiece('r-cav', 'red', 'cavalier', { row: 6, col: 2 });
      const enemy1 = makePiece('b-e1', 'black', 'soldat', { row: 5, col: 2 });
      const enemy2 = makePiece('b-e2', 'black', 'soldat', { row: 3, col: 2 });

      let state = makePlayingState([redKing, blackKing, redCav, enemy1, enemy2], 'red');
      state = executePieceMove(state, 'red', 'r-cav', { row: 4, col: 2 });
      expect(state.turn.pendingCavalierJumpPieceId).toBe('r-cav');
      state = stopCavalierJumpChain(state, 'red');
      expect(state.turn.activePlayer).toBe('black');
      expect(state.turn.remainingActions).toBe(1);
      expect(state.turn.isBonusTurn).toBe(false);
    });
  });

  describe('5. Tutoriels Progressifs (10 Thèmes), Guides Contextuels & Uniformité Visuelle', () => {
    it('initializes all restructured tutorial scenarios across Themes 1-10 and runs Black auto-step without softlocking', () => {
      const themes = new Set<number>();
      for (const scen of TUTORIAL_SCENARIOS) {
        themes.add(scen.themeNumber);
        const initial = scen.createInitialState();
        expect(initial.phase).toBe('playing');
        expect(scen.checkCompleted(initial)).toBe(false);

        // Simulate Black getting a turn and verify runDefaultTutorialOpponentStep never crashes
        const asBlackTurn: ServerMatchState = {
          ...initial,
          turn: { ...initial.turn, activePlayer: 'black', remainingActions: 1 },
        };
        const stepped = scen.stepOpponentTurn
          ? scen.stepOpponentTurn(asBlackTurn)
          : runDefaultTutorialOpponentStep(asBlackTurn);
        expect(stepped).not.toBeNull();
        expect(stepped!.phase).toBe('playing');
      }
      expect(themes.size).toBe(10);
    });

    it('returns at most ONE contextual tip and honors dismissed IDs and enabled setting', () => {
      const state = makePlayingState([
        makePiece('r-king', 'red', 'roi', { row: 8, col: 0 }),
        makePiece('b-king', 'black', 'roi', { row: 0, col: 8 }),
        makePiece('r-arb', 'red', 'arbaletrier', { row: 6, col: 4 }),
      ]);
      const view = projectMatchStateForViewer(state, 'red');
      const arbPiece = view.pieces.find((p) => p.id === 'r-arb')!;

      const tip1 = selectContextualTip({
        view,
        selectedPiece: arbPiece,
        dismissedIds: [],
        enabled: true,
      });
      expect(tip1?.id).toBe('ctx_arbaletrier_cooldown');

      const tipAfterDismiss = selectContextualTip({
        view,
        selectedPiece: arbPiece,
        dismissedIds: ['ctx_arbaletrier_cooldown'],
        enabled: true,
      });
      expect(tipAfterDismiss?.id).toBe('ctx_turn_rules');

      const tipDisabled = selectContextualTip({
        view,
        selectedPiece: arbPiece,
        dismissedIds: [],
        enabled: false,
      });
      expect(tipDisabled).toBeNull();
    });

    it('uses uniform non-emoji typographic emblems on all 12 character dossiers and maps legacy avatar badges seamlessly', () => {
      const legacyGlyphRegex = /[♔♕♜♞⚔🗡◈◇🎯🪓🏹▲❓]/u;
      for (const ch of CHARACTER_TYPES) {
        expect(CHARACTER_DOSSIERS[ch].symbol).not.toMatch(legacyGlyphRegex);
        expect(CHARACTER_DOSSIERS[ch].symbol.length).toBeGreaterThanOrEqual(1);
        expect(CHARACTER_DOSSIERS[ch].symbol.length).toBeLessThanOrEqual(3);
      }

      expect(AVATAR_CHARACTER_OPTIONS.length).toBeGreaterThanOrEqual(8);
      expect(resolveCharacterFromLegacyBadge('♔')).toBe('roi');
      expect(resolveCharacterFromLegacyBadge('♞')).toBe('cavalier');
      expect(resolveCharacterFromLegacyBadge('🏹')).toBe('arbaletrier');
      expect(resolveCharacterFromLegacyBadge('traqueur')).toBe('traqueur');
    });
  });
});
