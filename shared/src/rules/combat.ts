import type {
  Coord,
  PlayerColor,
  ServerGraveyardRecord,
  ServerPieceRecord,
} from '../types/core.js';
import { CHARACTER_CATALOG } from '../constants/army.js';
import {
  BOARD_ROWS,
  getOpponentColor,
} from '../constants/board.js';
import {
  COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD,
} from '../constants/cards.js';
import {
  type VisibilityContext,
  createGraveyardRecordOnElimination,
} from './visibility.js';

/**
 * 1 full turn (opponent's turn + back to caster/owner's turn) corresponds to 2 half-turn ticks.
 */
export const ONE_FULL_TURN_TICKS = 2;

export interface CombatResolutionResult {
  readonly updatedAttacker: ServerPieceRecord;
  readonly updatedDefender: ServerPieceRecord;
  readonly defenderEliminated: boolean;
  readonly attackerEliminatedByKamikaze: boolean;
  readonly attackBlockedByColossusImmunity: boolean;
  readonly attackBlockedByProtection: boolean;
  readonly attackBlockedByInvincibility?: boolean;
  readonly colossusTemporarilyRevealed: boolean;
  readonly kingEliminatedColor: PlayerColor | null;
  readonly graveyardEntriesCreated: readonly ServerGraveyardRecord[];
}

/**
 * Check and apply Colossus direction reversal when reaching the edge of its current progression (§6.6, Q2, Q3).
 * - If moving toward row 0 (`progressionDirection === -1`) and lands on row 0 -> flips to `+1`.
 * - If moving toward row 8 (`progressionDirection === +1`) and lands on row 8 -> flips to `-1`.
 * - Works repeatedly if the Colossus traverses back to its starting edge (validated Q2).
 * - Reveals the Colossus temporarily for 1 full turn (`ONE_FULL_TURN_TICKS`) to the opponent (validated Q3).
 */
export function applyColossusEdgeReversalIfNeeded(
  piece: ServerPieceRecord,
): { readonly updatedPiece: ServerPieceRecord; readonly reversedAndRevealed: boolean } {
  if (!piece.alive || piece.position === null || piece.character !== 'colosse') {
    return { updatedPiece: piece, reversedAndRevealed: false };
  }

  const targetRow = piece.progressionDirection === -1 ? 0 : BOARD_ROWS - 1;
  if (piece.position.row !== targetRow) {
    return { updatedPiece: piece, reversedAndRevealed: false };
  }

  const opponent = getOpponentColor(piece.owner);
  const nextDirection: -1 | 1 = piece.progressionDirection === -1 ? 1 : -1;

  return {
    updatedPiece: {
      ...piece,
      progressionDirection: nextDirection,
      reversalCount: piece.reversalCount + 1,
      tempRevealedTicksTo: {
        ...piece.tempRevealedTicksTo,
        [opponent]: Math.max(piece.tempRevealedTicksTo[opponent], ONE_FULL_TURN_TICKS),
      },
    },
    reversedAndRevealed: true,
  };
}

/**
 * Resolve a direct capture attempt by `attacker` onto `defender`'s square (§7, §8.1, §8.11, §21.12–15, Q6–Q11).
 */
