import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ABSOLUTE_MAX_BY_CHARACTER,
  ARMY_COMPOSITION,
  ARMY_TOTAL_PIECES,
  CARD_DOSSIERS,
  CHARACTER_CATALOG,
  CHARACTER_DOSSIERS,
  CHARACTER_TYPES,
  COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD,
  MECHANIC_DOSSIERS,
  PIECE_TUTORIALS,
  RULE_SECTIONS,
  SPECIAL_RULE_TUTORIALS,
  TOTAL_PIECES_PER_PLAYER,
  TUTORIAL_SCENARIOS,
  autoCompletePlacement,
  computeGuetteurReconZoneKeys,
  countCharacters,
  createInitialArmyRoster,
  createMatchState,
  createZeroNewMechanicsStats,
  executePieceMove,
  generateMoveCandidatesForPiece,
  generateTraqueurMarkCandidates,
  getAvailablePromotionCharacters,
  markTraqueurTarget,
  migrateLegacyMatchState,
  playCard,
  projectMatchStateForViewer,
  selectSoldierPromotion,
  type CharacterType,
  type Coord,
  type PlayerColor,
  type ServerMatchState,
  type ServerPieceRecord,
  type VisibilityContext,
} from '../shared/src/index.js';
import { AuthService } from '../server/src/auth/authService.js';
import { BlindWarDatabase } from '../server/src/database/db.js';
import { GameRoomManager } from '../server/src/rooms/roomManager.js';

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
  const base = createMatchState('v2-update-test', 'local');
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

