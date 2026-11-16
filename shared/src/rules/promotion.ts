import type {
  CharacterType,
  PlayerColor,
  ServerPieceRecord,
} from '../types/core.js';
import {
  CHARACTER_TYPES,
  canAddCharacterInstance,
  countCharacters,
} from '../constants/army.js';
import {
  getInitialForwardDelta,
  getOppositeEdgeRow,
} from '../constants/board.js';

/** Check whether a Soldier at `piece.position` has reached the promotion rank (§6.9). */
export function shouldTriggerSoldierPromotion(piece: ServerPieceRecord): boolean {
  if (!piece.alive || piece.position === null || piece.character !== 'soldat') {
    return false;
  }
  return piece.position.row === getOppositeEdgeRow(piece.owner);
}

/**
 * Compute all valid promotion choices for a player's Soldier (§5, §6.9, §21.7, §21.8, Q4, Q5).
 * - Roi and Soldat are never promotion choices.
 * - Reine, Colosse, Traqueur, Exécuteur, and Arbalétrier are available only when the player currently has 0 alive instances on the board (cap 1).
 * - Guetteur H, Guetteur D, Assassin, Cavalier, and Berserker remain available and may exceed initial counts.
 */
export function getAvailablePromotionCharacters(
  playerColor: PlayerColor,
  allPieces: readonly ServerPieceRecord[],
): CharacterType[] {
  const aliveOwnCharacters = allPieces
    .filter((p) => p.alive && p.owner === playerColor)
    .map((p) => p.character);

  const aliveCounts = countCharacters(aliveOwnCharacters);
  const choices: CharacterType[] = [];

  for (const ch of CHARACTER_TYPES) {
    if (ch === 'roi' || ch === 'soldat') {
      continue;
    }
    if (canAddCharacterInstance(ch, aliveCounts[ch])) {
      choices.push(ch);
    }
  }

  return choices;
}

/**
 * Apply promotion to a Soldier, preserving `promotedFrom: 'soldat'` (§8.7, §21.9).
 * If promoted into a Colossus on the opposite edge, its progression direction is set toward its own camp
 * so it can immediately advance back across the board.
 */
export function applySoldierPromotion(
  soldierPiece: ServerPieceRecord,
  chosenCharacter: CharacterType,
  allPieces: readonly ServerPieceRecord[],
): ServerPieceRecord {
  if (soldierPiece.character !== 'soldat') {
    throw new Error(`Seul un Soldat peut être promu (reçu: ${soldierPiece.character}).`);
  }

  const available = getAvailablePromotionCharacters(soldierPiece.owner, allPieces);
  if (!available.includes(chosenCharacter)) {
    throw new Error(
      `Promotion en "${chosenCharacter}" non autorisée. Choix valides: ${available.join(', ')}.`,
    );
  }

  const initialForward = getInitialForwardDelta(soldierPiece.owner);
  const nextProgressionDirection: -1 | 1 =
    chosenCharacter === 'colosse' ? (-initialForward as -1 | 1) : initialForward;

  return {
    ...soldierPiece,
    character: chosenCharacter,
    promotedFrom: 'soldat',
    progressionDirection: nextProgressionDirection,
    reversalCount: chosenCharacter === 'colosse' ? 1 : soldierPiece.reversalCount,
    traqueurMarkedTargetId: null,
    traqueurPursuitReady: false,
    arbaletrierCooldownTurnsRemaining: 0,
  };
}