export function resolveDirectCapture(
  attacker: ServerPieceRecord,
  defender: ServerPieceRecord,
  attackerOwnerVisibility: VisibilityContext,
  defenderOwnerVisibility: VisibilityContext,
): CombatResolutionResult {
  if (!attacker.alive || attacker.position === null) {
    throw new Error(`L'attaquant ${attacker.id} n'est pas en vie sur le plateau.`);
  }
  if (!defender.alive || defender.position === null) {
    throw new Error(`Le défenseur ${defender.id} n'est pas en vie sur le plateau.`);
  }
  if (attacker.owner === defender.owner) {
    throw new Error(`Impossible d'attaquer une pièce alliée.`);
  }

  // 0. Defender is secretly under Invincibilité (§7, §8.2) -> attack fails, attacker stays on starting square
  if (defender.invincibleTicksRemaining > 0) {
    return {
      updatedAttacker: attacker,
      updatedDefender: defender,
      defenderEliminated: false,
      attackerEliminatedByKamikaze: false,
      attackBlockedByColossusImmunity: false,
      attackBlockedByProtection: false,
      attackBlockedByInvincibility: true,
      colossusTemporarilyRevealed: false,
      kingEliminatedColor: null,
      graveyardEntriesCreated: [],
    };
  }

  const dest: Coord = defender.position;

  // 1. Unauthorized attack against an enemy Colossus (Q6)
  if (
    defender.character === 'colosse' &&
    !CHARACTER_CATALOG[attacker.character].canKillColossus
  ) {
    const revealedDefender: ServerPieceRecord = {
      ...defender,
      tempRevealedTicksTo: {
        ...defender.tempRevealedTicksTo,
        [attacker.owner]: Math.max(
          defender.tempRevealedTicksTo[attacker.owner],
          ONE_FULL_TURN_TICKS,
        ),
      },
    };

    return {
      updatedAttacker: attacker, // stays on its starting square
      updatedDefender: revealedDefender,
      defenderEliminated: false,
      attackerEliminatedByKamikaze: false,
      attackBlockedByColossusImmunity: true,
      attackBlockedByProtection: false,
      colossusTemporarilyRevealed: true,
      kingEliminatedColor: null,
      graveyardEntriesCreated: [],
    };
  }

  // 2. Defender has Protection shield (§8.11, §21.15, Q11)
  if (defender.hasProtection) {
    const unshieldedDefender: ServerPieceRecord = {
      ...defender,
      hasProtection: false,
    };

    return {
      updatedAttacker: attacker, // stays on its starting square
      updatedDefender: unshieldedDefender,
      defenderEliminated: false,
      attackerEliminatedByKamikaze: false,
      attackBlockedByColossusImmunity: false,
      attackBlockedByProtection: true,
      colossusTemporarilyRevealed: false,
      kingEliminatedColor: null,
      graveyardEntriesCreated: [],
    };
  }

  // 3. Defender is eliminated; evaluate Kamikaze on Defender (§7, §8.1, §21.13, Q7, Q10)
  let nextAttacker: ServerPieceRecord = {
    ...attacker,
    position: dest,
  };
  let attackerEliminatedByKamikaze = false;

  if (defender.hasKamikaze) {
    if (nextAttacker.character === 'colosse') {
      const nextHits = nextAttacker.kamikazeHitsTaken + 1;
      if (nextHits >= COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD) {
        attackerEliminatedByKamikaze = true;
        nextAttacker = {
          ...nextAttacker,
          kamikazeHitsTaken: nextHits,
          alive: false,
          position: null,
        };
      } else {
        nextAttacker = {
          ...nextAttacker,
          kamikazeHitsTaken: nextHits,
        };
      }
    } else if (nextAttacker.hasProtection) {
      // Q10: Protection absorbs the Kamikaze explosion and breaks
      nextAttacker = {
        ...nextAttacker,
        hasProtection: false,
      };
    } else {
      attackerEliminatedByKamikaze = true;
      nextAttacker = {
        ...nextAttacker,
        alive: false,
        position: null,
      };
    }
  }

  // Assassin permanent revelation triggers ONLY if Assassin was not killed by Kamikaze (§7, §21.13)
  const assassinPermanentReveal =
    attacker.character === 'assassin' && !attackerEliminatedByKamikaze;

  const eliminatedDefender: ServerPieceRecord = {
    ...defender,
    alive: false,
    position: null,
    permanentlyRevealedTo: assassinPermanentReveal
      ? {
          ...defender.permanentlyRevealedTo,
          [attacker.owner]: true,
        }
      : defender.permanentlyRevealedTo,
  };

  const graveyardEntries: ServerGraveyardRecord[] = [];
  graveyardEntries.push(
    createGraveyardRecordOnElimination(
      defender,
      attacker,
      attackerEliminatedByKamikaze,
      attacker.owner,
      attackerOwnerVisibility,
      false,
    ),
  );

  if (attackerEliminatedByKamikaze) {
    graveyardEntries.push(
      createGraveyardRecordOnElimination(
        attacker,
        defender,
        false,
        defender.owner,
        defenderOwnerVisibility,
        false,
      ),
    );
  } else {
    const colossusCheck = applyColossusEdgeReversalIfNeeded(nextAttacker);
    nextAttacker = colossusCheck.updatedPiece;
  }

  const kingEliminatedColor: PlayerColor | null =
    eliminatedDefender.character === 'roi'
      ? eliminatedDefender.owner
      : attackerEliminatedByKamikaze && nextAttacker.character === 'roi'
        ? nextAttacker.owner
        : null;

  return {
    updatedAttacker: nextAttacker,
    updatedDefender: eliminatedDefender,
    defenderEliminated: true,
    attackerEliminatedByKamikaze,
    attackBlockedByColossusImmunity: false,
    attackBlockedByProtection: false,
    colossusTemporarilyRevealed: false,
    kingEliminatedColor,
    graveyardEntriesCreated: graveyardEntries,
  };
}

