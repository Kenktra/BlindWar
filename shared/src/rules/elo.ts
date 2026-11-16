import type { GameMode, PlayerColor } from '../types/core.js';
import { INITIAL_ELO_RATING } from '../constants/board.js';

export const DEFAULT_ELO_K_FACTOR = 32;
export const MIN_ELO_RATING = 0;

export interface EloUpdateResult {
  readonly redPrevious: number;
  readonly blackPrevious: number;
  readonly redNext: number;
  readonly blackNext: number;
  readonly redDelta: number;
  readonly blackDelta: number;
}

/** Return initial rating for a newly created account (200 ELO per §13, §21.31, §24). */
export function createInitialEloRating(): number {
  return INITIAL_ELO_RATING;
}

/** Expected score for Player A against Player B using standard 400-scale ELO formula. */
export function calculateExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Compute new ELO ratings after a match (§13, §21.31, §24).
 * Unranked, quick, custom, local, and training matches do NOT modify ELO.
 */
export function computeEloUpdate(
  mode: GameMode,
  redRating: number,
  blackRating: number,
  winner: PlayerColor | 'draw',
  kFactor: number = DEFAULT_ELO_K_FACTOR,
): EloUpdateResult {
  if (mode !== 'matchmaking_ranked') {
    return {
      redPrevious: redRating,
      blackPrevious: blackRating,
      redNext: redRating,
      blackNext: blackRating,
      redDelta: 0,
      blackDelta: 0,
    };
  }

  const expectedRed = calculateExpectedScore(redRating, blackRating);
  const expectedBlack = 1 - expectedRed;

  let rawRedDelta = 0;
  let rawBlackDelta = 0;

  if (winner === 'red') {
    // Plus l'adversaire (Noir) est faible par rapport à Rouge, plus expectedRed est proche de 1
    // -> moins Rouge gagne d'ELO. Plus Noir est fort, plus Rouge gagne d'ELO (minimum +1).
    rawRedDelta = Math.max(1, Math.round(kFactor * (1 - expectedRed)));
    rawBlackDelta = Math.min(-1, Math.round(kFactor * (0 - expectedBlack)));
  } else if (winner === 'black') {
    // Plus l'adversaire (Rouge) est faible par rapport à Noir, moins Noir gagne d'ELO (et plus Rouge en perd s'il était plus fort).
    rawRedDelta = Math.min(-1, Math.round(kFactor * (0 - expectedRed)));
    rawBlackDelta = Math.max(1, Math.round(kFactor * (1 - expectedBlack)));
  } else {
    rawRedDelta = Math.round(kFactor * (0.5 - expectedRed));
    rawBlackDelta = Math.round(kFactor * (0.5 - expectedBlack));
  }

  const redNext = Math.max(MIN_ELO_RATING, redRating + rawRedDelta);
  const blackNext = Math.max(MIN_ELO_RATING, blackRating + rawBlackDelta);

  return {
    redPrevious: redRating,
    blackPrevious: blackRating,
    redNext,
    blackNext,
    redDelta: redNext - redRating,
    blackDelta: blackNext - blackRating,
  };
}