describe('Mise à jour V2 : Traqueur, Exécuteur, Arbalétrier, Colosse (2 Kamikaze) & Cohérence (§19)', () => {
  describe('1. Composition officielle à 27 pièces & plafonds stricts (Traqueur / Exécuteur / Arbalétrier = 1)', () => {
    it('enforces exact 27-piece 12-role composition and max 1 live instance on Promotion and Résurrection', () => {
      expect(TOTAL_PIECES_PER_PLAYER).toBe(27);
      expect(ARMY_TOTAL_PIECES).toBe(27);
      expect(CHARACTER_TYPES).toHaveLength(12);
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
      expect(countCharacters(roster)).toEqual(ARMY_COMPOSITION);

      for (const ch of ['roi', 'reine', 'colosse', 'traqueur', 'executeur', 'arbaletrier'] as const) {
        expect(ABSOLUTE_MAX_BY_CHARACTER[ch]).toBe(1);
      }

      // Promotion blocked when 1 live Traqueur / Exécuteur / Arbalétrier already on board
      const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 0 });
      const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 8 });
      const redSol = makePiece('r-sol', 'red', 'soldat', { row: 1, col: 4 });
      const redTraq = makePiece('r-traq', 'red', 'traqueur', { row: 7, col: 1 });
      const redExec = makePiece('r-exec', 'red', 'executeur', { row: 7, col: 2 });
      const redArb = makePiece('r-arb', 'red', 'arbaletrier', { row: 7, col: 3 });

      let state = makePlayingState(
        [redKing, blackKing, redSol, redTraq, redExec, redArb],
        'red',
      );
      state = executePieceMove(state, 'red', 'r-sol', { row: 0, col: 4 });
      expect(state.turn.pendingPromotionPieceId).toBe('r-sol');
      const blockedPromoChoices = getAvailablePromotionCharacters('red', state.pieces);
      expect(blockedPromoChoices).not.toContain('traqueur');
      expect(blockedPromoChoices).not.toContain('executeur');
      expect(blockedPromoChoices).not.toContain('arbaletrier');
      expect(
        projectMatchStateForViewer(state, 'red').turn.availablePromotionChoices,
      ).not.toContain('traqueur');
      expect(() => selectSoldierPromotion(state, 'red', 'traqueur')).toThrow();
      expect(() => selectSoldierPromotion(state, 'red', 'executeur')).toThrow();
      expect(() => selectSoldierPromotion(state, 'red', 'arbaletrier')).toThrow();

      // When original Traqueur & Exécuteur are dead, Promotion in them IS allowed — and Résurrection of the old dead copy becomes blocked!
      const deadTraq = makePiece('r-traq-dead', 'red', 'traqueur', { row: 6, col: 6 }, {
        alive: false,
        position: null,
      });
      const stateAfterDeath = makePlayingState(
        [redKing, blackKing, makePiece('r-sol2', 'red', 'soldat', { row: 1, col: 4 }), deadTraq],
        'red',
        {
          players: {
            ...createMatchState('promo-res', 'local').players,
            red: {
              ...createMatchState('promo-res', 'local').players.red,
              hand: ['resurrection'],
            },
          },
          graveyard: [
            {
              pieceId: 'r-traq-dead',
              owner: 'red',
              characterAtDeath: 'traqueur',
              wasSacrificed: false,
              knownToOpponentAtDeath: true,
              knownReason: 'permanent_revelation',
            },
          ],
        },
      );
      let promoState = executePieceMove(stateAfterDeath, 'red', 'r-sol2', { row: 0, col: 4 });
      const openPromoChoices = getAvailablePromotionCharacters('red', promoState.pieces);
      expect(openPromoChoices).toContain('traqueur');
      expect(openPromoChoices).toContain('executeur');
      expect(openPromoChoices).toContain('arbaletrier');
      promoState = selectSoldierPromotion(promoState, 'red', 'traqueur');

      // Black skips turn
      promoState = executePieceMove(promoState, 'black', 'b-king', { row: 0, col: 7 });

      // Red tries to resurrect deadTraq while promoted Traqueur is alive -> strictly rejected!
      expect(() =>
        playCard(promoState, 'red', {
          card: 'resurrection',
          graveyardPieceId: 'r-traq-dead',
          destination: { row: 8, col: 4 },
        }),
      ).toThrow();
    });
  });

  describe('2. Personnage nerfé : Le Traqueur (1-2 ortho, Marquage 0 action & Poursuite +1 = 3)', () => {
    it('moves 1-2 orthogonal without jumping/diagonals, marks ONLY already-revealed ortho 1-2 clear-LoS enemy at 0 action cost, and activates Pursuit +1 (range 3) on next turn', () => {
      const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 0 });
      const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 8 });
      const redTraq = makePiece('r-traq', 'red', 'traqueur', { row: 6, col: 4 });
      const redGuetteur = makePiece('r-gh', 'red', 'guetteur_h', { row: 4, col: 3 }); // spots (4,4) orthogonally!
      const bRevealedTarget = makePiece('b-rev', 'black', 'soldat', { row: 4, col: 4 }); // ortho dist 2 from Traqueur, spotted by r-gh!
      const bHiddenTarget = makePiece('b-hid', 'black', 'soldat', { row: 6, col: 2 }); // ortho dist 2 left, hidden
      const bTooFarTarget = makePiece('b-far', 'black', 'soldat', { row: 6, col: 7 }, {
        permanentlyRevealedTo: { red: true, black: false },
      }); // ortho dist 3 right (too far to move/mark at base range 2!)
      const bDiagRevealed = makePiece('b-diag', 'black', 'soldat', { row: 5, col: 3 }, {
        permanentlyRevealedTo: { red: true, black: false },
      });

      const pieces = [
        redKing,
        blackKing,
        redTraq,
        redGuetteur,
        bRevealedTarget,
        bHiddenTarget,
        bTooFarTarget,
        bDiagRevealed,
      ];
      let state = makePlayingState(pieces, 'red');

      // Movement range check: 1-2 ortho, no diag, no distance 3 yet without Pursuit
      const initialCandidates = generateMoveCandidatesForPiece(
        redTraq,
        pieces,
        CLEAR_VIS,
        false,
      );
      expect(initialCandidates.some((m) => m.to.row === 5 && m.to.col === 4)).toBe(true);
      expect(initialCandidates.some((m) => m.to.row === 4 && m.to.col === 4 && m.kind === 'capture_move')).toBe(true);
      expect(initialCandidates.some((m) => m.to.row === 6 && m.to.col === 7)).toBe(false); // dist 3 forbidden at base range 2!
      expect(initialCandidates.some((m) => m.to.row === 3 && m.to.col === 4)).toBe(false); // dist 3 up forbidden
      expect(initialCandidates.some((m) => m.to.row === 5 && m.to.col === 3)).toBe(false); // diagonal forbidden

      // Mark candidates: ONLY bRevealedTarget at (4,4) (dist 2), NEVER hidden (6,2), NEVER dist-3 (6,7), NEVER diag (5,3)
      const redVis: VisibilityContext = {
        fogTurnsRemainingByOwner: { red: 0, black: 0 },
        viewerGuetteurReconKeys: new Set(['4,3', '4,4', '3,3', '5,3', '4,2']),
      };
      const markCandidates = generateTraqueurMarkCandidates(redTraq, pieces, redVis);
      expect(markCandidates.map((p) => p.id)).toEqual(['b-rev']);
      expect(() => markTraqueurTarget(state, 'red', 'r-traq', 'b-hid')).toThrow();
      expect(() => markTraqueurTarget(state, 'red', 'r-traq', 'b-far')).toThrow();
      expect(() => markTraqueurTarget(state, 'red', 'r-traq', 'b-diag')).toThrow();

      // Mark b-rev at 0 action cost -> turn stays on Red with 1 action remaining!
      state = markTraqueurTarget(state, 'red', 'r-traq', 'b-rev');
      expect(state.turn.activePlayer).toBe('red');
      expect(state.turn.remainingActions).toBe(1);

      // Anti-leak check: Black MUST NOT see the mark on board or in action log
      const blackView = projectMatchStateForViewer(state, 'black');
      const redView = projectMatchStateForViewer(state, 'red');
      expect(redView.pieces.find((p) => p.id === 'b-rev')?.traqueurMarkedByViewer).toBe(true);
      expect(blackView.pieces.find((p) => p.id === 'b-rev')?.traqueurMarkedByViewer).toBeFalsy();
      expect(blackView.pieces.find((p) => p.id === 'r-traq')?.traqueurHasActiveMarkVisible).toBeFalsy();
      expect(blackView.actionLog.some((e) => e.text.toLowerCase().includes('marqué'))).toBe(false);

      // Turn N: Pursuit NOT ready yet. Traqueur steps back 1 square (6,4)->(7,4) so marked b-rev at (4,4) is distance 3!
      state = executePieceMove(state, 'red', 'r-traq', { row: 7, col: 4 });
      expect(state.turn.activePlayer).toBe('black');
      state = executePieceMove(state, 'black', 'b-king', { row: 0, col: 7 });

      // Turn N+1: From (7,4) to b-rev at (4,4) is orthogonal distance 3 -> Pursuit ACTIVE (+1 => 3)!
      const redTraqN1 = state.pieces.find((p) => p.id === 'r-traq')!;
      expect(redTraqN1.traqueurPursuitReady).toBe(true);
      const redVisN1: VisibilityContext = {
        fogTurnsRemainingByOwner: { red: 0, black: 0 },
        viewerGuetteurReconKeys: computeGuetteurReconZoneKeys(state.pieces, 'red'),
      };
      const pursuitMoves = generateMoveCandidatesForPiece(redTraqN1, state.pieces, redVisN1, false);
      // Distance 3 capture directly onto marked target (4,4) IS legal!
      expect(pursuitMoves.some((m) => m.to.row === 4 && m.to.col === 4 && m.kind === 'capture_move')).toBe(true);
      // Distance 4 is NEVER reachable even with Pursuit!
      expect(pursuitMoves.some((m) => m.to.row === 3 && m.to.col === 4)).toBe(false);
      // Sideways dist 3 (7,1) is NOT closer to (4,4) -> NOT legal
      expect(pursuitMoves.some((m) => m.to.row === 7 && m.to.col === 1)).toBe(false);

      // Execute dist-3 Pursuit capture onto b-rev at (4,4)!
      state = executePieceMove(state, 'red', 'r-traq', { row: 4, col: 4 });
      expect(state.pieces.find((p) => p.id === 'b-rev')?.alive).toBe(false);
      expect(state.pieces.find((p) => p.id === 'r-traq')?.position).toEqual({ row: 4, col: 4 });
      expect(state.pieces.find((p) => p.id === 'r-traq')?.traqueurMarkedTargetId).toBeNull();
    });

    it('clears Traqueur mark automatically if target becomes hidden (Brouillard / Contre-espionnage / Temp expiry)', () => {
      const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 0 });
      const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 8 });
      const redTraq = makePiece('r-traq', 'red', 'traqueur', { row: 5, col: 4 });
      const bTempTarget = makePiece('b-temp', 'black', 'soldat', { row: 3, col: 4 }, {
        tempRevealedTicksTo: { red: 2, black: 0 },
      });

      let state = makePlayingState([redKing, blackKing, redTraq, bTempTarget], 'red', {
        players: {
          ...createMatchState('fog-mark', 'local').players,
          black: {
            ...createMatchState('fog-mark', 'local').players.black,
            hand: ['brouillard'],
          },
        },
      });

      state = markTraqueurTarget(state, 'red', 'r-traq', 'b-temp');
      expect(state.pieces.find((p) => p.id === 'r-traq')?.traqueurMarkedTargetId).toBe('b-temp');

      // Red ends turn
      state = executePieceMove(state, 'red', 'r-king', { row: 8, col: 1 });
      // Black plays Brouillard -> hides Black pieces from Red -> Traqueur mark MUST be cleared immediately!
      state = playCard(state, 'black', { card: 'brouillard' });
      expect(state.pieces.find((p) => p.id === 'r-traq')?.traqueurMarkedTargetId).toBeNull();
      expect(state.pieces.find((p) => p.id === 'r-traq')?.traqueurPursuitReady).toBe(false);
    });
  });

  describe('3. Nouveau personnage : L’Exécuteur (1-2 ortho & Frappe traversante + Colosse)', () => {
    it('executes Frappe traversante leaving intermediate intact and Exécuteur on origin, kills rear Colosse, and forbids killing Colosse directly', () => {
      const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 0 });
      const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 8 });
      const redExec = makePiece('r-exec', 'red', 'executeur', { row: 5, col: 4 });
      const bFrontSoldier = makePiece('b-front', 'black', 'soldat', { row: 4, col: 4 });
      const bRearColossus = makePiece('b-rear-col', 'black', 'colosse', { row: 3, col: 4 });
      const bDirectColossus = makePiece('b-dir-col', 'black', 'colosse', { row: 5, col: 5 }, {
        permanentlyRevealedTo: { red: true, black: false },
      });

      let state = makePlayingState(
        [redKing, blackKing, redExec, bFrontSoldier, bRearColossus, bDirectColossus],
        'red',
      );

      const moves = generateMoveCandidatesForPiece(redExec, state.pieces, CLEAR_VIS, false);
      // Direct capture onto known adjacent Colosse at (5,5) is NOT allowed
      expect(moves.some((m) => m.to.row === 5 && m.to.col === 5)).toBe(false);
      // Frappe traversante onto rear Colosse at (3,4) through front Soldier at (4,4) IS generated!
      const pierce = moves.find((m) => m.to.row === 3 && m.to.col === 4 && m.kind === 'piercing_strike');
      expect(pierce).toBeDefined();

      state = executePieceMove(state, 'red', 'r-exec', { row: 3, col: 4 }, 1000, Math.random, 'piercing_strike');
      // Clarification A1: Exécuteur remains at (5,4), intermediate (4,4) remains intact, rear Colosse at (3,4) is eliminated!
      expect(state.pieces.find((p) => p.id === 'r-exec')?.position).toEqual({ row: 5, col: 4 });
      expect(state.pieces.find((p) => p.id === 'b-front')?.alive).toBe(true);
      expect(state.pieces.find((p) => p.id === 'b-front')?.position).toEqual({ row: 4, col: 4 });
      expect(state.pieces.find((p) => p.id === 'b-rear-col')?.alive).toBe(false);
      expect(state.lastMove?.kind).toBe('piercing_strike');
      expect(state.lastMove?.from).toEqual({ row: 5, col: 4 });
      expect(state.lastMove?.to).toEqual({ row: 5, col: 4 });
      expect(state.lastMove?.passedThroughCoord).toEqual({ row: 4, col: 4 });
      expect(state.lastMove?.eliminatedCoords).toEqual([{ row: 3, col: 4 }]);
    });

    it('cannot pierce through an intermediate Colosse (interrupts unknown Colosse and temp reveals it) and wins immediately when piercing rear Roi', () => {
      const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 0 });
      const blackKing = makePiece('b-king', 'black', 'roi', { row: 3, col: 4 });
      const redExec = makePiece('r-exec', 'red', 'executeur', { row: 5, col: 4 });
      const bMidUnknownColossus = makePiece('b-mid-col', 'black', 'colosse', { row: 4, col: 4 });

      // Attempting Frappe traversante through an UNKNOWN intermediate Colosse interrupts and reveals it temporarily!
      let state = makePlayingState([redKing, blackKing, redExec, bMidUnknownColossus], 'red');
      state = executePieceMove(state, 'red', 'r-exec', { row: 3, col: 4 });
      expect(state.pieces.find((p) => p.id === 'b-king')?.alive).toBe(true);
      expect(state.pieces.find((p) => p.id === 'r-exec')?.position).toEqual({ row: 5, col: 4 });
      const redView = projectMatchStateForViewer(state, 'red');
      expect(redView.pieces.find((p) => p.id === 'b-mid-col')?.character).toBe('colosse');

      // Now replace intermediate Colosse with Soldat -> Exécuteur pierces through to kill rear Roi -> Victory!
      const bMidSoldier = makePiece('b-mid-sol', 'black', 'soldat', { row: 4, col: 4 });
      let winState = makePlayingState([redKing, blackKing, redExec, bMidSoldier], 'red');
      winState = executePieceMove(winState, 'red', 'r-exec', { row: 3, col: 4 });
      expect(winState.phase).toBe('finished');
      expect(winState.winner).toBe('red');
      expect(winState.outcomeReason).toBe('king_eliminated');
    });
  });

  describe('4. Arbalétrier (1 ortho move, Tir 1-3 8-dir, cadence 1 tir / 3 tours personnels, secret sur Colosse)', () => {
    it('fires ranged shot without moving, enforces strict 1-shot-per-3-own-turns cadence (T1 shot -> T2 & T3 locked -> T4 ready) even with Double Action, keeps unknown Colosse hidden on blocked shot, and disambiguates adjacent capture vs shot', () => {
      const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 0 });
      const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 8 });
      const redArb = makePiece('r-arb', 'red', 'arbaletrier', { row: 5, col: 4 });
      const bTargetDiag3 = makePiece('b-diag3', 'black', 'soldat', { row: 2, col: 1 }); // diagonal dist 3 from (5,4)
      const bUnknownCol = makePiece('b-ucol', 'black', 'colosse', { row: 5, col: 2 }); // ortho dist 2 left, UNREVEALED
      const bAdj = makePiece('b-adj', 'black', 'soldat', { row: 4, col: 4 }); // adjacent ortho!

      let state = makePlayingState(
        [redKing, blackKing, redArb, bTargetDiag3, bUnknownCol, bAdj],
        'red',
        {
          players: {
            ...createMatchState('arb-test', 'local').players,
            red: {
              ...createMatchState('arb-test', 'local').players.red,
              hand: ['double_action'],
            },
          },
        },
      );

      // Adjacent square (4,4) must offer BOTH capture_move and crossbow_shot!
      const candidates = generateMoveCandidatesForPiece(redArb, state.pieces, CLEAR_VIS, false);
      const adjKinds = candidates
        .filter((m) => m.to.row === 4 && m.to.col === 4)
        .map((m) => m.kind);
      expect(adjKinds).toContain('capture_move');
      expect(adjKinds).toContain('crossbow_shot');

      // Activate Double Action -> Turn 1 Action 1: Arbalétrier shoots unknown Colosse at (5,2)
      state = playCard(state, 'red', { card: 'double_action' });
      state = executePieceMove(state, 'red', 'r-arb', { row: 5, col: 2 });
      // Blocked shot sets cooldown = 3 before Turn 1 ends (drops to 2 when Turn 1 finishes), does NOT kill/reveal Colosse!
      expect(state.pieces.find((p) => p.id === 'b-ucol')?.alive).toBe(true);
      expect(state.pieces.find((p) => p.id === 'r-arb')?.position).toEqual({ row: 5, col: 4 });
      expect(state.pieces.find((p) => p.id === 'r-arb')?.arbaletrierCooldownTurnsRemaining).toBe(3);
      const redViewAfterColShot = projectMatchStateForViewer(state, 'red');
      expect(redViewAfterColShot.pieces.find((p) => p.id === 'b-ucol')?.character).toBeNull();
      expect(redViewAfterColShot.pieces.find((p) => p.id === 'b-ucol')?.revealKind).toBe('none');

      // Turn 1 Action 2 of Double Action: CANNOT bypass cooldown to shoot again!
      const action2Moves = generateMoveCandidatesForPiece(
        state.pieces.find((p) => p.id === 'r-arb')!,
        state.pieces,
        CLEAR_VIS,
        false,
      );
      expect(action2Moves.some((m) => m.kind === 'crossbow_shot')).toBe(false);
      // Red King completes Action 2 -> Turn 1 ends, cooldown decrements from 3 to 2!
      state = executePieceMove(state, 'red', 'r-king', { row: 8, col: 1 });
      expect(state.pieces.find((p) => p.id === 'r-arb')?.arbaletrierCooldownTurnsRemaining).toBe(2);

      // Black Turn 1 does NOT advance Red's Arbalétrier cooldown!
      state = executePieceMove(state, 'black', 'b-king', { row: 0, col: 7 });
      expect(state.pieces.find((p) => p.id === 'r-arb')?.arbaletrierCooldownTurnsRemaining).toBe(2);

      // Red Turn 2: Indisponible (remaining === 2) -> move Red King -> drops to 1
      const arbTurn2 = state.pieces.find((p) => p.id === 'r-arb')!;
      expect(arbTurn2.arbaletrierCooldownTurnsRemaining).toBe(2);
      expect(
        generateMoveCandidatesForPiece(arbTurn2, state.pieces, CLEAR_VIS, false).some(
          (m) => m.kind === 'crossbow_shot',
        ),
      ).toBe(false);
      state = executePieceMove(state, 'red', 'r-king', { row: 8, col: 0 });
      expect(state.pieces.find((p) => p.id === 'r-arb')?.arbaletrierCooldownTurnsRemaining).toBe(1);
      state = executePieceMove(state, 'black', 'b-king', { row: 0, col: 8 });

      // Red Turn 3: STILL Indisponible (remaining === 1) -> move Red King -> drops to 0
      const arbTurn3 = state.pieces.find((p) => p.id === 'r-arb')!;
      expect(arbTurn3.arbaletrierCooldownTurnsRemaining).toBe(1);
      expect(
        generateMoveCandidatesForPiece(arbTurn3, state.pieces, CLEAR_VIS, false).some(
          (m) => m.kind === 'crossbow_shot',
        ),
      ).toBe(false);
      state = executePieceMove(state, 'red', 'r-king', { row: 8, col: 1 });
      expect(state.pieces.find((p) => p.id === 'r-arb')?.arbaletrierCooldownTurnsRemaining).toBe(0);
      state = executePieceMove(state, 'black', 'b-king', { row: 0, col: 7 });

      // Red Turn 4: Disponible (remaining === 0) -> shoots diagonally to (2,1) and resets cooldown for next 3-turn cycle!
      const arbTurn4 = state.pieces.find((p) => p.id === 'r-arb')!;
      expect(arbTurn4.arbaletrierCooldownTurnsRemaining).toBe(0);
      state = executePieceMove(state, 'red', 'r-arb', { row: 2, col: 1 }, 2000, Math.random, 'crossbow_shot');
      expect(state.pieces.find((p) => p.id === 'b-diag3')?.alive).toBe(false);
      expect(state.pieces.find((p) => p.id === 'r-arb')?.position).toEqual({ row: 5, col: 4 });
      expect(state.lastMove?.kind).toBe('crossbow_shot');
      expect(state.pieces.find((p) => p.id === 'r-arb')?.arbaletrierCooldownTurnsRemaining).toBe(2);
    });
  });

  describe('5. Colosse & Règle des 2 effets Kamikaze + Sécurité, Migration Legacy & Cohérence', () => {
    let tempDbPath: string;
    let db: BlindWarDatabase;
    let auth: AuthService;
    let rooms: GameRoomManager;

    beforeEach(() => {
      tempDbPath = path.join(os.tmpdir(), `bw-v2-${Date.now()}-${Math.random()}.json`);
      db = new BlindWarDatabase({ diskFilePath: tempDbPath });
      auth = new AuthService(db);
      rooms = new GameRoomManager(db);
    });

    afterEach(() => {
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }
    });

    it('only counts Kamikazes triggered by the Colossus itself (1/2 survives, 2/2 dies) and persists across legacy migration & online security', async () => {
      expect(COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD).toBe(2);

      const redKing = makePiece('r-king', 'red', 'roi', { row: 8, col: 0 });
      const blackKing = makePiece('b-king', 'black', 'roi', { row: 0, col: 8 });
      const redCol = makePiece('r-col', 'red', 'colosse', { row: 5, col: 4 });
      const redSol = makePiece('r-sol', 'red', 'soldat', { row: 5, col: 1 });
      const bKamiOther = makePiece('b-ko', 'black', 'soldat', { row: 4, col: 0 }, { hasKamikaze: true });
      const bKamiCol1 = makePiece('b-kc1', 'black', 'soldat', { row: 4, col: 4 }, { hasKamikaze: true });
      const bKamiCol2 = makePiece('b-kc2', 'black', 'soldat', { row: 3, col: 4 }, { hasKamikaze: true });

      let state = makePlayingState(
        [redKing, blackKing, redCol, redSol, bKamiOther, bKamiCol1, bKamiCol2],
        'red',
      );

      // 1. Red Soldier triggers a Kamikaze diagonally -> does NOT advance Colossus's counter!
      state = executePieceMove(state, 'red', 'r-sol', { row: 4, col: 0 });
      expect(state.pieces.find((p) => p.id === 'r-col')?.kamikazeHitsTaken).toBe(0);

      state = executePieceMove(state, 'black', 'b-king', { row: 0, col: 7 });

      // 2. Red Colossus triggers 1st Kamikaze -> survives with 1/2!
      state = executePieceMove(state, 'red', 'r-col', { row: 4, col: 4 });
      expect(state.pieces.find((p) => p.id === 'r-col')?.alive).toBe(true);
      expect(state.pieces.find((p) => p.id === 'r-col')?.kamikazeHitsTaken).toBe(1);

      // Legacy match migration keeps kamikazeHitsTaken & defaults stats cleanly to 0 without crashing
      const strippedLegacy = {
        ...state,
        players: {
          red: { ...state.players.red, newMechanicsStats: undefined as any },
          black: { ...state.players.black, newMechanicsStats: undefined as any },
        },
      };
      const migrated = migrateLegacyMatchState(strippedLegacy);
      expect(migrated.players.red.newMechanicsStats).toEqual(createZeroNewMechanicsStats());
      expect(migrated.pieces.find((p) => p.id === 'r-col')?.kamikazeHitsTaken).toBe(1);

      state = executePieceMove(migrated, 'black', 'b-king', { row: 0, col: 8 });

      // 3. Red Colossus triggers 2nd Kamikaze -> eliminated (2/2)!
      state = executePieceMove(state, 'red', 'r-col', { row: 3, col: 4 });
      expect(state.pieces.find((p) => p.id === 'r-col')?.alive).toBe(false);
      expect(state.players.black.newMechanicsStats?.colossiEliminatedByKamikaze).toBe(1);

      // Online DB/Room security + legacy user profile migration defaults to 0
      const u1 = await auth.register('TraqueurPro', 'Pass12345!');
      const u2 = await auth.register('ArbaletrierPro', 'Pass12345!');
      expect(u1.profile.newMechanicsStats).toEqual(createZeroNewMechanicsStats());

      const room = rooms.createCustomRoom({
        userId: u1.profile.id,
        username: u1.profile.username,
        eloRating: 200,
        socketId: 's1',
      });
      rooms.joinCustomRoomByCode(room.roomCode, {
        userId: u2.profile.id,
        username: u2.profile.username,
        eloRating: 200,
        socketId: 's2',
      });
      rooms.startMatchInRoom(room.roomId, 10_000);
      await rooms.applyPlacement(room.roomId, u1.profile.id, autoCompletePlacement('red', [], () => 0.1));
      await rooms.applyPlacement(room.roomId, u2.profile.id, autoCompletePlacement('black', [], () => 0.9));

      const viewForRed = rooms.getProjectedViewForUser(room, u1.profile.id)!;
      const redOwnTraqueur = viewForRed.pieces.find(
        (p) => p.owner === 'red' && p.character === 'traqueur',
      )!;
      const blackHiddenEnemy = viewForRed.pieces.find((p) => p.owner === 'black')!;
      // Attempting to mark a hidden enemy through RoomManager must be rejected!
      await expect(
        rooms.applyTraqueurMark(room.roomId, u1.profile.id, redOwnTraqueur.id, blackHiddenEnemy.id),
      ).rejects.toThrow();
    });

    it('enforces automated documentation, encyclopedia & tutorial consistency (§19.4)', () => {
      // Composition sums & dossier initial quantities match exactly 27
      const dossierSum = CHARACTER_TYPES.reduce(
        (acc, ch) => acc + CHARACTER_DOSSIERS[ch].initialQuantity,
        0,
      );
      expect(dossierSum).toBe(27);
      for (const ch of CHARACTER_TYPES) {
        expect(CHARACTER_DOSSIERS[ch].initialQuantity).toBe(ARMY_COMPOSITION[ch]);
        expect(CHARACTER_CATALOG[ch].initialCount).toBe(ARMY_COMPOSITION[ch]);
      }

      // All 10 official progressive tutorial themes covered across restructured lessons
      const coveredThemes = new Set(TUTORIAL_SCENARIOS.map((t) => t.themeNumber));
      for (let t = 1; t <= 10; t += 1) {
        expect(coveredThemes.has(t as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10)).toBe(true);
      }
      expect(TUTORIAL_SCENARIOS.length).toBeGreaterThanOrEqual(10);
      expect(MECHANIC_DOSSIERS.length).toBeGreaterThanOrEqual(6);

      // Zero stale phrasing across ALL dossiers, cards, rules, mechanics, and tutorials!
      const stalePattern = /3 effets kamikaze|3 kamikaze|3\/3|4 guetteurs|2 berserkers|9 personnages|9 rôles|1 tir tous les 2 tours|1 tir \/ 2 tours|tous les 2 tours personnels|0 élimination.*2 actions/i;
      const allTextBlobs: string[] = [
        ...CHARACTER_TYPES.flatMap((ch) => {
          const d = CHARACTER_DOSSIERS[ch];
          return [
            d.name,
            d.roleSummary,
            d.maxBoardCapLabel,
            d.movementSummary,
            d.attackSummary,
            d.specialAbility,
            ...d.interactionsSummary,
            ...d.restrictions,
          ];
        }),
        ...Object.values(CARD_DOSSIERS).flatMap((c) => [
          c.name,
          c.durationLabel,
          c.visibilityLabel,
          c.effectDescription,
          ...c.restrictions,
        ]),
        ...RULE_SECTIONS.flatMap((r) => [r.title, r.summary, ...r.bullets]),
        ...MECHANIC_DOSSIERS.flatMap((m) => [m.title, m.summary, ...m.rules, ...m.edgeCases]),
        ...TUTORIAL_SCENARIOS.flatMap((t) => [
          t.title,
          t.subtitle,
          t.objectiveDescription,
          ...t.coachingTips,
        ]),
      ];

      for (const text of allTextBlobs) {
        expect(text).not.toMatch(stalePattern);
      }

      // Nerf du Traqueur : portée de base 2 H/V, portée 3 avec Marquage/Poursuite (jamais 1-3 de base ni 4 cases)
      expect(CHARACTER_CATALOG.traqueur.maxRange).toBe(2);
      const traqDossier = CHARACTER_DOSSIERS.traqueur;
      const traqMechanic = MECHANIC_DOSSIERS.find((m) => m.id === 'marquage-poursuite')!;
      const traqTutorial = PIECE_TUTORIALS.traqueur;
      const traqRuleTutorial = SPECIAL_RULE_TUTORIALS.find((r) => r.id === 'rule-traqueur-marquage')!;
      const traqScenario = TUTORIAL_SCENARIOS.find((t) => t.id === 'traqueur-marquage-poursuite')!;

      const traqueurTexts = [
        CHARACTER_CATALOG.traqueur.roleSummary,
        traqDossier.roleSummary,
        traqDossier.movementSummary,
        traqDossier.attackSummary,
        traqDossier.specialAbility,
        ...traqDossier.interactionsSummary,
        ...traqDossier.restrictions,
        traqMechanic.summary,
        ...traqMechanic.rules,
        ...traqMechanic.edgeCases,
        traqTutorial.role,
        traqTutorial.objective,
        traqTutorial.movements,
        traqTutorial.attacks,
        traqTutorial.specialAbilities,
        ...traqTutorial.restrictions,
        ...traqTutorial.specialConditions,
        ...traqTutorial.concreteExamples,
        ...traqTutorial.mistakesToAvoid,
        ...traqTutorial.demoSteps.flatMap((s) => [s.stepTitle, s.explanation]),
        traqRuleTutorial.title,
        traqRuleTutorial.summary,
        ...traqRuleTutorial.howItWorksSteps,
        traqRuleTutorial.whenToUse,
        ...traqRuleTutorial.conditions,
        ...traqRuleTutorial.limits,
        ...traqRuleTutorial.examples,
        ...traqRuleTutorial.consequences,
        traqScenario.title,
        traqScenario.subtitle,
        traqScenario.objectiveDescription,
        ...traqScenario.coachingTips,
      ];
      for (const text of traqueurTexts) {
        expect(text).not.toMatch(/4\s*cases|1[–-]3\s*cases/i);
      }
      expect(traqDossier.movementSummary).toMatch(/2\s*cases/i);
      expect(traqDossier.specialAbility).toMatch(/3\s*cases/i);
      expect(traqTutorial.specialAbilities).toMatch(/3\s*cases/i);
    });
  });
});