export interface CavalierJumpResolutionResult {
  readonly updatedCavalier: ServerPieceRecord;
  readonly updatedJumpedPiece: ServerPieceRecord;
  readonly jumpedPieceEliminated: boolean;
  readonly cavalierEliminatedByKamikaze: boolean;
  readonly jumpInterrupted: boolean;
  readonly interruptedByColossus: boolean;
  readonly interruptedByProtection: boolean;
  readonly interruptedByInvincibility?: boolean;
  readonly kingEliminatedColor: PlayerColor | null;
  readonly graveyardEntriesCreated: readonly ServerGraveyardRecord[];
}

/**
 * Resolve a single Cavalier jump over `jumpedPiece` onto `landingCoord` (§6.5, §21.4–6, Q9, Q10).
 */
export function resolveCavalierSingleJump(
  cavalier: ServerPieceRecord,
  jumpedPiece: ServerPieceRecord,
  landingCoord: Coord,
  cavalierOwnerVisibility: VisibilityContext,
  jumpedOwnerVisibility: VisibilityContext,
): CavalierJumpResolutionResult {
  if (cavalier.character !== 'cavalier' || !cavalier.alive || cavalier.position === null) {
    throw new Error(`Seul un Cavalier vivant peut effectuer un saut.`);
  }
  if (!jumpedPiece.alive || jumpedPiece.position === null) {
    throw new Error(`La pièce sautée n'est pas sur le plateau.`);
  }
  if (jumpedPiece.owner === cavalier.owner) {
    throw new Error(`Le Cavalier ne peut pas sauter par-dessus ses propres pièces (§6.5).`);
  }

  // 0. Jumped piece is secretly under Invincibilité (§6.5, §8.2) -> jump is interrupted
  if (jumpedPiece.invincibleTicksRemaining > 0) {
    return {
      updatedCavalier: cavalier,
      updatedJumpedPiece: jumpedPiece,
      jumpedPieceEliminated: false,
      cavalierEliminatedByKamikaze: false,
      jumpInterrupted: true,
      interruptedByColossus: false,
      interruptedByProtection: false,
      interruptedByInvincibility: true,
      kingEliminatedColor: null,
      graveyardEntriesCreated: [],
    };
  }

  // 1. Jumped piece is a Colossus (§6.5, §21.4, §21.6, Q3)
  if (jumpedPiece.character === 'colosse') {
    const revealedColossus: ServerPieceRecord = {
      ...jumpedPiece,
      tempRevealedTicksTo: {
        ...jumpedPiece.tempRevealedTicksTo,
        [cavalier.owner]: Math.max(
          jumpedPiece.tempRevealedTicksTo[cavalier.owner],
          ONE_FULL_TURN_TICKS,
        ),
      },
    };

    return {
      updatedCavalier: cavalier, // stays on its current square before the jump
      updatedJumpedPiece: revealedColossus,
      jumpedPieceEliminated: false,
      cavalierEliminatedByKamikaze: false,
      jumpInterrupted: true,
      interruptedByColossus: true,
      interruptedByProtection: false,
      kingEliminatedColor: null,
      graveyardEntriesCreated: [],
    };
  }

  // 2. Jumped piece has Protection (Q9)
  if (jumpedPiece.hasProtection) {
    const unshielded: ServerPieceRecord = {
      ...jumpedPiece,
      hasProtection: false,
    };

    return {
      updatedCavalier: cavalier,
      updatedJumpedPiece: unshielded,
      jumpedPieceEliminated: false,
      cavalierEliminatedByKamikaze: false,
      jumpInterrupted: true,
      interruptedByColossus: false,
      interruptedByProtection: true,
      kingEliminatedColor: null,
      graveyardEntriesCreated: [],
    };
  }

  // 3. Normal enemy piece jumped and eliminated
  let nextCavalier: ServerPieceRecord = {
    ...cavalier,
    position: landingCoord,
  };
  let cavalierEliminatedByKamikaze = false;

  if (jumpedPiece.hasKamikaze) {
    if (nextCavalier.hasProtection) {
      nextCavalier = {
        ...nextCavalier,
        hasProtection: false,
      };
    } else {
      cavalierEliminatedByKamikaze = true;
      nextCavalier = {
        ...nextCavalier,
        alive: false,
        position: null,
      };
    }
  }

  const eliminatedJumped: ServerPieceRecord = {
    ...jumpedPiece,
    alive: false,
    position: null,
  };

  const graveyardEntries: ServerGraveyardRecord[] = [];
  graveyardEntries.push(
    createGraveyardRecordOnElimination(
      jumpedPiece,
      cavalier,
      cavalierEliminatedByKamikaze,
      cavalier.owner,
      cavalierOwnerVisibility,
      false,
    ),
  );

  if (cavalierEliminatedByKamikaze) {
    graveyardEntries.push(
      createGraveyardRecordOnElimination(
        cavalier,
        jumpedPiece,
        false,
        jumpedPiece.owner,
        jumpedOwnerVisibility,
        false,
      ),
    );
  }

  const kingEliminatedColor: PlayerColor | null =
    eliminatedJumped.character === 'roi' ? eliminatedJumped.owner : null;

  return {
    updatedCavalier: nextCavalier,
    updatedJumpedPiece: eliminatedJumped,
    jumpedPieceEliminated: true,
    cavalierEliminatedByKamikaze,
    jumpInterrupted: cavalierEliminatedByKamikaze,
    interruptedByColossus: false,
    interruptedByProtection: false,
    kingEliminatedColor,
    graveyardEntriesCreated: graveyardEntries,
  };
}

