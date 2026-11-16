import type { DualClockState, PlayerColor } from '../types/core.js';
import {
  INITIAL_FIRST_PLAYER,
  OFFICIAL_PLAYER_CLOCK_MS,
  getOpponentColor,
} from '../constants/board.js';

export interface ClockTickEvaluation {
  readonly state: DualClockState;
  readonly timedOutPlayer: PlayerColor | null;
  readonly winnerByTimeout: PlayerColor | null;
}

/**
 * Create initial dual chess clock state (§11, §21.27, §21.28, §24).
 * Default duration is 10 minutes (600,000 ms) per player; Red starts.
 */
export function createInitialClockState(
  initialTimePerPlayerMs: number = OFFICIAL_PLAYER_CLOCK_MS,
  startTimestampMs: number | null = null,
): DualClockState {
  if (initialTimePerPlayerMs <= 0) {
    throw new RangeError(`Initial clock time must be positive, got ${initialTimePerPlayerMs}`);
  }
  return {
    remainingMs: {
      red: initialTimePerPlayerMs,
      black: initialTimePerPlayerMs,
    },
    activePlayer: startTimestampMs !== null ? INITIAL_FIRST_PLAYER : null,
    lastTickTimestampMs: startTimestampMs,
  };
}

/** Start or resume the clock for `activePlayer` at `nowMs`. */
export function startPlayerClock(
  clock: DualClockState,
  activePlayer: PlayerColor,
  nowMs: number,
): DualClockState {
  return {
    ...clock,
    activePlayer,
    lastTickTimestampMs: nowMs,
  };
}

/**
 * Advance the authoritative clock to `nowMs` and detect timeout defeat (§11, §21.29, §24).
 * Only the active player's clock decreases; the opponent's clock remains stopped.
 */
export function evaluateClockAt(clock: DualClockState, nowMs: number): ClockTickEvaluation {
  if (clock.activePlayer === null || clock.lastTickTimestampMs === null) {
    return {
      state: clock,
      timedOutPlayer: null,
      winnerByTimeout: null,
    };
  }

  const elapsedMs = Math.max(0, nowMs - clock.lastTickTimestampMs);
  const active = clock.activePlayer;
  const nextRemaining = Math.max(0, clock.remainingMs[active] - elapsedMs);

  const updatedState: DualClockState = {
    remainingMs: {
      ...clock.remainingMs,
      [active]: nextRemaining,
    },
    activePlayer: nextRemaining === 0 ? null : active,
    lastTickTimestampMs: nextRemaining === 0 ? null : nowMs,
  };

  if (nextRemaining === 0) {
    return {
      state: updatedState,
      timedOutPlayer: active,
      winnerByTimeout: getOpponentColor(active),
    };
  }

  return {
    state: updatedState,
    timedOutPlayer: null,
    winnerByTimeout: null,
  };
}

/**
 * Switch the active clock at the end of a turn after accounting for elapsed time up to `nowMs`.
 */
export function switchTurnClock(
  clock: DualClockState,
  nextActivePlayer: PlayerColor,
  nowMs: number,
): ClockTickEvaluation {
  const evaluated = evaluateClockAt(clock, nowMs);
  if (evaluated.timedOutPlayer !== null) {
    return evaluated;
  }

  return {
    state: {
      remainingMs: evaluated.state.remainingMs,
      activePlayer: nextActivePlayer,
      lastTickTimestampMs: nowMs,
    },
    timedOutPlayer: null,
    winnerByTimeout: null,
  };
}
