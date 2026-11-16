import type { Coord, PlayerColor } from '../types/core.js';

export const BOARD_ROWS = 9;
export const BOARD_COLS = 9;
export const TOTAL_BOARD_SQUARES = BOARD_ROWS * BOARD_COLS; // 81

export const PLACEMENT_ROWS_PER_PLAYER = 3;
export const TOTAL_PIECES_PER_PLAYER = 27;

/** Official preparation timer: 90 seconds (§3.2, §24). */
export const DEFAULT_PREP_DURATION_SECONDS = 90;
export const PREP_DURATION_PRESETS_SECONDS = [30, 60, 90, 120, 180] as const;

/** Red always starts the game after preparation (§21.27, §24). */
export const INITIAL_FIRST_PLAYER: PlayerColor = 'red';

/** Official chess clock: 10 minutes (600 seconds) per player (§11, §21.28, §24, Q26). */
export const OFFICIAL_PLAYER_CLOCK_SECONDS = 600;
export const OFFICIAL_PLAYER_CLOCK_MS = OFFICIAL_PLAYER_CLOCK_SECONDS * 1000;
/** Custom match clock presets: 3 min, 5 min, 10 min, 15 min, 30 min (Q26). */
export const CUSTOM_CLOCK_PRESETS_SECONDS = [180, 300, 600, 900, 1800] as const;

/** Repetition draw rules (Q27): warning at 3 repetitions, automatic draw at 5 repetitions. */
export const REPETITION_WARNING_THRESHOLD = 3;
export const REPETITION_DRAW_THRESHOLD = 5;

/** Official reconnection grace period: 60 seconds (§12.2, §21.30, §24). */
export const OFFICIAL_RECONNECT_GRACE_SECONDS = 60;
export const OFFICIAL_RECONNECT_GRACE_MS = OFFICIAL_RECONNECT_GRACE_SECONDS * 1000;

/** Official starting ELO rating: 200 (§13, §21.31, §24). */
export const INITIAL_ELO_RATING = 200;

export const COL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const;

/**
 * Red (Player 1) occupies bottom rows 6..8 and advances toward row 0 (-1).
 * Black (Player 2) occupies top rows 0..2 and advances toward row 8 (+1).
 */
export const PLACEMENT_ROWS_BY_COLOR: Readonly<Record<PlayerColor, readonly [number, number, number]>> = {
  red: [6, 7, 8],
  black: [0, 1, 2],
};

/** Check whether a board coordinate lies within the 9x9 grid. */
export function isWithinBoard(coord: Coord): boolean {
  return (
    Number.isInteger(coord.row) &&
    Number.isInteger(coord.col) &&
    coord.row >= 0 &&
    coord.row < BOARD_ROWS &&
    coord.col >= 0 &&
    coord.col < BOARD_COLS
  );
}

/** Check whether a coordinate falls inside the player's 3-row placement zone. */
export function isInPlacementZone(color: PlayerColor, coord: Coord): boolean {
  if (!isWithinBoard(coord)) {
    return false;
  }
  const rows = PLACEMENT_ROWS_BY_COLOR[color];
  return coord.row === rows[0] || coord.row === rows[1] || coord.row === rows[2];
}

/** Forward row increment toward the opposing side (-1 for red, +1 for black). */
export function getInitialForwardDelta(color: PlayerColor): -1 | 1 {
  return color === 'red' ? -1 : 1;
}

/** Target opposite edge row index (0 for red, 8 for black). */
export function getOppositeEdgeRow(color: PlayerColor): number {
  return color === 'red' ? 0 : BOARD_ROWS - 1;
}

/** Own back edge row index / first row of own camp (8 for red, 0 for black). */
export function getOwnEdgeRow(color: PlayerColor): number {
  return color === 'red' ? BOARD_ROWS - 1 : 0;
}

/** Return the opposing player color. */
export function getOpponentColor(color: PlayerColor): PlayerColor {
  return color === 'red' ? 'black' : 'red';
}

/** Serialize a coordinate as a stable map key (e.g. "6,4"). */
export function coordKey(coord: Coord): string {
  return `${coord.row},${coord.col}`;
}

/** Format a coordinate as algebraic display label (e.g. "E3" where row 8 -> 1, row 0 -> 9). */
export function coordToNotation(coord: Coord): string {
  if (!isWithinBoard(coord)) {
    throw new RangeError(`Coordinate out of 9x9 board bounds: (${coord.row}, ${coord.col})`);
  }
  const colChar = COL_LABELS[coord.col];
  const rank = BOARD_ROWS - coord.row;
  return `${colChar}${rank}`;
}