export interface PiercingStrikeResolutionResult {
  readonly updatedAttacker: ServerPieceRecord;
  readonly updatedIntermediate: ServerPieceRecord;
  readonly updatedTarget: ServerPieceRecord;
  readonly targetEliminated: boolean;
  readonly attackerEliminatedByKamikaze: boolean;
  readonly intermediateColossusInterrupted: boolean;
  readonly attackBlockedByProtection: boolean;
  readonly attackBlockedByInvincibility: boolean;
  readonly colossusEliminatedByPiercing: boolean;
  readonly kingEliminatedColor: PlayerColor | null;
  readonly graveyardEntriesCreated: readonly ServerGraveyardRecord[];
}

/**
 * Resolve an Exécuteur's Frappe traversante (§4.3–4.6 & clarification A1):
 * - Exécuteur stays on its starting square (`position` unchanged).
 * - `intermediate` stays intact unless it is a Colossus (which interrupts the strike & reveals temporarily).
 * - Can eliminate `colosse` as the rear target (official exception §4.6).
 * - Respects Invincibilité, Protection, and Kamikaze.
 */
export function resolvePiercingStrike(
  executeur: ServerPieceRecord,
  intermediate: ServerPieceRecord,
  target: ServerPieceRecord,
  attackerOwnerVisibility: VisibilityContext,
  defenderOwnerVisibility: VisibilityContext,
): PiercingStrikeResolutionResult {
  if (executeur.character !== 'executeur' || !executeur.alive || executeur.position === null) {
    throw new Error(`Seul un Exécuteur vivant peut utiliser Frappe traversante.`);
  }
  if (!intermediate.alive || intermediate.position === null || intermediate.owner === executeur.owner) {
    throw new Error(`La pièce intermédiaire doit être une pièce ennemie vivante.`);
  }
  if (!target.alive || target.position === null || target.owner === executeur.owner) {
    throw new Error(`La cible de Frappe traversante doit être une pièce ennemie vivante.`);
  }

  // 0. Le Colosse ne peut jamais servir de pièce intermédiaire (§4.4 rule 7)
  if (intermediate.character === 'colosse') {
    const revealedColossus: ServerPieceRecord = {
      ...intermediate,
      tempRevealedTicksTo: {
        ...intermediate.tempRevealedTicksTo,
        [executeur.owner]: Math.max(
          intermediate.tempRevealedTicksTo[executeur.owner],
          ONE_FULL_TURN_TICKS,
        ),
      },
    };
    return {
      updatedAttacker: executeur,
      updatedIntermediate: revealedColossus,
      updatedTarget: target,
      targetEliminated: false,
      attackerEliminatedByKamikaze: false,
      intermediateColossusInterrupted: true,
      attackBlockedByProtection: false,
      attackBlockedByInvincibility: false,
      colossusEliminatedByPiercing: false,
      kingEliminatedColor: null,
      graveyardEntriesCreated: [],
    };
  }

  // 1. Cible sous Invincibilité
  if (target.invincibleTicksRemaining > 0) {
    return {
      updatedAttacker: executeur,
      updatedIntermediate: intermediate,
      updatedTarget: target,
      targetEliminated: false,
      attackerEliminatedByKamikaze: false,
      intermediateColossusInterrupted: false,
      attackBlockedByProtection: false,
      attackBlockedByInvincibility: true,
      colossusEliminatedByPiercing: false,
      kingEliminatedColor: null,
      graveyardEntriesCreated: [],
    };
  }

  // 2. Cible sous Protection
  if (target.hasProtection) {
    return {
      updatedAttacker: executeur,
      updatedIntermediate: intermediate,
      updatedTarget: { ...target, hasProtection: false },
      targetEliminated: false,
      attackerEliminatedByKamikaze: false,
      intermediateColossusInterrupted: false,
      attackBlockedByProtection: true,
      attackBlockedByInvincibility: false,
      colossusEliminatedByPiercing: false,
      kingEliminatedColor: null,
      graveyardEntriesCreated: [],
    };
  }

  // 3. Cible éliminée (y compris le Colosse !) ; l'Exécuteur reste sur sa case de départ (A1)
  let nextExecuteur: ServerPieceRecord = executeur;
  let attackerEliminatedByKamikaze = false;

  if (target.hasKamikaze) {
    if (nextExecuteur.hasProtection) {
      nextExecuteur = { ...nextExecuteur, hasProtection: false };
    } else {
      attackerEliminatedByKamikaze = true;
      nextExecuteur = { ...nextExecuteur, alive: false, position: null };
    }
  }

  const eliminatedTarget: ServerPieceRecord = {
    ...target,
    alive: false,
    position: null,
  };

  const graveyardEntries: ServerGraveyardRecord[] = [
    createGraveyardRecordOnElimination(
      target,
      executeur,
      attackerEliminatedByKamikaze,
      executeur.owner,
      attackerOwnerVisibility,
      false,
    ),
  ];

  if (attackerEliminatedByKamikaze) {
    graveyardEntries.push(
      createGraveyardRecordOnElimination(
        executeur,
        target,
        false,
        target.owner,
        defenderOwnerVisibility,
        false,
      ),
    );
  }

  const kingEliminatedColor: PlayerColor | null =
    eliminatedTarget.character === 'roi' ? eliminatedTarget.owner : null;

  return {
    updatedAttacker: nextExecuteur,
    updatedIntermediate: intermediate,
    updatedTarget: eliminatedTarget,
    targetEliminated: true,
    attackerEliminatedByKamikaze,
    intermediateColossusInterrupted: false,
    attackBlockedByProtection: false,
    attackBlockedByInvincibility: false,
    colossusEliminatedByPiercing: eliminatedTarget.character === 'colosse',
    kingEliminatedColor,
    graveyardEntriesCreated: graveyardEntries,
  };
}

export interface CrossbowShotResolutionResult {
  readonly updatedAttacker: ServerPieceRecord;
  readonly updatedTarget: ServerPieceRecord;
  readonly targetEliminated: boolean;
  readonly attackerEliminatedByKamikaze: boolean;
  readonly shotBlockedByColossusImmunity: boolean;
  readonly shotBlockedByProtection: boolean;
  readonly shotBlockedByInvincibility: boolean;
  readonly kingEliminatedColor: PlayerColor | null;
  readonly graveyardEntriesCreated: readonly ServerGraveyardRecord[];
}

/**
 * Resolve an Arbalétrier's ranged shot (§5.3, §5.5, §5.6, §18):
 * - Arbalétrier does NOT move from its square.
 * - Cannot eliminate Colosse (shot blocked without automatically revealing unknown identity!).
 * - Respects Invincibilité, Protection, and Kamikaze.
 */
export function resolveCrossbowShot(
  arbaletrier: ServerPieceRecord,
  target: ServerPieceRecord,
  attackerOwnerVisibility: VisibilityContext,
  defenderOwnerVisibility: VisibilityContext,
): CrossbowShotResolutionResult {
  if (arbaletrier.character !== 'arbaletrier' || !arbaletrier.alive || arbaletrier.position === null) {
    throw new Error(`Seul un Arbalétrier vivant peut tirer.`);
  }
  if (!target.alive || target.position === null || target.owner === arbaletrier.owner) {
    throw new Error(`La cible du tir doit être une pièce ennemie vivante.`);
  }

  // 1. Invincibilité
  if (target.invincibleTicksRemaining > 0) {
    return {
      updatedAttacker: arbaletrier,
      updatedTarget: target,
      targetEliminated: false,
      attackerEliminatedByKamikaze: false,
      shotBlockedByColossusImmunity: false,
      shotBlockedByProtection: false,
      shotBlockedByInvincibility: true,
      kingEliminatedColor: null,
      graveyardEntriesCreated: [],
    };
  }

  // 2. Immunité du Colosse : tir bloqué sans révéler automatiquement l'identité (§5.5, §5.6, §18)
  if (target.character === 'colosse') {
    return {
      updatedAttacker: arbaletrier,
      updatedTarget: target,
      targetEliminated: false,
      attackerEliminatedByKamikaze: false,
      shotBlockedByColossusImmunity: true,
      shotBlockedByProtection: false,
      shotBlockedByInvincibility: false,
      kingEliminatedColor: null,
      graveyardEntriesCreated: [],
    };
  }

  // 3. Protection
  if (target.hasProtection) {
    return {
      updatedAttacker: arbaletrier,
      updatedTarget: { ...target, hasProtection: false },
      targetEliminated: false,
      attackerEliminatedByKamikaze: false,
      shotBlockedByColossusImmunity: false,
      shotBlockedByProtection: true,
      shotBlockedByInvincibility: false,
      kingEliminatedColor: null,
      graveyardEntriesCreated: [],
    };
  }

  // 4. Élimination à distance (sans déplacer l'Arbalétrier et sans révéler une cible inconnue)
  let nextArbaletrier: ServerPieceRecord = arbaletrier;
  let attackerEliminatedByKamikaze = false;

  if (target.hasKamikaze) {
    if (nextArbaletrier.hasProtection) {
      nextArbaletrier = { ...nextArbaletrier, hasProtection: false };
    } else {
      attackerEliminatedByKamikaze = true;
      nextArbaletrier = { ...nextArbaletrier, alive: false, position: null };
    }
  }

  const eliminatedTarget: ServerPieceRecord = {
    ...target,
    alive: false,
    position: null,
  };

  const graveyardEntries: ServerGraveyardRecord[] = [
    createGraveyardRecordOnElimination(
      target,
      arbaletrier,
      attackerEliminatedByKamikaze,
      arbaletrier.owner,
      attackerOwnerVisibility,
      false,
    ),
  ];

  if (attackerEliminatedByKamikaze) {
    graveyardEntries.push(
      createGraveyardRecordOnElimination(
        arbaletrier,
        target,
        false,
        target.owner,
        defenderOwnerVisibility,
        false,
      ),
    );
  }

  const kingEliminatedColor: PlayerColor | null =
    eliminatedTarget.character === 'roi' ? eliminatedTarget.owner : null;

  return {
    updatedAttacker: nextArbaletrier,
    updatedTarget: eliminatedTarget,
    targetEliminated: true,
    attackerEliminatedByKamikaze,
    shotBlockedByColossusImmunity: false,
    shotBlockedByProtection: false,
    shotBlockedByInvincibility: false,
    kingEliminatedColor,
    graveyardEntriesCreated: graveyardEntries,
  };
}
