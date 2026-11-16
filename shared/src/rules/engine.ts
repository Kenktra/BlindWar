import type {
  CardDrawNotificationView,
  CardDrawSource,
  CardNotificationCategory,
  CardNotificationView,
  CardType,
  CharacterType,
  ClientPieceView,
  Coord,
  CustomRulesetConfig,
  DualClockState,
  GameEventType,
  GameMode,
  GraveyardEntryView,
  LastMoveInfo,
  MatchOutcomeReason,
  MatchPhase,
  NewMechanicsStats,
  PlacementEntry,
  PlacementStatusView,
  PlayerColor,
  ServerGraveyardRecord,
  ServerPieceRecord,
  ServerTrapRecord,
} from '../types/core.js';
import { createZeroNewMechanicsStats } from '../types/core.js';
import {
  ARMY_COMPOSITION,
  CHARACTER_CATALOG,
  canAddCharacterInstance,
  countCharacters,
} from '../constants/army.js';
import {
  INITIAL_FIRST_PLAYER,
  REPETITION_DRAW_THRESHOLD,
  REPETITION_WARNING_THRESHOLD,
  coordKey,
  coordToNotation,
  getInitialForwardDelta,
  getOpponentColor,
  getOwnEdgeRow,
  isWithinBoard,
} from '../constants/board.js';
import {
  BROUILLARD_DURATION_TURNS,
  CARD_CATALOG,
  COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD,
  ESPIONNAGE_DURATION_TURNS,
  ESPIONNAGE_TARGET_COUNT,
  OFFICIAL_RULESET_CONFIG,
  advanceDrawCounterOnElimination,
  drawRandomCardFromPool,
  isCardAllowedOnCharacter,
} from '../constants/cards.js';
import {
  createInitialClockState,
  evaluateClockAt,
  startPlayerClock,
  switchTurnClock,
} from './clock.js';
import {
  ONE_FULL_TURN_TICKS,
  applyColossusEdgeReversalIfNeeded,
  resolveCavalierSingleJump,
  resolveCrossbowShot,
  resolveDirectCapture,
  resolvePiercingStrike,
} from './combat.js';
import {
  type MoveCandidateKind,
  generateCavalierJumpCandidates,
  generateMoveCandidatesForPiece,
  generateRetreatCandidatesForPiece,
  generateTeleportCandidatesForPiece,
  generateTraqueurMarkCandidates,
  hasAnyLegalPieceMove,
} from './movement-locked.js';
import {
  autoCompletePlacement,
  validateCompletePlacement,
} from './placement.js';
import {
  applySoldierPromotion,
  getAvailablePromotionCharacters,
  shouldTriggerSoldierPromotion,
} from './promotion.js';
import {
  type VisibilityContext,
  computeGuetteurReconZoneKeys,
  createGraveyardRecordOnElimination,
  projectGraveyardEntryForViewer,
  projectPieceForViewer,
  resolvePieceRevealKindForViewer,
} from './visibility.js';

export interface PlayerRuntimeState {
  readonly color: PlayerColor;
  readonly hand: readonly CardType[];
  readonly killCounterTowardCard: number;
  readonly totalEliminations: number;
  readonly recruitmentUsed: boolean;
  /** Remaining half-turn ticks of Brouillard (3 full turns = 6 half-turn ticks). */
  readonly fogTicksRemaining: number;
  /** Remaining own turns of cooldown before `Block` can be played again (Q17: 2 turns). */
  readonly blockCooldownTurnsRemaining: number;
  readonly placementConfirmed: boolean;
  readonly stagedPlacement: readonly PlacementEntry[];
  readonly lastCardDraw?: CardDrawNotificationView | null;
  readonly newMechanicsStats?: NewMechanicsStats;
}

export interface TurnRuntimeState {
  readonly turnNumber: number;
  readonly activePlayer: PlayerColor;
  readonly remainingActions: number;
  readonly doubleActionActive: boolean;
  /** True when active player is currently executing an earned Bonus Turn (1 move, no card allowed). */
  readonly isBonusTurn: boolean;
  /** Explicit human-readable explanation of why the Bonus Turn was granted. */
  readonly bonusTurnReason: string | null;
  readonly rageUsedThisTurn: boolean;
  /** Unique enemy piece IDs genuinely eliminated by the active player during this turn (prevents double-counting). */
  readonly eliminatedEnemyIdsThisTurn: readonly string[];
  /** When non-null, the active player is mid-Cavalier jump chain and may continue or stop. */
  readonly pendingCavalierJumpPieceId: string | null;
  /** When non-null, the active player's Berserker just eliminated an enemy and may make an optional 2nd non-capturing move. */
  readonly pendingBerserkerRagePieceId: string | null;
  /** When non-null, the active player's Soldier reached the opposite edge and must select a promotion character. */
  readonly pendingPromotionPieceId: string | null;
  readonly nextOpponentActionsOverride: number | null;
  /** Whether the opponent's next turn is skipped due to `Block`. */
  readonly skipOpponentNextTurn: boolean;
}

export interface ServerCardEventRecord {
  readonly card: CardType;
  readonly cardName: string;
  readonly badge: string;
  readonly category: CardNotificationCategory;
  readonly shortDescriptionForOwner: string;
  readonly shortDescriptionForOpponent: string;
  readonly consequenceForOwner: string;
  readonly consequenceForOpponent: string;
  readonly visibleTargetNotationForOwner: string | null;
  readonly visibleTargetNotationForOpponent: string | null;
}

export interface MatchActionLogEntry {
  readonly seq: number;
  readonly turnNumber: number;
  readonly actor: PlayerColor;
  readonly timestampMs: number;
  readonly eventType?: GameEventType;
  readonly icon?: string;
  /** Public summary visible to Red (never leaks Black's secret identities/targets). */
  readonly summaryForRed: string;
  /** Public summary visible to Black (never leaks Red's secret identities/targets). */
  readonly summaryForBlack: string;
  readonly cardEvent?: ServerCardEventRecord | null;
}

export interface ServerMatchState {
  readonly matchId: string;
  readonly mode: GameMode;
  readonly phase: MatchPhase;
  readonly ruleset: CustomRulesetConfig;
  readonly pieces: readonly ServerPieceRecord[];
  readonly traps: readonly ServerTrapRecord[];
  readonly graveyard: readonly ServerGraveyardRecord[];
  readonly players: Readonly<Record<PlayerColor, PlayerRuntimeState>>;
  readonly turn: TurnRuntimeState;
  readonly clock: DualClockState;
  readonly winner: PlayerColor | 'draw' | null;
  readonly outcomeReason: MatchOutcomeReason | null;
  readonly drawOfferFrom: PlayerColor | null;
  readonly positionCounts: Readonly<Record<string, number>>;
  readonly repetitionWarningActive: boolean;
  readonly maxRepetitionCountSeen: number;
  readonly totalTrapAlertsCount: number;
  readonly lastMove?: LastMoveInfo | null;
  readonly actionLog: readonly MatchActionLogEntry[];
}

export type CardPlayPayload =
  | { readonly card: 'kamikaze' | 'invincibilite' | 'protection' | 'contre_espionnage'; readonly targetPieceId: string }
  | { readonly card: 'revelation_temporaire' | 'revelation_permanente'; readonly targetEnemyPieceId: string }
  | { readonly card: 'espionnage'; readonly targetEnemyPieceIds: readonly string[] }
  | { readonly card: 'block' | 'brouillard' | 'double_action' }
  | { readonly card: 'retreat' | 'teleportation'; readonly targetPieceId: string; readonly destination: Coord }
  | { readonly card: 'resurrection'; readonly graveyardPieceId: string; readonly destination: Coord }
  | { readonly card: 'recrutement' | 'piege'; readonly destination: Coord }
  | { readonly card: 'sacrifice'; readonly targetSoldierPieceId: string };

export interface ClientActionLogEntryView {
  readonly seq: number;
  readonly turnNumber: number;
  readonly timestampMs: number;
  readonly actor: PlayerColor;
  readonly eventType: GameEventType;
  readonly icon: string;
  readonly text: string;
  readonly cardNotification: CardNotificationView | null;
}

export interface ClientMatchView {
  readonly matchId: string;
  readonly viewerColor: PlayerColor;
  readonly mode: GameMode;
  readonly phase: MatchPhase;
  readonly ruleset: CustomRulesetConfig;
  readonly pieces: readonly ClientPieceView[];
  readonly ownTraps: readonly Coord[];
  readonly totalActiveTrapNotifications: number;
  readonly graveyard: readonly GraveyardEntryView[];
  readonly ownHand: readonly CardType[];
  readonly opponentHandCount: number;
  readonly ownKillCounterTowardCard: number;
  readonly opponentKillCounterTowardCard: number;
  readonly ownRecruitmentUsed: boolean;
  readonly ownBlockCooldownTurns: number;
  readonly fogActiveByPlayer: Readonly<Record<PlayerColor, boolean>>;
  readonly guetteurReconCoords: readonly Coord[];
  readonly turn: {
    readonly turnNumber: number;
    readonly activePlayer: PlayerColor;
    readonly remainingActions: number;
    readonly doubleActionActive: boolean;
    readonly isBonusTurn: boolean;
    readonly bonusTurnReason: string | null;
    readonly eliminationsThisTurnCount: number;
    readonly pendingCavalierJumpPieceId: string | null;
    readonly pendingBerserkerRagePieceId: string | null;
    readonly pendingPromotionPieceId: string | null;
    readonly availablePromotionChoices: readonly CharacterType[];
    readonly canPlayCardNow: boolean;
  };
  readonly clock: DualClockState;
  readonly winner: PlayerColor | 'draw' | null;
  readonly outcomeReason: MatchOutcomeReason | null;
  readonly drawOfferFrom: PlayerColor | null;
  readonly repetitionWarningActive: boolean;
  readonly maxRepetitionCountSeen: number;
  readonly placementStatus: PlacementStatusView;
  readonly ownConfirmedPlacement: readonly PlacementEntry[];
  readonly ownLastCardDraw: CardDrawNotificationView | null;
  readonly ownNewMechanicsStats?: NewMechanicsStats;
  readonly lastMove: LastMoveInfo | null;
  readonly cardNotifications: readonly CardNotificationView[];
  readonly actionLog: readonly ClientActionLogEntryView[];
}

/**
 * Create a brand-new authoritative match state in the `placement` phase (§3.2).
 */
export function createMatchState(
  matchId: string,
  mode: GameMode = 'local',
  customRuleset: Partial<CustomRulesetConfig> = {},
): ServerMatchState {
  const ruleset: CustomRulesetConfig = {
    ...OFFICIAL_RULESET_CONFIG,
    ...customRuleset,
  };

  return {
    matchId,
    mode,
    phase: 'placement',
    ruleset,
    pieces: [],
    traps: [],
    graveyard: [],
    players: {
      red: {
        color: 'red',
        hand: [],
        killCounterTowardCard: 0,
        totalEliminations: 0,
        recruitmentUsed: false,
        fogTicksRemaining: 0,
        blockCooldownTurnsRemaining: 0,
        placementConfirmed: false,
        stagedPlacement: [],
        lastCardDraw: null,
        newMechanicsStats: createZeroNewMechanicsStats(),
      },
      black: {
        color: 'black',
        hand: [],
        killCounterTowardCard: 0,
        totalEliminations: 0,
        recruitmentUsed: false,
        fogTicksRemaining: 0,
        blockCooldownTurnsRemaining: 0,
        placementConfirmed: false,
        stagedPlacement: [],
        lastCardDraw: null,
        newMechanicsStats: createZeroNewMechanicsStats(),
      },
    },
    turn: {
      turnNumber: 1,
      activePlayer: INITIAL_FIRST_PLAYER,
      remainingActions: 1,
      doubleActionActive: false,
      isBonusTurn: false,
      bonusTurnReason: null,
      rageUsedThisTurn: false,
      eliminatedEnemyIdsThisTurn: [],
      pendingCavalierJumpPieceId: null,
      pendingBerserkerRagePieceId: null,
      pendingPromotionPieceId: null,
      nextOpponentActionsOverride: null,
      skipOpponentNextTurn: false,
    },
    clock: createInitialClockState(ruleset.clockDurationSeconds * 1000, null),
    winner: null,
    outcomeReason: null,
    drawOfferFrom: null,
    positionCounts: {},
    repetitionWarningActive: false,
    maxRepetitionCountSeen: 1,
    totalTrapAlertsCount: 0,
    lastMove: null,
    actionLog: [],
  };
}

function buildVisibilityContext(
  state: ServerMatchState,
  viewerColor: PlayerColor,
): VisibilityContext {
  return {
    fogTurnsRemainingByOwner: {
      red: state.players.red.fogTicksRemaining,
      black: state.players.black.fogTicksRemaining,
    },
    viewerGuetteurReconKeys: computeGuetteurReconZoneKeys(state.pieces, viewerColor),
  };
}

function instantiateArmyFromPlacement(
  color: PlayerColor,
  entries: readonly PlacementEntry[],
): ServerPieceRecord[] {
  const forwardDelta = getInitialForwardDelta(color);
  return entries.map((entry, idx) => ({
    id: `${color}-${ idx + 1 }`,
    owner: color,
    character: entry.character,
    promotedFrom: null,
    position: entry.coord,
    alive: true,
    progressionDirection: forwardDelta,
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
  }));
}

function bumpPlayerNewStats(
  player: PlayerRuntimeState,
  delta: Partial<NewMechanicsStats>,
): PlayerRuntimeState {
  const prev = player.newMechanicsStats ?? createZeroNewMechanicsStats();
  return {
    ...player,
    newMechanicsStats: {
      traqueurMoves: prev.traqueurMoves + (delta.traqueurMoves ?? 0),
      traqueurMarks: prev.traqueurMarks + (delta.traqueurMarks ?? 0),
      traqueurPursuitsSucceeded:
        prev.traqueurPursuitsSucceeded + (delta.traqueurPursuitsSucceeded ?? 0),
      traqueurEliminations: prev.traqueurEliminations + (delta.traqueurEliminations ?? 0),
      executeurPiercingStrikes:
        prev.executeurPiercingStrikes + (delta.executeurPiercingStrikes ?? 0),
      executeurEliminations: prev.executeurEliminations + (delta.executeurEliminations ?? 0),
      arbaletrierShotsTotal: prev.arbaletrierShotsTotal + (delta.arbaletrierShotsTotal ?? 0),
      arbaletrierShotsSucceeded:
        prev.arbaletrierShotsSucceeded + (delta.arbaletrierShotsSucceeded ?? 0),
      arbaletrierShotsBlocked:
        prev.arbaletrierShotsBlocked + (delta.arbaletrierShotsBlocked ?? 0),
      colossiEliminatedByKamikaze:
        prev.colossiEliminatedByKamikaze + (delta.colossiEliminatedByKamikaze ?? 0),
    },
  };
}

/**
 * Reconcile Traqueur marks after any state update (§3.6, §6.5):
 * Clears the mark whenever:
 * - The Traqueur or target was eliminated
 * - The target is no longer identifiable (temp reveal expired, Brouillard, Contre-espionnage, left Guetteur zone)
 */
function reconcileTraqueurMarks(state: ServerMatchState, nowMs?: number): ServerMatchState {
  const visRed = buildVisibilityContext(state, 'red');
  const visBlack = buildVisibilityContext(state, 'black');
  const lostOwners = new Set<PlayerColor>();
  let changed = false;

  const updatedPieces = state.pieces.map((p) => {
    if (p.character !== 'traqueur' || !p.traqueurMarkedTargetId) {
      return p;
    }
    if (!p.alive || p.position === null) {
      changed = true;
      return {
        ...p,
        traqueurMarkedTargetId: null,
        traqueurPursuitReady: false,
      };
    }
    const target = state.pieces.find((t) => t.id === p.traqueurMarkedTargetId);
    if (!target || !target.alive || target.position === null) {
      changed = true;
      return {
        ...p,
        traqueurMarkedTargetId: null,
        traqueurPursuitReady: false,
      };
    }
    const vis = p.owner === 'red' ? visRed : visBlack;
    const reveal = resolvePieceRevealKindForViewer(target, p.owner, vis);
    if (reveal === 'none') {
      changed = true;
      lostOwners.add(p.owner);
      return {
        ...p,
        traqueurMarkedTargetId: null,
        traqueurPursuitReady: false,
      };
    }
    return p;
  });

  if (!changed) {
    return state;
  }

  let nextLog = state.actionLog;
  if (lostOwners.size > 0 && nowMs !== undefined) {
    for (const ownerColor of lostOwners) {
      nextLog = appendLog(
        { ...state, actionLog: nextLog },
        ownerColor,
        ownerColor === 'red'
          ? `La cible du Traqueur n'est plus identifiable : le marquage disparaît.`
          : ``,
        ownerColor === 'black'
          ? `La cible du Traqueur n'est plus identifiable : le marquage disparaît.`
          : ``,
        nowMs,
        { eventType: 'EFFECT_ACTIVATED', icon: 'MARQ' },
      );
    }
  }

  return {
    ...state,
    pieces: updatedPieces,
    actionLog: nextLog,
  };
}

const CARD_VISUAL_META: Readonly<
  Record<CardType, { readonly badge: string; readonly category: CardNotificationCategory }>
> = {
  kamikaze: { badge: '💥', category: 'offensive' },
  invincibilite: { badge: '🛡️', category: 'defensive' },
  block: { badge: '⛓️', category: 'tactical' },
  retreat: { badge: '↩️', category: 'tactical' },
  revelation_temporaire: { badge: '👁️', category: 'recon' },
  revelation_permanente: { badge: '🔍', category: 'recon' },
  resurrection: { badge: '✨', category: 'tactical' },
  brouillard: { badge: '🌫️', category: 'defensive' },
  espionnage: { badge: '📡', category: 'recon' },
  teleportation: { badge: '⚡', category: 'tactical' },
  protection: { badge: '🔰', category: 'defensive' },
  recrutement: { badge: '📯', category: 'tactical' },
  double_action: { badge: '⏩', category: 'offensive' },
  piege: { badge: '🕸️', category: 'offensive' },
  contre_espionnage: { badge: '🕶️', category: 'defensive' },
  sacrifice: { badge: '🩸', category: 'tactical' },
};

function buildCardDrawNotification(
  playerState: PlayerRuntimeState,
  drawnCard: CardType,
  handCountAfter: number,
  ruleset: CustomRulesetConfig,
  source: CardDrawSource,
  turnNumber: number,
  nowMs: number,
): CardDrawNotificationView {
  const seq = (playerState.lastCardDraw?.seq ?? 0) + 1;
  const meta = CARD_VISUAL_META[drawnCard];
  const catalog = CARD_CATALOG[drawnCard];
  return {
    id: `draw-${playerState.color}-${seq}`,
    seq,
    turnNumber,
    timestampMs: nowMs,
    card: drawnCard,
    cardName: catalog.name,
    badge: meta.badge,
    category: meta.category,
    shortDescription: catalog.description,
    source,
    handCountAfter,
    maxHandSize: ruleset.maxHandSize,
  };
}

function appendLog(
  state: ServerMatchState,
  actor: PlayerColor,
  summaryForRed: string,
  summaryForBlack: string,
  nowMs: number,
  extra?: {
    readonly eventType?: GameEventType;
    readonly icon?: string;
    readonly cardEvent?: ServerCardEventRecord | null;
  },
): readonly MatchActionLogEntry[] {
  const nextEntry: MatchActionLogEntry = {
    seq: state.actionLog.length + 1,
    turnNumber: state.turn.turnNumber,
    actor,
    timestampMs: nowMs,
    eventType: extra?.eventType ?? 'PIECE_MOVED',
    icon: extra?.icon ?? 'DEPL',
    summaryForRed,
    summaryForBlack,
    cardEvent: extra?.cardEvent ?? null,
  };
  return [...state.actionLog, nextEntry];
}

/**
 * Submit and confirm a complete 27-piece placement for `color` (§3.2).
 * Once both players have confirmed, transitions automatically to `playing` with Red starting (§21.27).
 */
export function submitPlayerPlacement(
  state: ServerMatchState,
  color: PlayerColor,
  entries: readonly PlacementEntry[],
  nowMs: number = Date.now(),
): ServerMatchState {
  if (state.phase !== 'placement') {
    throw new Error(`La phase de placement est déjà terminée.`);
  }

  if (state.players[color].placementConfirmed) {
    throw new Error(`Votre placement a déjà été validé et verrouillé.`);
  }

  const validation = validateCompletePlacement(color, entries);
  if (!validation.valid) {
    throw new Error(`Placement invalide pour ${color}: ${validation.errors.join(' | ')}`);
  }

  const nextPlayers: Record<PlayerColor, PlayerRuntimeState> = {
    ...state.players,
    [color]: {
      ...state.players[color],
      stagedPlacement: entries,
      placementConfirmed: true,
    },
  };

  let nextState: ServerMatchState = {
    ...state,
    players: nextPlayers,
  };

  if (nextPlayers.red.placementConfirmed && nextPlayers.black.placementConfirmed) {
    nextState = startPlayingPhaseFromConfirmedPlacements(nextState, nowMs);
  }

  return nextState;
}

/**
 * Automatically complete any unplaced pieces when the preparation timer reaches 0 (§3.2).
 */
export function finalizePlacementOnTimerExpired(
  state: ServerMatchState,
  nowMs: number = Date.now(),
  randomFn: () => number = Math.random,
): ServerMatchState {
  if (state.phase !== 'placement') {
    return state;
  }

  const redPlacement = state.players.red.placementConfirmed
    ? state.players.red.stagedPlacement
    : autoCompletePlacement('red', state.players.red.stagedPlacement, randomFn);

  const blackPlacement = state.players.black.placementConfirmed
    ? state.players.black.stagedPlacement
    : autoCompletePlacement('black', state.players.black.stagedPlacement, randomFn);

  const nextState: ServerMatchState = {
    ...state,
    players: {
      red: {
        ...state.players.red,
        stagedPlacement: redPlacement,
        placementConfirmed: true,
      },
      black: {
        ...state.players.black,
        stagedPlacement: blackPlacement,
        placementConfirmed: true,
      },
    },
  };

  return startPlayingPhaseFromConfirmedPlacements(nextState, nowMs);
}

function computeBoardSignature(state: ServerMatchState): string {
  const aliveSorted = [...state.pieces]
    .filter((p) => p.alive && p.position !== null)
    .sort((a, b) => {
      const posA = a.position!;
      const posB = b.position!;
      return posA.row !== posB.row ? posA.row - posB.row : posA.col - posB.col;
    })
    .map(
      (p) =>
        `${p.owner}:${p.character}@${p.position!.row},${p.position!.col}:${p.progressionDirection}:${p.immobilizedTicksRemaining}:${p.invincibleTicksRemaining}:${p.arbaletrierCooldownTurnsRemaining ?? 0}:${p.traqueurMarkedTargetId ? 1 : 0}:${p.traqueurPursuitReady ? 1 : 0}`,
    )
    .join(';');

  return `${state.turn.activePlayer}|${aliveSorted}`;
}

function startPlayingPhaseFromConfirmedPlacements(
  state: ServerMatchState,
  nowMs: number,
): ServerMatchState {
  const redPieces = instantiateArmyFromPlacement('red', state.players.red.stagedPlacement);
  const blackPieces = instantiateArmyFromPlacement('black', state.players.black.stagedPlacement);
  const allPieces = [...redPieces, ...blackPieces];

  const baseState: ServerMatchState = {
    ...state,
    phase: 'playing',
    pieces: allPieces,
    clock: startPlayerClock(state.clock, INITIAL_FIRST_PLAYER, nowMs),
    actionLog: appendLog(
      state,
      INITIAL_FIRST_PLAYER,
      'Début de la partie : Rouge commence.',
      'Début de la partie : Rouge commence.',
      nowMs,
    ),
  };

  const sig = computeBoardSignature(baseState);
  return {
    ...baseState,
    positionCounts: { [sig]: 1 },
  };
}

/**
 * Determine whether `playerColor` can currently play `card` in `state`.
 */
export function canPlayerPlayCard(
  state: ServerMatchState,
  playerColor: PlayerColor,
  card: CardType,
): boolean {
  if (state.phase !== 'playing') {
    return false;
  }
  const t = state.turn;
  if (t.activePlayer !== playerColor) {
    return false;
  }
  // Cannot play cards during a Bonus Turn or Double action sequence
  if (t.isBonusTurn || t.doubleActionActive) {
    return false;
  }
  // Cannot play cards while mid-chain or awaiting promotion
  if (
    t.pendingCavalierJumpPieceId !== null ||
    t.pendingBerserkerRagePieceId !== null ||
    t.pendingPromotionPieceId !== null
  ) {
    return false;
  }

  const player = state.players[playerColor];
  if (!player.hand.includes(card) || !state.ruleset.enabledCards.includes(card)) {
    return false;
  }

  const aliveOwn = state.pieces.filter((p) => p.alive && p.owner === playerColor);
  const aliveEnemy = state.pieces.filter((p) => p.alive && p.owner !== playerColor);
  const occupiedKeys = new Set(
    state.pieces
      .filter((p) => p.alive && p.position !== null)
      .map((p) => coordKey(p.position!)),
  );
  const activeTrapKeys = new Set(
    state.traps.filter((tr) => tr.active).map((tr) => coordKey(tr.coord)),
  );

  switch (card) {
    case 'kamikaze':
      return aliveOwn.some(
        (p) => isCardAllowedOnCharacter('kamikaze', p.character) && !p.hasKamikaze,
      );
    case 'invincibilite':
      return aliveOwn.some(
        (p) => isCardAllowedOnCharacter('invincibilite', p.character) && p.invincibleTicksRemaining === 0,
      );
    case 'protection':
      return aliveOwn.some(
        (p) => isCardAllowedOnCharacter('protection', p.character) && !p.hasProtection,
      );
    case 'contre_espionnage':
      return aliveOwn.length > 0;
    case 'block':
      return player.blockCooldownTurnsRemaining === 0;
    case 'brouillard':
    case 'double_action':
      return true;
    case 'revelation_temporaire':
    case 'revelation_permanente':
      return aliveEnemy.some((p) => !p.permanentlyRevealedTo[playerColor]);
    case 'espionnage':
      return aliveEnemy.length > 0;
    case 'retreat': {
      const vis = buildVisibilityContext(state, playerColor);
      return aliveOwn.some(
        (p) => generateRetreatCandidatesForPiece(p, state.pieces, vis).length > 0,
      );
    }
    case 'teleportation':
      return aliveOwn.some(
        (p) => generateTeleportCandidatesForPiece(p, state.pieces).length > 0,
      );
    case 'resurrection': {
      const backRow = getOwnEdgeRow(playerColor);
      let hasFreeBackRowSquare = false;
      for (let col = 0; col < 9; col += 1) {
        if (!occupiedKeys.has(coordKey({ row: backRow, col }))) {
          hasFreeBackRowSquare = true;
          break;
        }
      }
      if (!hasFreeBackRowSquare) {
        return false;
      }
      const aliveCounts = countCharacters(aliveOwn.map((p) => p.character));
      return state.graveyard.some(
        (g) =>
          g.owner === playerColor &&
          isCardAllowedOnCharacter('resurrection', g.characterAtDeath) &&
          canAddCharacterInstance(g.characterAtDeath, aliveCounts[g.characterAtDeath]),
      );
    }
    case 'recrutement': {
      if (player.recruitmentUsed) {
        return false;
      }
      const backRow = getOwnEdgeRow(playerColor);
      let hasFreeBackRowSquare = false;
      for (let col = 0; col < 9; col += 1) {
        if (!occupiedKeys.has(coordKey({ row: backRow, col }))) {
          hasFreeBackRowSquare = true;
          break;
        }
      }
      if (!hasFreeBackRowSquare) {
        return false;
      }
      return state.graveyard.some(
        (g) => g.owner === playerColor && g.characterAtDeath === 'soldat',
      );
    }
    case 'piege': {
      for (let row = 0; row < 9; row += 1) {
        for (let col = 0; col < 9; col += 1) {
          const key = coordKey({ row, col });
          if (!occupiedKeys.has(key) && !activeTrapKeys.has(key)) {
            return true;
          }
        }
      }
      return false;
    }
    case 'sacrifice':
      return aliveOwn.some((p) => p.character === 'soldat');
  }
}

/**
 * Check whether the active player is in Stalemate / Pat (§14, §21.32, Q29):
 * No legal piece movement AND no playable card in hand.
 */
export function isPlayerInStalemate(
  state: ServerMatchState,
  playerColor: PlayerColor,
): boolean {
  const vis = buildVisibilityContext(state, playerColor);
  if (hasAnyLegalPieceMove(playerColor, state.pieces, vis)) {
    return false;
  }

  for (const card of state.players[playerColor].hand) {
    if (canPlayerPlayCard(state, playerColor, card)) {
      return false;
    }
  }

  return true;
}

function awardEliminationsAndCards(
  playerState: PlayerRuntimeState,
  eliminationsCount: number,
  ruleset: CustomRulesetConfig,
  randomFn: () => number,
  turnNumber: number,
  nowMs: number,
): PlayerRuntimeState {
  let hand = [...playerState.hand];
  let killCounter = playerState.killCounterTowardCard;
  let lastCardDraw = playerState.lastCardDraw ?? null;
  const totalEliminations = playerState.totalEliminations + eliminationsCount;

  for (let i = 0; i < eliminationsCount; i += 1) {
    const step = advanceDrawCounterOnElimination(hand.length, killCounter, ruleset.maxHandSize);
    killCounter = step.nextKillCounter;
    if (step.shouldDrawCard && hand.length < ruleset.maxHandSize) {
      const drawn = drawRandomCardFromPool(ruleset.enabledCards, randomFn);
      if (drawn !== null) {
        hand.push(drawn);
        lastCardDraw = buildCardDrawNotification(
          { ...playerState, lastCardDraw },
          drawn,
          hand.length,
          ruleset,
          'eliminations',
          turnNumber,
          nowMs,
        );
      }
    }
  }

  return {
    ...playerState,
    hand,
    killCounterTowardCard: killCounter,
    totalEliminations,
    lastCardDraw,
  };
}

function checkAndApplyTrapAt(
  piece: ServerPieceRecord,
  traps: readonly ServerTrapRecord[],
): {
  readonly updatedPiece: ServerPieceRecord;
  readonly updatedTraps: readonly ServerTrapRecord[];
  readonly triggeredTrap: ServerTrapRecord | null;
} {
  if (!piece.alive || piece.position === null) {
    return { updatedPiece: piece, updatedTraps: traps, triggeredTrap: null };
  }

  const posKey = coordKey(piece.position);
  const foundTrap = traps.find((t) => t.active && coordKey(t.coord) === posKey);
  if (!foundTrap) {
    return { updatedPiece: piece, updatedTraps: traps, triggeredTrap: null };
  }

  // Q18: Trap affects BOTH camps and immobilizes the piece for 1 full turn (`ONE_FULL_TURN_TICKS`)
  const updatedPiece: ServerPieceRecord = {
    ...piece,
    immobilizedTicksRemaining: Math.max(piece.immobilizedTicksRemaining, ONE_FULL_TURN_TICKS),
  };

  const updatedTraps = traps.map((t) =>
    t.id === foundTrap.id ? { ...t, active: false } : t,
  );

  return {
    updatedPiece,
    updatedTraps,
    triggeredTrap: foundTrap,
  };
}

function recordUniqueEliminatedEnemy(
  existing: readonly string[],
  enemyPiece: ServerPieceRecord,
  actorColor: PlayerColor,
): readonly string[] {
  if (enemyPiece.owner === actorColor || existing.includes(enemyPiece.id)) {
    return existing;
  }
  return [...existing, enemyPiece.id];
}

function decrementTurnEndTimers(
  state: ServerMatchState,
  finishedPlayer: PlayerColor,
  nowMs?: number,
  isEnteringBonusTurn: boolean = false,
): ServerMatchState {
  const updatedPieces = state.pieces.map((p) => {
    const nextTempRed = Math.max(0, p.tempRevealedTicksTo.red - 1);
    const nextTempBlack = Math.max(0, p.tempRevealedTicksTo.black - 1);
    const nextEspRed = Math.max(0, p.espionageRevealedTicksTo.red - 1);
    const nextEspBlack = Math.max(0, p.espionageRevealedTicksTo.black - 1);
    const nextInvincible = Math.max(0, p.invincibleTicksRemaining - 1);
    const nextCounterEsp = Math.max(0, p.counterEspionageTicksRemaining - 1);
    const nextImmobilized = Math.max(0, p.immobilizedTicksRemaining - 1);
    // L'Arbalétrier ne recharge que lorsque le tour réel du propriétaire s'achève (pas lors de l'entrée dans un Tour Bonus du même tour)
    const nextArbaletrierCooldown =
      p.owner === finishedPlayer && !isEnteringBonusTurn
        ? Math.max(0, (p.arbaletrierCooldownTurnsRemaining ?? 0) - 1)
        : (p.arbaletrierCooldownTurnsRemaining ?? 0);
    const nextTraqueurPursuitReady =
      p.owner === finishedPlayer &&
      p.character === 'traqueur' &&
      p.alive &&
      Boolean(p.traqueurMarkedTargetId)
        ? true
        : Boolean(p.traqueurPursuitReady);

    return {
      ...p,
      invincibleTicksRemaining: nextInvincible,
      counterEspionageTicksRemaining: nextCounterEsp,
      immobilizedTicksRemaining: nextImmobilized,
      arbaletrierCooldownTurnsRemaining: nextArbaletrierCooldown,
      traqueurPursuitReady: nextTraqueurPursuitReady,
      tempRevealedTicksTo: {
        red: nextTempRed,
        black: nextTempBlack,
      },
      espionageRevealedTicksTo: {
        red: nextEspRed,
        black: nextEspBlack,
      },
    };
  });

  const finishedPlayerState = state.players[finishedPlayer];
  const updatedPlayers: Record<PlayerColor, PlayerRuntimeState> = {
    red: {
      ...state.players.red,
      fogTicksRemaining: Math.max(0, state.players.red.fogTicksRemaining - 1),
      blockCooldownTurnsRemaining:
        finishedPlayer === 'red' && !isEnteringBonusTurn
          ? Math.max(0, finishedPlayerState.blockCooldownTurnsRemaining - 1)
          : state.players.red.blockCooldownTurnsRemaining,
    },
    black: {
      ...state.players.black,
      fogTicksRemaining: Math.max(0, state.players.black.fogTicksRemaining - 1),
      blockCooldownTurnsRemaining:
        finishedPlayer === 'black' && !isEnteringBonusTurn
          ? Math.max(0, finishedPlayerState.blockCooldownTurnsRemaining - 1)
          : state.players.black.blockCooldownTurnsRemaining,
    },
  };

  return reconcileTraqueurMarks(
    {
      ...state,
      pieces: updatedPieces,
      players: updatedPlayers,
    },
    nowMs,
  );
}

/**
 * Advance after a completed action within the current turn, handling:
 * - Remaining actions in `Double action`
 * - Global Bonus Turn (when >= 2 distinct real enemy eliminations occur during the turn)
 * - Standard 1 action per turn regardless of 0 or 1 elimination (old Cavalier penalty removed)
 * - `Block` skip turn
 * - Repetition tracking & Stalemate check
 */
function advanceTurnOrSubAction(
  state: ServerMatchState,
  actionConsumedCount: number,
  nowMs: number,
): ServerMatchState {
  if (state.phase === 'finished') {
    return state;
  }

  // If a pending sub-step (Cavalier jump continuation, Berserker Rage, Soldier Promotion) is active, wait for player input
  if (
    state.turn.pendingCavalierJumpPieceId !== null ||
    state.turn.pendingBerserkerRagePieceId !== null ||
    state.turn.pendingPromotionPieceId !== null
  ) {
    return state;
  }

  const remainingAfter = state.turn.remainingActions - actionConsumedCount;
  if (remainingAfter > 0) {
    return {
      ...state,
      turn: {
        ...state.turn,
        remainingActions: remainingAfter,
      },
    };
  }

  const currentActor = state.turn.activePlayer;
  const opponent = getOpponentColor(currentActor);
  const elimCount = state.turn.eliminatedEnemyIdsThisTurn.length;

  // Bonus Turn: triggered whenever >= 2 real enemy eliminations are achieved during a normal turn (no chaining from inside a Bonus Turn)
  if (!state.turn.isBonusTurn && elimCount >= 2) {
    const ticked = decrementTurnEndTimers(state, currentActor, nowMs, true);
    const reasonText = `${elimCount} éliminations réalisées durant le tour`;
    const nextState: ServerMatchState = {
      ...ticked,
      turn: {
        turnNumber: ticked.turn.turnNumber + 1,
        activePlayer: currentActor,
        remainingActions: 1,
        doubleActionActive: false,
        isBonusTurn: true,
        bonusTurnReason: reasonText,
        rageUsedThisTurn: false,
        eliminatedEnemyIdsThisTurn: [],
        pendingCavalierJumpPieceId: null,
        pendingBerserkerRagePieceId: null,
        pendingPromotionPieceId: null,
        nextOpponentActionsOverride: null,
        skipOpponentNextTurn: ticked.turn.skipOpponentNextTurn,
      },
      actionLog: appendLog(
        ticked,
        currentActor,
        `⚡ Tour bonus accordé à ${currentActor === 'red' ? 'Rouge' : 'Noir'} (${reasonText}) : 1 déplacement autorisé sans carte.`,
        `⚡ Tour bonus accordé à ${currentActor === 'red' ? 'Rouge' : 'Noir'} (${reasonText}) : 1 déplacement autorisé sans carte.`,
        nowMs,
        { eventType: 'TURN_CHANGED', icon: '⚡' },
      ),
    };
    return evaluatePostTurnTransitionConditions(nextState, nowMs);
  }

  // If `Block` was played this turn, opponent's turn is skipped completely (§8.3)
  if (state.turn.skipOpponentNextTurn) {
    const tickedOnce = decrementTurnEndTimers(state, currentActor, nowMs, false);
    const tickedTwice = decrementTurnEndTimers(tickedOnce, opponent, nowMs, false);
    const nextState: ServerMatchState = {
      ...tickedTwice,
      turn: {
        turnNumber: tickedTwice.turn.turnNumber + 1,
        activePlayer: currentActor,
        remainingActions: 1,
        doubleActionActive: false,
        isBonusTurn: false,
        bonusTurnReason: null,
        rageUsedThisTurn: false,
        eliminatedEnemyIdsThisTurn: [],
        pendingCavalierJumpPieceId: null,
        pendingBerserkerRagePieceId: null,
        pendingPromotionPieceId: null,
        nextOpponentActionsOverride: null,
        skipOpponentNextTurn: false,
      },
    };
    return evaluatePostTurnTransitionConditions(nextState, nowMs);
  }

  // Normal transition to opponent (0 or 1 elimination -> strictly 1 action)
  const ticked = decrementTurnEndTimers(state, currentActor, nowMs, false);
  const opponentActions = 1;

  const clockSwitch = switchTurnClock(ticked.clock, opponent, nowMs);
  if (clockSwitch.timedOutPlayer !== null) {
    return {
      ...ticked,
      phase: 'finished',
      clock: clockSwitch.state,
      winner: clockSwitch.winnerByTimeout,
      outcomeReason: 'clock_timeout',
    };
  }

  const nextState: ServerMatchState = {
    ...ticked,
    clock: clockSwitch.state,
    turn: {
      turnNumber: ticked.turn.turnNumber + 1,
      activePlayer: opponent,
      remainingActions: opponentActions,
      doubleActionActive: false,
      isBonusTurn: false,
      bonusTurnReason: null,
      rageUsedThisTurn: false,
      eliminatedEnemyIdsThisTurn: [],
      pendingCavalierJumpPieceId: null,
      pendingBerserkerRagePieceId: null,
      pendingPromotionPieceId: null,
      nextOpponentActionsOverride: null,
      skipOpponentNextTurn: false,
    },
  };

  return evaluatePostTurnTransitionConditions(nextState, nowMs);
}

function evaluatePostTurnTransitionConditions(
  state: ServerMatchState,
  nowMs: number,
): ServerMatchState {
  if (state.phase !== 'playing') {
    return state;
  }

  // 1. Repetition tracking (Q27: warning at 3, automatic draw at 5)
  const sig = computeBoardSignature(state);
  const nextCount = (state.positionCounts[sig] ?? 0) + 1;
  const nextPositionCounts = {
    ...state.positionCounts,
    [sig]: nextCount,
  };
  const maxSeen = Math.max(state.maxRepetitionCountSeen, nextCount);
  const warningActive = state.repetitionWarningActive || nextCount >= REPETITION_WARNING_THRESHOLD;

  let updated: ServerMatchState = {
    ...state,
    positionCounts: nextPositionCounts,
    maxRepetitionCountSeen: maxSeen,
    repetitionWarningActive: warningActive,
  };

  if (nextCount >= REPETITION_DRAW_THRESHOLD) {
    return {
      ...updated,
      phase: 'finished',
      winner: 'draw',
      outcomeReason: 'fivefold_repetition',
      actionLog: appendLog(
        updated,
        updated.turn.activePlayer,
        'Match nul automatique : 5 répétitions de la même configuration.',
        'Match nul automatique : 5 répétitions de la même configuration.',
        nowMs,
      ),
    };
  }

  // 2. Stalemate / Pat check (Q29: no legal move AND no playable card)
  if (isPlayerInStalemate(updated, updated.turn.activePlayer)) {
    return {
      ...updated,
      phase: 'finished',
      winner: 'draw',
      outcomeReason: 'stalemate',
      actionLog: appendLog(
        updated,
        updated.turn.activePlayer,
        'Match nul par Pat : aucun déplacement ni carte jouable disponible.',
        'Match nul par Pat : aucun déplacement ni carte jouable disponible.',
        nowMs,
      ),
    };
  }

  return updated;
}

/**
 * Execute a piece movement or attack action (`normal_move`, `capture_move`, or `cavalier_jump`) (§6, §7, §10).
 */
export function executePieceMove(
  state: ServerMatchState,
  playerColor: PlayerColor,
  pieceId: string,
  destination: Coord,
  nowMs: number = Date.now(),
  randomFn: () => number = Math.random,
  preferredKind?: MoveCandidateKind,
): ServerMatchState {
  if (state.phase !== 'playing') {
    throw new Error(`La partie n'est pas en cours.`);
  }
  if (state.turn.activePlayer !== playerColor) {
    throw new Error(`Ce n'est pas le tour de ${playerColor}.`);
  }
  if (state.turn.pendingPromotionPieceId !== null) {
    throw new Error(`Une promotion de Soldat est en attente de sélection.`);
  }

  if (Object.keys(state.positionCounts).length === 0) {
    const initialSig = computeBoardSignature(state);
    state = {
      ...state,
      positionCounts: { [initialSig]: 1 },
    };
  }

  const isRageMove = state.turn.pendingBerserkerRagePieceId !== null;
  if (isRageMove && state.turn.pendingBerserkerRagePieceId !== pieceId) {
    throw new Error(`Seul le Berserker en Rage (${state.turn.pendingBerserkerRagePieceId}) peut effectuer ce second déplacement.`);
  }

  const isJumpChainContinuation = state.turn.pendingCavalierJumpPieceId !== null;
  if (isJumpChainContinuation && state.turn.pendingCavalierJumpPieceId !== pieceId) {
    throw new Error(`Seul le Cavalier en cours d'enchaînement (${state.turn.pendingCavalierJumpPieceId}) peut continuer à sauter.`);
  }

  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece || !piece.alive || piece.position === null) {
    throw new Error(`Pièce introuvable ou éliminée.`);
  }
  if (piece.owner !== playerColor) {
    throw new Error(`Vous ne contrôlez pas cette pièce.`);
  }

  const ownerVis = buildVisibilityContext(state, playerColor);
  const opponentColor = getOpponentColor(playerColor);
  const opponentVis = buildVisibilityContext(state, opponentColor);

  const candidates = isJumpChainContinuation
    ? generateCavalierJumpCandidates(piece, state.pieces, ownerVis)
    : generateMoveCandidatesForPiece(piece, state.pieces, ownerVis, isRageMove);

  const chosen = preferredKind
    ? candidates.find(
        (c) =>
          c.to.row === destination.row &&
          c.to.col === destination.col &&
          c.kind === preferredKind,
      )
    : candidates.find((c) => c.to.row === destination.row && c.to.col === destination.col);
  if (!chosen) {
    throw new Error(
      `Déplacement illégal de ${coordToNotation(piece.position)} vers ${coordToNotation(destination)}.`,
    );
  }

  const fromNotation = coordToNotation(piece.position);
  const toNotation = coordToNotation(destination);
  const orthogonalDist =
    Math.abs(destination.row - piece.position.row) +
    Math.abs(destination.col - piece.position.col);

  // Case A: Simple movement onto an empty square
  if (chosen.kind === 'normal_move') {
    const usedTraqueurPursuit = piece.character === 'traqueur' && orthogonalDist === 4;
    let movedPiece: ServerPieceRecord = {
      ...piece,
      position: destination,
      traqueurMarkedTargetId: usedTraqueurPursuit ? null : piece.traqueurMarkedTargetId ?? null,
      traqueurPursuitReady: usedTraqueurPursuit ? false : piece.traqueurPursuitReady ?? false,
    };

    const colossusCheck = applyColossusEdgeReversalIfNeeded(movedPiece);
    movedPiece = colossusCheck.updatedPiece;

    const trapCheck = checkAndApplyTrapAt(movedPiece, state.traps);
    movedPiece = trapCheck.updatedPiece;

    const updatedPieces = state.pieces.map((p) => (p.id === movedPiece.id ? movedPiece : p));

    // Check if Soldier reached opposite edge for promotion (§6.9)
    const triggersPromotion = shouldTriggerSoldierPromotion(movedPiece);

    const isCavalierLeap =
      piece.character === 'cavalier' &&
      Math.abs(destination.row - piece.position.row) *
        Math.abs(destination.col - piece.position.col) ===
        2;

    const nextActorPlayer =
      piece.character === 'traqueur'
        ? bumpPlayerNewStats(state.players[playerColor], {
            traqueurMoves: 1,
            traqueurPursuitsSucceeded: usedTraqueurPursuit ? 1 : 0,
          })
        : state.players[playerColor];

    const nextTurnState: TurnRuntimeState = {
      ...state.turn,
      pendingBerserkerRagePieceId: null,
      pendingPromotionPieceId: triggersPromotion ? movedPiece.id : null,
    };

    const nextSeq = state.actionLog.length + 1;
    const prevMove = state.lastMove ?? null;
    const nextLastMove: LastMoveInfo =
      isRageMove && prevMove && prevMove.actor === playerColor
        ? {
            seq: nextSeq,
            turnNumber: state.turn.turnNumber,
            actor: playerColor,
            kind: 'berserker_rage',
            from: prevMove.from,
            to: destination,
            eliminatedCoords: prevMove.eliminatedCoords,
            steps: [...prevMove.steps, { from: piece.position, to: destination }],
            triggeredTrapCoord: trapCheck.triggeredTrap
              ? destination
              : prevMove.triggeredTrapCoord ?? null,
            promotedAtCoord: triggersPromotion ? destination : null,
            blockedAtCoord: null,
            timestampMs: nowMs,
          }
        : {
            seq: nextSeq,
            turnNumber: state.turn.turnNumber,
            actor: playerColor,
            kind: isRageMove ? 'berserker_rage' : isCavalierLeap ? 'cavalier_leap' : 'normal_move',
            from: piece.position,
            to: destination,
            eliminatedCoords: [],
            steps: [{ from: piece.position, to: destination }],
            triggeredTrapCoord: trapCheck.triggeredTrap ? destination : null,
            promotedAtCoord: triggersPromotion ? destination : null,
            blockedAtCoord: null,
            timestampMs: nowMs,
          };

    const pursuitSuffixOwner = usedTraqueurPursuit ? ' (Poursuite du Traqueur)' : '';
    const moveVerb = isCavalierLeap ? 'Bond du Cavalier' : 'Déplacement';
    const updatedState = reconcileTraqueurMarks(
      {
        ...state,
        pieces: updatedPieces,
        players: {
          ...state.players,
          [playerColor]: nextActorPlayer,
        },
        traps: trapCheck.updatedTraps,
        turn: nextTurnState,
        lastMove: nextLastMove,
        actionLog: appendLog(
          state,
          playerColor,
          `${moveVerb} ${fromNotation} → ${toNotation}${pursuitSuffixOwner}${trapCheck.triggeredTrap ? ' (Piège déclenché !)' : ''}.`,
          `${moveVerb} ${fromNotation} → ${toNotation}${trapCheck.triggeredTrap ? ' (Piège déclenché !)' : ''}.`,
          nowMs,
          {
            eventType: trapCheck.triggeredTrap ? 'EFFECT_ACTIVATED' : 'PIECE_MOVED',
            icon: isRageMove ? 'RAGE' : trapCheck.triggeredTrap ? 'PIEG' : usedTraqueurPursuit ? 'TRQ' : isCavalierLeap ? 'SAUT' : 'DEPL',
          },
        ),
      },
      nowMs,
    );

    return advanceTurnOrSubAction(updatedState, 1, nowMs);
  }

  // Case B: Direct capture attempt
  if (chosen.kind === 'capture_move') {
    const defender = state.pieces.find((p) => p.id === chosen.targetEnemyPieceId);
    if (!defender) {
      throw new Error(`Cible d'attaque introuvable.`);
    }

    const combat = resolveDirectCapture(piece, defender, ownerVis, opponentVis);
    const usedTraqueurPursuit =
      combat.defenderEliminated && piece.character === 'traqueur' && orthogonalDist === 4;

    let finalAttacker: ServerPieceRecord = usedTraqueurPursuit
      ? {
          ...combat.updatedAttacker,
          traqueurMarkedTargetId: null,
          traqueurPursuitReady: false,
        }
      : combat.updatedAttacker;
    let updatedTraps = state.traps;
    let trapTriggeredOnCapture = false;
    if (combat.defenderEliminated && finalAttacker.alive) {
      const trapCheck = checkAndApplyTrapAt(finalAttacker, state.traps);
      finalAttacker = trapCheck.updatedPiece;
      updatedTraps = trapCheck.updatedTraps;
      trapTriggeredOnCapture = trapCheck.triggeredTrap !== null;
    }

    const updatedPieces = state.pieces.map((p) => {
      if (p.id === finalAttacker.id) {
        return finalAttacker;
      }
      if (p.id === combat.updatedDefender.id) {
        return combat.updatedDefender;
      }
      return p;
    });

    const killCountForActor = combat.defenderEliminated ? 1 : 0;
    const colossusKilledByKamikaze =
      combat.attackerEliminatedByKamikaze && piece.character === 'colosse';
    const colossusSurvivedKamikaze =
      combat.defenderEliminated &&
      defender.hasKamikaze &&
      piece.character === 'colosse' &&
      !combat.attackerEliminatedByKamikaze;

    let updatedActorPlayer = awardEliminationsAndCards(
      state.players[playerColor],
      killCountForActor,
      state.ruleset,
      randomFn,
      state.turn.turnNumber,
      nowMs,
    );
    updatedActorPlayer = bumpPlayerNewStats(updatedActorPlayer, {
      traqueurMoves: piece.character === 'traqueur' ? 1 : 0,
      traqueurPursuitsSucceeded: usedTraqueurPursuit ? 1 : 0,
      traqueurEliminations:
        piece.character === 'traqueur' && combat.defenderEliminated ? 1 : 0,
      executeurEliminations:
        piece.character === 'executeur' && combat.defenderEliminated ? 1 : 0,
    });

    let updatedOpponentPlayer = combat.attackerEliminatedByKamikaze
      ? awardEliminationsAndCards(
          state.players[opponentColor],
          1,
          state.ruleset,
          randomFn,
          state.turn.turnNumber,
          nowMs,
        )
      : state.players[opponentColor];
    if (colossusKilledByKamikaze) {
      updatedOpponentPlayer = bumpPlayerNewStats(updatedOpponentPlayer, {
        colossiEliminatedByKamikaze: 1,
      });
    }

    const updatedPlayers: Record<PlayerColor, PlayerRuntimeState> = {
      ...state.players,
      [playerColor]: updatedActorPlayer,
      [opponentColor]: updatedOpponentPlayer,
    };

    const nextGraveyard = [...state.graveyard, ...combat.graveyardEntriesCreated];
    const nextSeq = state.actionLog.length + 1;
    const isCavalierLeap =
      piece.character === 'cavalier' &&
      Math.abs(destination.row - piece.position.row) *
        Math.abs(destination.col - piece.position.col) ===
        2;
    const captureLastMove: LastMoveInfo = {
      seq: nextSeq,
      turnNumber: state.turn.turnNumber,
      actor: playerColor,
      kind: combat.defenderEliminated
        ? isCavalierLeap
          ? 'cavalier_leap'
          : 'capture_move'
        : 'attack_blocked',
      from: piece.position,
      to: combat.defenderEliminated ? destination : piece.position,
      eliminatedCoords: combat.defenderEliminated ? [destination] : [],
      steps: [
        {
          from: piece.position,
          to: destination,
          capturedCoord: combat.defenderEliminated ? destination : null,
        },
      ],
      triggeredTrapCoord: trapTriggeredOnCapture ? destination : null,
      promotedAtCoord: null,
      blockedAtCoord: !combat.defenderEliminated ? destination : null,
      timestampMs: nowMs,
    };

    // Check immediate King elimination victory (§6.4, §7, §14)
    if (combat.kingEliminatedColor !== null) {
      const winnerColor = getOpponentColor(combat.kingEliminatedColor);
      return reconcileTraqueurMarks(
        {
          ...state,
          phase: 'finished',
          pieces: updatedPieces,
          traps: updatedTraps,
          graveyard: nextGraveyard,
          players: updatedPlayers,
          winner: winnerColor,
          outcomeReason: 'king_eliminated',
          lastMove: captureLastMove,
          actionLog: appendLog(
            state,
            playerColor,
            `Le Roi ${combat.kingEliminatedColor === 'red' ? 'Rouge' : 'Noir'} a été éliminé ! Victoire de ${winnerColor === 'red' ? 'Rouge' : 'Noir'}.`,
            `Le Roi ${combat.kingEliminatedColor === 'red' ? 'Rouge' : 'Noir'} a été éliminé ! Victoire de ${winnerColor === 'red' ? 'Rouge' : 'Noir'}.`,
            nowMs,
            { eventType: 'GAME_ENDED', icon: '👑' },
          ),
        },
        nowMs,
      );
    }

    // Check Berserker Rage trigger (§6.8): 1x per turn max, only if Berserker survived and isn't immobilized
    let pendingBerserkerRagePieceId: string | null = null;
    let rageUsedThisTurn = state.turn.rageUsedThisTurn;
    if (
      piece.character === 'berserker' &&
      combat.defenderEliminated &&
      finalAttacker.alive &&
      finalAttacker.immobilizedTicksRemaining === 0 &&
      !state.turn.rageUsedThisTurn
    ) {
      const rageMoves = generateMoveCandidatesForPiece(finalAttacker, updatedPieces, ownerVis, true);
      if (rageMoves.length > 0) {
        pendingBerserkerRagePieceId = finalAttacker.id;
        rageUsedThisTurn = true;
      }
    }

    const triggersPromotion =
      combat.defenderEliminated && finalAttacker.alive && shouldTriggerSoldierPromotion(finalAttacker);

    const nextEliminatedIds = combat.defenderEliminated
      ? recordUniqueEliminatedEnemy(state.turn.eliminatedEnemyIdsThisTurn, defender, playerColor)
      : state.turn.eliminatedEnemyIdsThisTurn;

    const kamikazeColossusSuffix = colossusKilledByKamikaze
      ? ` Le ${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}e déclenchement de Kamikaze a éliminé le Colosse !`
      : colossusSurvivedKamikaze
        ? ` Le Colosse a résisté au 1er déclenchement de Kamikaze (${finalAttacker.kamikazeHitsTaken}/${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}).`
        : '';

    const attackVerb = isCavalierLeap ? 'Bond offensif du Cavalier' : 'Attaque';
    const updatedState = reconcileTraqueurMarks(
      {
        ...state,
        pieces: updatedPieces,
        traps: updatedTraps,
        graveyard: nextGraveyard,
        players: updatedPlayers,
        lastMove: triggersPromotion
          ? { ...captureLastMove, promotedAtCoord: destination }
          : captureLastMove,
        turn: {
          ...state.turn,
          rageUsedThisTurn,
          pendingBerserkerRagePieceId,
          pendingPromotionPieceId: triggersPromotion ? finalAttacker.id : null,
          eliminatedEnemyIdsThisTurn: nextEliminatedIds,
        },
        actionLog: appendLog(
          state,
          playerColor,
          combat.attackBlockedByColossusImmunity
            ? `Attaque sur ${toNotation} repoussée par un Colosse (révélé temporairement) !`
            : combat.attackBlockedByInvincibility
              ? `Attaque sur ${toNotation} bloquée par une Invincibilité !`
              : combat.attackBlockedByProtection
                ? `Attaque sur ${toNotation} bloquée par une Protection !`
                : `${attackVerb} ${fromNotation} × ${toNotation}${usedTraqueurPursuit ? ' (Poursuite)' : ''} : pièce éliminée.${kamikazeColossusSuffix}`,
          combat.attackBlockedByColossusImmunity
            ? `Attaque sur ${toNotation} repoussée par le Colosse !`
            : combat.attackBlockedByInvincibility
              ? `Attaque sur ${toNotation} bloquée par votre Invincibilité !`
              : combat.attackBlockedByProtection
                ? `Attaque sur ${toNotation} bloquée par une Protection !`
                : `${attackVerb} ${fromNotation} × ${toNotation} : pièce éliminée.${kamikazeColossusSuffix}`,
          nowMs,
          {
            eventType: combat.colossusTemporarilyRevealed
              ? 'PIECE_REVEALED'
              : combat.defenderEliminated
                ? 'PIECE_CAPTURED'
                : 'EFFECT_ACTIVATED',
            icon: combat.defenderEliminated ? 'ELIM' : 'PRO',
          },
        ),
      },
      nowMs,
    );

    return advanceTurnOrSubAction(updatedState, 1, nowMs);
  }

  // Case P: Exécuteur Frappe traversante (§4.3–4.6 & clarification A1: Exécuteur reste sur sa case de départ)
  if (chosen.kind === 'piercing_strike') {
    const intermediate = state.pieces.find((p) => p.id === chosen.passedThroughEnemyPieceId);
    const target = state.pieces.find((p) => p.id === chosen.targetEnemyPieceId);
    if (!intermediate || intermediate.position === null || !target || target.position === null) {
      throw new Error(`Cibles de Frappe traversante introuvables.`);
    }

    const combat = resolvePiercingStrike(piece, intermediate, target, ownerVis, opponentVis);

    const updatedPieces = state.pieces.map((p) => {
      if (p.id === combat.updatedAttacker.id) return combat.updatedAttacker;
      if (p.id === combat.updatedIntermediate.id) return combat.updatedIntermediate;
      if (p.id === combat.updatedTarget.id) return combat.updatedTarget;
      return p;
    });

    let updatedActorPlayer = awardEliminationsAndCards(
      state.players[playerColor],
      combat.targetEliminated ? 1 : 0,
      state.ruleset,
      randomFn,
      state.turn.turnNumber,
      nowMs,
    );
    updatedActorPlayer = bumpPlayerNewStats(updatedActorPlayer, {
      executeurPiercingStrikes: combat.intermediateColossusInterrupted ? 0 : 1,
      executeurEliminations: combat.targetEliminated ? 1 : 0,
    });

    const updatedOpponentPlayer = combat.attackerEliminatedByKamikaze
      ? awardEliminationsAndCards(
          state.players[opponentColor],
          1,
          state.ruleset,
          randomFn,
          state.turn.turnNumber,
          nowMs,
        )
      : state.players[opponentColor];

    const updatedPlayers: Record<PlayerColor, PlayerRuntimeState> = {
      ...state.players,
      [playerColor]: updatedActorPlayer,
      [opponentColor]: updatedOpponentPlayer,
    };

    const nextGraveyard = [...state.graveyard, ...combat.graveyardEntriesCreated];
    const nextSeq = state.actionLog.length + 1;
    const piercingLastMove: LastMoveInfo = {
      seq: nextSeq,
      turnNumber: state.turn.turnNumber,
      actor: playerColor,
      kind: combat.targetEliminated ? 'piercing_strike' : 'attack_blocked',
      from: piece.position,
      to: piece.position,
      eliminatedCoords: combat.targetEliminated ? [destination] : [],
      passedThroughCoord: intermediate.position,
      steps: [
        {
          from: piece.position,
          to: destination,
          capturedCoord: combat.targetEliminated ? destination : null,
        },
      ],
      triggeredTrapCoord: null,
      promotedAtCoord: null,
      blockedAtCoord: !combat.targetEliminated ? destination : null,
      timestampMs: nowMs,
    };

    if (combat.kingEliminatedColor !== null) {
      const winnerColor = getOpponentColor(combat.kingEliminatedColor);
      return reconcileTraqueurMarks(
        {
          ...state,
          phase: 'finished',
          pieces: updatedPieces,
          graveyard: nextGraveyard,
          players: updatedPlayers,
          winner: winnerColor,
          outcomeReason: 'king_eliminated',
          lastMove: piercingLastMove,
          actionLog: appendLog(
            state,
            playerColor,
            `Frappe traversante de l'Exécuteur (${fromNotation} ↠ ${toNotation}) : le Roi ${combat.kingEliminatedColor === 'red' ? 'Rouge' : 'Noir'} est éliminé !`,
            `Frappe traversante de l'Exécuteur (${fromNotation} ↠ ${toNotation}) : le Roi est éliminé !`,
            nowMs,
            { eventType: 'GAME_ENDED', icon: '👑' },
          ),
        },
        nowMs,
      );
    }

    const interNotation = coordToNotation(intermediate.position);
    const nextEliminatedIds = combat.targetEliminated
      ? recordUniqueEliminatedEnemy(state.turn.eliminatedEnemyIdsThisTurn, target, playerColor)
      : state.turn.eliminatedEnemyIdsThisTurn;
    const updatedState = reconcileTraqueurMarks(
      {
        ...state,
        pieces: updatedPieces,
        graveyard: nextGraveyard,
        players: updatedPlayers,
        lastMove: piercingLastMove,
        turn: {
          ...state.turn,
          eliminatedEnemyIdsThisTurn: nextEliminatedIds,
        },
        actionLog: appendLog(
          state,
          playerColor,
          combat.intermediateColossusInterrupted
            ? `Frappe traversante impossible : la pièce intermédiaire en ${interNotation} est un Colosse (révélé temporairement).`
            : combat.attackBlockedByInvincibility
              ? `Frappe traversante vers ${toNotation} bloquée par une Invincibilité !`
              : combat.attackBlockedByProtection
                ? `Frappe traversante vers ${toNotation} bloquée par une Protection !`
                : `L'Exécuteur utilise Frappe traversante (${fromNotation} → ${toNotation}, pièce en ${interNotation} intacte) : cible éliminée.`,
          combat.intermediateColossusInterrupted
            ? `Frappe traversante interrompue par votre Colosse en ${interNotation} !`
            : combat.attackBlockedByInvincibility
              ? `Frappe traversante vers ${toNotation} bloquée par votre Invincibilité !`
              : combat.attackBlockedByProtection
                ? `Frappe traversante vers ${toNotation} bloquée par une Protection !`
                : `L'Exécuteur a choisi la cible en ${toNotation} derrière votre pièce en ${interNotation}.`,
          nowMs,
          {
            eventType: combat.intermediateColossusInterrupted
              ? 'PIECE_REVEALED'
              : combat.targetEliminated
                ? 'PIECE_CAPTURED'
                : 'EFFECT_ACTIVATED',
            icon: combat.targetEliminated ? 'FRAP' : 'PRO',
          },
        ),
      },
      nowMs,
    );

    return advanceTurnOrSubAction(updatedState, 1, nowMs);
  }

  // Case X: Arbalétrier Tir d'arbalète (§5.3–5.6: ne déplace pas l'Arbalétrier, déclenche la récupération, secret sur cible inconnue)
  if (chosen.kind === 'crossbow_shot') {
    if ((piece.arbaletrierCooldownTurnsRemaining ?? 0) > 0) {
      throw new Error(`L'Arbalétrier doit attendre avant de tirer à nouveau.`);
    }
    const target = state.pieces.find((p) => p.id === chosen.targetEnemyPieceId);
    if (!target || target.position === null) {
      throw new Error(`Cible du tir introuvable.`);
    }

    const combat = resolveCrossbowShot(piece, target, ownerVis, opponentVis);
    // Cadence 1 tir tous les 3 tours personnels : déclenche 3 => reste 3 pendant Double action pour interdire un 2e tir, puis 2 à la fin du tour 1 (Tour 2 = 2, Tour 3 = 1, Tour 4 = 0)
    const cooledAttacker: ServerPieceRecord = {
      ...combat.updatedAttacker,
      arbaletrierCooldownTurnsRemaining: 3,
    };

    const updatedPieces = state.pieces.map((p) => {
      if (p.id === cooledAttacker.id) return cooledAttacker;
      if (p.id === combat.updatedTarget.id) return combat.updatedTarget;
      return p;
    });

    let updatedActorPlayer = awardEliminationsAndCards(
      state.players[playerColor],
      combat.targetEliminated ? 1 : 0,
      state.ruleset,
      randomFn,
      state.turn.turnNumber,
      nowMs,
    );
    updatedActorPlayer = bumpPlayerNewStats(updatedActorPlayer, {
      arbaletrierShotsTotal: 1,
      arbaletrierShotsSucceeded: combat.targetEliminated ? 1 : 0,
      arbaletrierShotsBlocked: combat.targetEliminated ? 0 : 1,
    });

    const updatedOpponentPlayer = combat.attackerEliminatedByKamikaze
      ? awardEliminationsAndCards(
          state.players[opponentColor],
          1,
          state.ruleset,
          randomFn,
          state.turn.turnNumber,
          nowMs,
        )
      : state.players[opponentColor];

    const updatedPlayers: Record<PlayerColor, PlayerRuntimeState> = {
      ...state.players,
      [playerColor]: updatedActorPlayer,
      [opponentColor]: updatedOpponentPlayer,
    };

    const nextGraveyard = [...state.graveyard, ...combat.graveyardEntriesCreated];
    const nextSeq = state.actionLog.length + 1;
    const shotLastMove: LastMoveInfo = {
      seq: nextSeq,
      turnNumber: state.turn.turnNumber,
      actor: playerColor,
      kind: combat.targetEliminated ? 'crossbow_shot' : 'attack_blocked',
      from: piece.position,
      to: piece.position,
      eliminatedCoords: combat.targetEliminated ? [destination] : [],
      steps: [
        {
          from: piece.position,
          to: destination,
          capturedCoord: combat.targetEliminated ? destination : null,
        },
      ],
      triggeredTrapCoord: null,
      promotedAtCoord: null,
      blockedAtCoord: !combat.targetEliminated ? destination : null,
      timestampMs: nowMs,
    };

    if (combat.kingEliminatedColor !== null) {
      const winnerColor = getOpponentColor(combat.kingEliminatedColor);
      return reconcileTraqueurMarks(
        {
          ...state,
          phase: 'finished',
          pieces: updatedPieces,
          graveyard: nextGraveyard,
          players: updatedPlayers,
          winner: winnerColor,
          outcomeReason: 'king_eliminated',
          lastMove: shotLastMove,
          actionLog: appendLog(
            state,
            playerColor,
            `Tir d'arbalète (${fromNotation} 🏹 ${toNotation}) : le Roi ${combat.kingEliminatedColor === 'red' ? 'Rouge' : 'Noir'} est éliminé !`,
            `Tir d'arbalète (${fromNotation} 🏹 ${toNotation}) : le Roi est éliminé !`,
            nowMs,
            { eventType: 'GAME_ENDED', icon: '👑' },
          ),
        },
        nowMs,
      );
    }

    const blockedShot = !combat.targetEliminated;
    const nextEliminatedIds = combat.targetEliminated
      ? recordUniqueEliminatedEnemy(state.turn.eliminatedEnemyIdsThisTurn, target, playerColor)
      : state.turn.eliminatedEnemyIdsThisTurn;
    const updatedState = reconcileTraqueurMarks(
      {
        ...state,
        pieces: updatedPieces,
        graveyard: nextGraveyard,
        players: updatedPlayers,
        lastMove: shotLastMove,
        turn: {
          ...state.turn,
          eliminatedEnemyIdsThisTurn: nextEliminatedIds,
        },
        actionLog: appendLog(
          state,
          playerColor,
          blockedShot
            ? `Tir de l'Arbalétrier (${fromNotation} → ${toNotation}) bloqué. Le tir n'a pas révélé l'identité de la cible (recharge : 3 tours).`
            : `L'Arbalétrier (${fromNotation}) a effectué un tir sur ${toNotation} : cible éliminée (recharge : 3 tours).`,
          blockedShot
            ? `Tir de l'Arbalétrier (${fromNotation} → ${toNotation}) bloqué (l'identité reste secrète).`
            : `L'Arbalétrier a effectué un tir sur ${toNotation} : pièce éliminée.`,
          nowMs,
          {
            eventType: combat.targetEliminated ? 'PIECE_CAPTURED' : 'EFFECT_ACTIVATED',
            icon: combat.targetEliminated ? 'TIR' : 'PRO',
          },
        ),
      },
      nowMs,
    );

    return advanceTurnOrSubAction(updatedState, 1, nowMs);
  }

  // Case C: Cavalier special jump attack (§6.5, Contradiction #2, Q9)
  const jumpedPiece = state.pieces.find((p) => p.id === chosen.targetEnemyPieceId);
  if (!jumpedPiece || jumpedPiece.position === null) {
    throw new Error(`Pièce sautée introuvable.`);
  }
  const jumpedCoord = jumpedPiece.position;

  const jumpResult = resolveCavalierSingleJump(
    piece,
    jumpedPiece,
    destination,
    ownerVis,
    opponentVis,
  );

  let finalCavalier = jumpResult.updatedCavalier;
  let updatedTraps = state.traps;
  let trapTriggered = false;

  if (jumpResult.jumpedPieceEliminated && finalCavalier.alive) {
    const trapCheck = checkAndApplyTrapAt(finalCavalier, state.traps);
    finalCavalier = trapCheck.updatedPiece;
    updatedTraps = trapCheck.updatedTraps;
    trapTriggered = trapCheck.triggeredTrap !== null;
  }

  const updatedPieces = state.pieces.map((p) => {
    if (p.id === finalCavalier.id) {
      return finalCavalier;
    }
    if (p.id === jumpResult.updatedJumpedPiece.id) {
      return jumpResult.updatedJumpedPiece;
    }
    return p;
  });

  const killCountForActor = jumpResult.jumpedPieceEliminated ? 1 : 0;
  const updatedActorPlayer = awardEliminationsAndCards(
    state.players[playerColor],
    killCountForActor,
    state.ruleset,
    randomFn,
    state.turn.turnNumber,
    nowMs,
  );
  const updatedOpponentPlayer = jumpResult.cavalierEliminatedByKamikaze
    ? awardEliminationsAndCards(
        state.players[opponentColor],
        1,
        state.ruleset,
        randomFn,
        state.turn.turnNumber,
        nowMs,
      )
    : state.players[opponentColor];

  const updatedPlayers: Record<PlayerColor, PlayerRuntimeState> = {
    ...state.players,
    [playerColor]: updatedActorPlayer,
    [opponentColor]: updatedOpponentPlayer,
  };

  const nextGraveyard = [...state.graveyard, ...jumpResult.graveyardEntriesCreated];
  const nextSeq = state.actionLog.length + 1;
  const prevJumpMove = state.lastMove ?? null;
  const jumpLanding = jumpResult.jumpedPieceEliminated ? destination : piece.position;
  const jumpStep = {
    from: piece.position,
    to: jumpLanding,
    capturedCoord: jumpResult.jumpedPieceEliminated ? jumpedCoord : null,
  };
  const jumpLastMove: LastMoveInfo =
    isJumpChainContinuation && prevJumpMove && prevJumpMove.actor === playerColor
      ? {
          seq: nextSeq,
          turnNumber: state.turn.turnNumber,
          actor: playerColor,
          kind: 'cavalier_jump',
          from: prevJumpMove.from,
          to: jumpLanding,
          eliminatedCoords: jumpResult.jumpedPieceEliminated
            ? [...prevJumpMove.eliminatedCoords, jumpedCoord]
            : prevJumpMove.eliminatedCoords,
          steps: [...prevJumpMove.steps, jumpStep],
          triggeredTrapCoord: trapTriggered
            ? destination
            : prevJumpMove.triggeredTrapCoord ?? null,
          promotedAtCoord: null,
          blockedAtCoord: !jumpResult.jumpedPieceEliminated ? jumpedCoord : null,
          timestampMs: nowMs,
        }
      : {
          seq: nextSeq,
          turnNumber: state.turn.turnNumber,
          actor: playerColor,
          kind: jumpResult.jumpedPieceEliminated ? 'cavalier_jump' : 'attack_blocked',
          from: piece.position,
          to: jumpLanding,
          eliminatedCoords: jumpResult.jumpedPieceEliminated ? [jumpedCoord] : [],
          steps: [jumpStep],
          triggeredTrapCoord: trapTriggered ? destination : null,
          promotedAtCoord: null,
          blockedAtCoord: !jumpResult.jumpedPieceEliminated ? jumpedCoord : null,
          timestampMs: nowMs,
        };

  if (jumpResult.kingEliminatedColor !== null) {
    const winnerColor = getOpponentColor(jumpResult.kingEliminatedColor);
    return reconcileTraqueurMarks(
      {
        ...state,
        phase: 'finished',
        pieces: updatedPieces,
        traps: updatedTraps,
        graveyard: nextGraveyard,
        players: updatedPlayers,
        winner: winnerColor,
        outcomeReason: 'king_eliminated',
        lastMove: jumpLastMove,
        actionLog: appendLog(
          state,
          playerColor,
          `Saut du Cavalier ${fromNotation} → ${toNotation} : le Roi adverse est éliminé !`,
          `Saut du Cavalier ${fromNotation} → ${toNotation} : le Roi est éliminé !`,
          nowMs,
          { eventType: 'GAME_ENDED', icon: '👑' },
        ),
      },
      nowMs,
    );
  }

  const nextEliminatedIds = jumpResult.jumpedPieceEliminated
    ? recordUniqueEliminatedEnemy(state.turn.eliminatedEnemyIdsThisTurn, jumpedPiece, playerColor)
    : state.turn.eliminatedEnemyIdsThisTurn;

  // Check if another jump is available for optional chaining (§6.5, Contradiction #2)
  let nextPendingJumpPieceId: string | null = null;
  if (
    jumpResult.jumpedPieceEliminated &&
    !jumpResult.jumpInterrupted &&
    !trapTriggered &&
    finalCavalier.alive &&
    finalCavalier.immobilizedTicksRemaining === 0
  ) {
    const nextVis = buildVisibilityContext(
      { ...state, pieces: updatedPieces },
      playerColor,
    );
    const furtherJumps = generateCavalierJumpCandidates(finalCavalier, updatedPieces, nextVis);
    if (furtherJumps.length > 0) {
      nextPendingJumpPieceId = finalCavalier.id;
    }
  }

  const updatedState = reconcileTraqueurMarks(
    {
      ...state,
      pieces: updatedPieces,
      traps: updatedTraps,
      graveyard: nextGraveyard,
      players: updatedPlayers,
      lastMove: jumpLastMove,
      turn: {
        ...state.turn,
        pendingCavalierJumpPieceId: nextPendingJumpPieceId,
        eliminatedEnemyIdsThisTurn: nextEliminatedIds,
      },
      actionLog: appendLog(
        state,
        playerColor,
        jumpResult.interruptedByColossus
          ? `Saut du Cavalier interrompu par un Colosse (révélé temporairement) !`
          : jumpResult.interruptedByInvincibility
            ? `Saut du Cavalier interrompu par une Invincibilité !`
            : jumpResult.interruptedByProtection
              ? `Saut du Cavalier interrompu par une Protection !`
              : `Saut du Cavalier ${fromNotation} → ${toNotation} : pièce ennemie éliminée.`,
        jumpResult.interruptedByColossus
          ? `Saut du Cavalier interrompu par le Colosse !`
          : jumpResult.interruptedByInvincibility
            ? `Saut du Cavalier interrompu par votre Invincibilité !`
            : jumpResult.interruptedByProtection
              ? `Saut du Cavalier interrompu par une Protection !`
              : `Saut du Cavalier ${fromNotation} → ${toNotation} : pièce éliminée.`,
        nowMs,
        {
          eventType: jumpResult.jumpedPieceEliminated ? 'PIECE_CAPTURED' : 'EFFECT_ACTIVATED',
          icon: 'SAUT',
        },
      ),
    },
    nowMs,
  );

  if (nextPendingJumpPieceId !== null) {
    return updatedState;
  }

  return advanceTurnOrSubAction(updatedState, 1, nowMs);
}

/**
 * Stop an ongoing Cavalier jump chain voluntarily (§6.5: "Les sauts successifs sont facultatifs").
 */
export function stopCavalierJumpChain(
  state: ServerMatchState,
  playerColor: PlayerColor,
  nowMs: number = Date.now(),
): ServerMatchState {
  if (state.phase !== 'playing' || state.turn.activePlayer !== playerColor) {
    throw new Error(`Action non autorisée.`);
  }
  if (state.turn.pendingCavalierJumpPieceId === null) {
    throw new Error(`Aucun enchaînement de saut du Cavalier en cours.`);
  }

  const clearedState: ServerMatchState = {
    ...state,
    turn: {
      ...state.turn,
      pendingCavalierJumpPieceId: null,
    },
  };

  return advanceTurnOrSubAction(clearedState, 1, nowMs);
}

/**
 * Skip the optional second move of Berserker Rage (§6.8: "Ce déplacement est facultatif").
 */
export function skipBerserkerRageMove(
  state: ServerMatchState,
  playerColor: PlayerColor,
  nowMs: number = Date.now(),
): ServerMatchState {
  if (state.phase !== 'playing' || state.turn.activePlayer !== playerColor) {
    throw new Error(`Action non autorisée.`);
  }
  if (state.turn.pendingBerserkerRagePieceId === null) {
    throw new Error(`Aucune Rage du Berserker en attente.`);
  }

  const clearedState: ServerMatchState = {
    ...state,
    turn: {
      ...state.turn,
      pendingBerserkerRagePieceId: null,
    },
  };

  return advanceTurnOrSubAction(clearedState, 1, nowMs);
}

/**
 * Select the promoted character for a Soldier that reached the opposite edge (§6.9, Q4).
 */
export function selectSoldierPromotion(
  state: ServerMatchState,
  playerColor: PlayerColor,
  chosenCharacter: CharacterType,
  nowMs: number = Date.now(),
): ServerMatchState {
  if (state.phase !== 'playing' || state.turn.activePlayer !== playerColor) {
    throw new Error(`Action non autorisée.`);
  }
  const soldierId = state.turn.pendingPromotionPieceId;
  if (soldierId === null) {
    throw new Error(`Aucune promotion de Soldat en attente.`);
  }

  const soldier = state.pieces.find((p) => p.id === soldierId);
  if (!soldier || soldier.owner !== playerColor) {
    throw new Error(`Soldat à promouvoir introuvable.`);
  }

  const promoted = applySoldierPromotion(soldier, chosenCharacter, state.pieces);
  const updatedPieces = state.pieces.map((p) => (p.id === promoted.id ? promoted : p));
  const charName = CHARACTER_CATALOG[chosenCharacter].name;
  const promotedLastMove: LastMoveInfo | null =
    state.lastMove && soldier.position
      ? {
          ...state.lastMove,
          kind: 'promotion',
          promotedAtCoord: soldier.position,
        }
      : soldier.position
        ? {
            seq: state.actionLog.length + 1,
            turnNumber: state.turn.turnNumber,
            actor: playerColor,
            kind: 'promotion',
            from: soldier.position,
            to: soldier.position,
            eliminatedCoords: [],
            steps: [{ from: soldier.position, to: soldier.position }],
            promotedAtCoord: soldier.position,
            timestampMs: nowMs,
          }
        : null;

  const clearedState = reconcileTraqueurMarks(
    {
      ...state,
      pieces: updatedPieces,
      lastMove: promotedLastMove,
      turn: {
        ...state.turn,
        pendingPromotionPieceId: null,
      },
      actionLog: appendLog(
        state,
        playerColor,
        `Soldat promu en ${charName}.`,
        `Un Soldat adverse a été promu.`,
        nowMs,
        { eventType: 'EFFECT_ACTIVATED', icon: '🎖️' },
      ),
    },
    nowMs,
  );

  return advanceTurnOrSubAction(clearedState, 1, nowMs);
}

/**
 * Capacité spéciale du Traqueur : Marquage de cible (§3.3 & clarification A2).
 * - Coût d'action nul (n'utilise aucune action et ne termine pas le tour).
 * - Uniquement sur une pièce ennemie DÉJÀ révélée à distance orthogonale 1..3 sans obstacle.
 * - Ne révèle jamais une pièce inconnue. Remplace l'éventuelle cible précédente.
 * - Le bonus Poursuite (+1 déplacement = 4 cases) s'active au prochain tour du joueur.
 */
export function markTraqueurTarget(
  state: ServerMatchState,
  playerColor: PlayerColor,
  traqueurPieceId: string,
  targetEnemyPieceId: string,
  nowMs: number = Date.now(),
): ServerMatchState {
  if (state.phase !== 'playing') {
    throw new Error(`La partie n'est pas en cours.`);
  }
  if (state.turn.activePlayer !== playerColor) {
    throw new Error(`Ce n'est pas votre tour.`);
  }
  if (
    state.turn.pendingCavalierJumpPieceId !== null ||
    state.turn.pendingBerserkerRagePieceId !== null ||
    state.turn.pendingPromotionPieceId !== null
  ) {
    throw new Error(`Terminez d'abord l'action en cours.`);
  }

  const traqueur = state.pieces.find((p) => p.id === traqueurPieceId);
  if (!traqueur || !traqueur.alive || traqueur.owner !== playerColor || traqueur.position === null) {
    throw new Error(`Traqueur introuvable ou éliminé.`);
  }
  if (traqueur.character !== 'traqueur') {
    throw new Error(`Seul le Traqueur peut marquer une cible.`);
  }
  if (traqueur.immobilizedTicksRemaining > 0) {
    throw new Error(`Ce Traqueur est immobilisé par un piège et ne peut pas marquer pour l'instant.`);
  }

  const ownerVis = buildVisibilityContext(state, playerColor);
  const candidates = generateTraqueurMarkCandidates(traqueur, state.pieces, ownerVis);
  const target = candidates.find((c) => c.id === targetEnemyPieceId);
  if (!target || target.position === null) {
    throw new Error(
      `Cible de marquage invalide : la pièce ennemie doit être déjà révélée, alignée à 1–3 cases orthogonales et sans obstacle.`,
    );
  }
  if (traqueur.traqueurMarkedTargetId === target.id) {
    throw new Error(`Cette pièce ennemie est déjà marquée par votre Traqueur.`);
  }

  const isReplacement = Boolean(traqueur.traqueurMarkedTargetId);
  const fromNotation = coordToNotation(traqueur.position);
  const targetNotation = coordToNotation(target.position);

  const updatedPieces = state.pieces.map((p) =>
    p.id === traqueur.id
      ? {
          ...p,
          traqueurMarkedTargetId: target.id,
          traqueurPursuitReady: false,
        }
      : p,
  );

  const updatedPlayer = bumpPlayerNewStats(state.players[playerColor], {
    traqueurMarks: 1,
  });

  const ownerMsg = isReplacement
    ? `Le Traqueur a changé de cible (${fromNotation} 🎯 ${targetNotation}) : bonus Poursuite actif au prochain tour.`
    : `Le Traqueur a marqué une cible (${fromNotation} 🎯 ${targetNotation}) : bonus Poursuite actif au prochain tour.`;

  return {
    ...state,
    pieces: updatedPieces,
    players: {
      ...state.players,
      [playerColor]: updatedPlayer,
    },
    actionLog: appendLog(
      state,
      playerColor,
      playerColor === 'red' ? ownerMsg : '',
      playerColor === 'black' ? ownerMsg : '',
      nowMs,
      { eventType: 'EFFECT_ACTIVATED', icon: 'MARQ' },
    ),
  };
}

/**
 * Play one of the 16 official cards from the active player's hand (§8.1–§8.16, §9, §21, Q12–Q22).
 */
export function playCard(
  state: ServerMatchState,
  playerColor: PlayerColor,
  payload: CardPlayPayload,
  nowMs: number = Date.now(),
  randomFn: () => number = Math.random,
): ServerMatchState {
  if (!canPlayerPlayCard(state, playerColor, payload.card)) {
    throw new Error(`Impossible de jouer la carte "${payload.card}" dans l'état actuel.`);
  }

  const opponentColor = getOpponentColor(playerColor);
  const player = state.players[playerColor];
  const cardIdx = player.hand.indexOf(payload.card);
  if (cardIdx === -1) {
    throw new Error(`Vous ne possédez pas la carte "${payload.card}" en main.`);
  }

  const nextHand = player.hand.filter((_, idx) => idx !== cardIdx);
  let nextPlayerState: PlayerRuntimeState = {
    ...player,
    hand: nextHand,
  };
  let updatedOpponentState: PlayerRuntimeState = state.players[opponentColor];

  let nextPieces = [...state.pieces];
  let nextTraps = [...state.traps];
  let nextGraveyard = [...state.graveyard];
  let nextTurn = { ...state.turn };
  let totalTrapAlertsCount = state.totalTrapAlertsCount;
  let nextLastMove: LastMoveInfo | null = state.lastMove ?? null;
  const nextSeq = state.actionLog.length + 1;
  const cardMeta = CARD_CATALOG[payload.card];
  const visualMeta = CARD_VISUAL_META[payload.card];

  let logForOwner = `Carte jouée : ${cardMeta.name}.`;
  let logForOpponent = `🃏 Alerte Carte : L'adversaire a utilisé la carte ${cardMeta.name}.`;
  let shortDescOwner = cardMeta.description;
  let shortDescOpponent = `L'adversaire a utilisé la carte ${cardMeta.name}.`;
  let consequenceOwner = `Effet de ${cardMeta.name} activé.`;
  let consequenceOpponent = `Effet de ${cardMeta.name} actif.`;
  let visibleTargetOwner: string | null = null;
  let visibleTargetOpponent: string | null = null;

  switch (payload.card) {
    case 'kamikaze': {
      const target = nextPieces.find((p) => p.id === payload.targetPieceId);
      if (!target || !target.alive || target.owner !== playerColor || target.position === null) {
        throw new Error(`Pièce alliée cible invalide.`);
      }
      if (!isCardAllowedOnCharacter('kamikaze', target.character)) {
        throw new Error(
          `Kamikaze ne peut pas être joué sur ${CHARACTER_CATALOG[target.character].name} (interdit sur le Roi et le Colosse).`,
        );
      }
      if (target.hasKamikaze) {
        throw new Error(`Cette pièce possède déjà Kamikaze.`);
      }
      nextPieces = nextPieces.map((p) =>
        p.id === target.id ? { ...p, hasKamikaze: true } : p,
      );
      const posLabel = coordToNotation(target.position);
      logForOwner = `Carte jouée : Kamikaze sur votre pièce en ${posLabel}.`;
      logForOpponent = `🃏 Alerte Carte : L'adversaire a utilisé la carte Kamikaze (pion cible secret).`;
      shortDescOwner = `Vous avez attribué Kamikaze à votre pièce en ${posLabel}.`;
      shortDescOpponent = `L'adversaire a attribué la carte Kamikaze à une pièce.`;
      consequenceOwner = `Si cette pièce est éliminée, elle élimine aussi son attaquant.`;
      consequenceOpponent = `La pièce concernée reste secrète.`;
      visibleTargetOwner = posLabel;
      visibleTargetOpponent = null;
      break;
    }

    case 'invincibilite': {
      const target = nextPieces.find((p) => p.id === payload.targetPieceId);
      if (!target || !target.alive || target.owner !== playerColor || target.position === null) {
        throw new Error(`Pièce alliée cible invalide.`);
      }
      if (!isCardAllowedOnCharacter('invincibilite', target.character)) {
        throw new Error(
          `Invincibilité ne peut pas être jouée sur ${CHARACTER_CATALOG[target.character].name} (interdit sur le Roi et le Colosse).`,
        );
      }
      nextPieces = nextPieces.map((p) =>
        p.id === target.id ? { ...p, invincibleTicksRemaining: ONE_FULL_TURN_TICKS } : p,
      );
      const posLabel = coordToNotation(target.position);
      logForOwner = `Carte jouée : Invincibilité activée sur votre pièce en ${posLabel} (1 tour).`;
      logForOpponent = `🃏 Alerte Carte : L'adversaire a utilisé la carte Invincibilité (pion cible secret).`;
      shortDescOwner = `Votre pièce en ${posLabel} bénéficie de l'Invincibilité pendant 1 tour.`;
      shortDescOpponent = `Une pièce adverse bénéficie désormais de l'Invincibilité pendant un tour.`;
      consequenceOwner = `Toute attaque ou saut contre cette pièce échouera pendant 1 tour complet.`;
      consequenceOpponent = `La pièce concernée reste secrète (invulnérable pendant 1 tour).`;
      visibleTargetOwner = posLabel;
      visibleTargetOpponent = null;
      break;
    }

    case 'protection': {
      const target = nextPieces.find((p) => p.id === payload.targetPieceId);
      if (!target || !target.alive || target.owner !== playerColor || target.position === null) {
        throw new Error(`Pièce alliée cible invalide.`);
      }
      if (!isCardAllowedOnCharacter('protection', target.character)) {
        throw new Error(
          `Protection ne peut pas être jouée sur ${CHARACTER_CATALOG[target.character].name} (interdit sur le Roi et le Colosse).`,
        );
      }
      if (target.hasProtection) {
        throw new Error(`Cette pièce possède déjà une Protection.`);
      }
      nextPieces = nextPieces.map((p) =>
        p.id === target.id ? { ...p, hasProtection: true } : p,
      );
      const posLabel = coordToNotation(target.position);
      logForOwner = `Carte jouée : Protection sur votre pièce en ${posLabel}.`;
      logForOpponent = `🃏 Alerte Carte : L'adversaire a utilisé la carte Protection (pion cible secret).`;
      shortDescOwner = `Vous avez placé une Protection sur votre pièce en ${posLabel}.`;
      shortDescOpponent = `L'adversaire a attribué la carte Protection à une pièce.`;
      consequenceOwner = `Absorbe la première attaque ou explosion Kamikaze subie.`;
      consequenceOpponent = `La pièce concernée reste secrète.`;
      visibleTargetOwner = posLabel;
      visibleTargetOpponent = null;
      break;
    }

    case 'contre_espionnage': {
      const target = nextPieces.find((p) => p.id === payload.targetPieceId);
      if (!target || !target.alive || target.owner !== playerColor || target.position === null) {
        throw new Error(`Pièce alliée cible invalide.`);
      }
      const durationTicks = state.ruleset.counterEspionageDurationTurns * ONE_FULL_TURN_TICKS;
      nextPieces = nextPieces.map((p) =>
        p.id === target.id
          ? {
              ...p,
              counterEspionageTicksRemaining: durationTicks,
              tempRevealedTicksTo: {
                ...p.tempRevealedTicksTo,
                [opponentColor]: 0,
              },
            }
          : p,
      );
      const posLabel = coordToNotation(target.position);
      logForOwner = `Carte jouée : Contre-espionnage sur votre pièce en ${posLabel}.`;
      logForOpponent = `🃏 Alerte Carte : L'adversaire a utilisé la carte Contre-espionnage (pion cible secret).`;
      shortDescOwner = `Contre-espionnage actif sur votre pièce en ${posLabel} (${state.ruleset.counterEspionageDurationTurns} tours).`;
      shortDescOpponent = `L'adversaire a activé Contre-espionnage sur l'une de ses pièces.`;
      consequenceOwner = `Protège contre Révélation temporaire et les Guetteurs adverses.`;
      consequenceOpponent = `La pièce ciblée reste secrète (${state.ruleset.counterEspionageDurationTurns} tours).`;
      visibleTargetOwner = posLabel;
      visibleTargetOpponent = null;
      break;
    }

    case 'block': {
      if (player.blockCooldownTurnsRemaining > 0) {
        throw new Error(`Block est en temps de recharge (${player.blockCooldownTurnsRemaining} tour(s)).`);
      }
      nextTurn = {
        ...nextTurn,
        skipOpponentNextTurn: true,
      };
      // Cooldown of 2 turns (Q17): incremented by +1 because current turn-end will decrement 1
      nextPlayerState = {
        ...nextPlayerState,
        blockCooldownTurnsRemaining: state.ruleset.blockCooldownTurns + 1,
      };
      logForOwner = `Carte jouée : Block (le prochain tour de l'adversaire est bloqué).`;
      logForOpponent = `🃏 Alerte Carte : L'adversaire a utilisé la carte Block (votre prochain tour est sauté).`;
      shortDescOwner = `Vous bloquez le prochain tour complet de l'adversaire.`;
      shortDescOpponent = `L'adversaire a joué Block : votre prochain tour est bloqué.`;
      consequenceOwner = `Vous rejouez immédiatement après ce tour (recharge : 2 tours).`;
      consequenceOpponent = `Votre prochain tour est sauté — l'adversaire conserve la main.`;
      break;
    }

    case 'brouillard': {
      const fogTicks = BROUILLARD_DURATION_TURNS * ONE_FULL_TURN_TICKS;
      nextPlayerState = {
        ...nextPlayerState,
        fogTicksRemaining: fogTicks,
      };
      logForOwner = `Carte jouée : Brouillard activé pendant 3 tours (bloque toutes les révélations temporaires et les Guetteurs adverses).`;
      logForOpponent = `🃏 Alerte Carte : L'adversaire a utilisé la carte Brouillard pendant 3 tours.`;
      shortDescOwner = `Le Brouillard couvre votre armée pendant 3 tours.`;
      shortDescOpponent = `Le Brouillard est actif pendant 3 tours sur l'armée adverse.`;
      consequenceOwner = `Les capacités de reconnaissance adverses (Guetteurs, Révélation temporaire, Espionnage) sont bloquées.`;
      consequenceOpponent = `Les capacités de reconnaissance concernées sont bloquées pendant 3 tours.`;
      break;
    }

    case 'revelation_temporaire': {
      const target = nextPieces.find((p) => p.id === payload.targetEnemyPieceId);
      if (!target || !target.alive || target.owner !== opponentColor || target.position === null) {
        throw new Error(`Pièce ennemie cible invalide.`);
      }
      // Lasts 1 full turn (until opponent plays and it returns to caster's turn, Q15)
      nextPieces = nextPieces.map((p) =>
        p.id === target.id
          ? {
              ...p,
              tempRevealedTicksTo: {
                ...p.tempRevealedTicksTo,
                [playerColor]: Math.max(p.tempRevealedTicksTo[playerColor], ONE_FULL_TURN_TICKS + 1),
              },
            }
          : p,
      );
      const posLabel = coordToNotation(target.position);
      logForOwner = `Carte jouée : Révélation temporaire sur ${posLabel}.`;
      logForOpponent = `🃏 Alerte Carte : L'adversaire a utilisé la carte Révélation temporaire (pion cible secret).`;
      shortDescOwner = `Vous révélez temporairement la pièce ennemie en ${posLabel} pendant 1 tour.`;
      shortDescOpponent = `L'adversaire a utilisé Révélation temporaire sur l'une de vos pièces.`;
      consequenceOwner = `Identité visible pendant 1 tour complet (sauf Brouillard ou Contre-espionnage).`;
      consequenceOpponent = `La pièce ciblée reste secrète (révélée pendant 1 tour si non protégée).`;
      visibleTargetOwner = posLabel;
      visibleTargetOpponent = null;
      break;
    }

    case 'revelation_permanente': {
      const target = nextPieces.find((p) => p.id === payload.targetEnemyPieceId);
      if (!target || !target.alive || target.owner !== opponentColor || target.position === null) {
        throw new Error(`Pièce ennemie cible invalide.`);
      }
      nextPieces = nextPieces.map((p) =>
        p.id === target.id
          ? {
              ...p,
              permanentlyRevealedTo: {
                ...p.permanentlyRevealedTo,
                [playerColor]: true,
              },
            }
          : p,
      );
      const posLabel = coordToNotation(target.position);
      logForOwner = `Carte jouée : Révélation permanente sur ${posLabel}.`;
      logForOpponent = `🃏 Alerte Carte : L'adversaire a utilisé la carte Révélation permanente (pion cible secret).`;
      shortDescOwner = `Vous révélez définitivement la pièce ennemie en ${posLabel}.`;
      shortDescOpponent = `L'adversaire a utilisé Révélation permanente sur l'une de vos pièces.`;
      consequenceOwner = `L'identité de cette pièce reste visible jusqu'à la fin de la partie.`;
      consequenceOpponent = `Une de vos pièces est désormais connue de l'adversaire (cible secrète).`;
      visibleTargetOwner = posLabel;
      visibleTargetOpponent = null;
      break;
    }

    case 'espionnage': {
      // Validated rule: Player chooses up to 2 enemy pieces for 3 turns; opponent is notified that Espionnage was played, WITHOUT knowing which pieces were targeted!
      const uniqueTargetIds = [...new Set(payload.targetEnemyPieceIds)];
      if (uniqueTargetIds.length === 0 || uniqueTargetIds.length > ESPIONNAGE_TARGET_COUNT) {
        throw new Error(`Espionnage nécessite de sélectionner 1 ou 2 pièces ennemies.`);
      }
      const targetCoords: string[] = [];
      for (const tid of uniqueTargetIds) {
        const tPiece = nextPieces.find((p) => p.id === tid && p.alive && p.owner === opponentColor);
        if (!tPiece || tPiece.position === null) {
          throw new Error(`Cible d'Espionnage invalide (${tid}).`);
        }
        targetCoords.push(coordToNotation(tPiece.position));
      }

      const espTicks = ESPIONNAGE_DURATION_TURNS * ONE_FULL_TURN_TICKS;
      nextPieces = nextPieces.map((p) =>
        uniqueTargetIds.includes(p.id)
          ? {
              ...p,
              espionageRevealedTicksTo: {
                ...p.espionageRevealedTicksTo,
                [playerColor]: Math.max(p.espionageRevealedTicksTo[playerColor], espTicks),
              },
            }
          : p,
      );
      const joinedTargets = targetCoords.join(', ');
      logForOwner = `Carte jouée : Espionnage activé (3 tours) sur ${joinedTargets}.`;
      logForOpponent = `🃏 Alerte Carte : L'adversaire a utilisé la carte Espionnage (pions cibles secrets).`;
      shortDescOwner = `Espionnage actif pendant 3 tours sur ${joinedTargets}.`;
      shortDescOpponent = `L'adversaire observe jusqu'à 2 de vos pièces pendant 3 tours.`;
      consequenceOwner = `Traverse Contre-espionnage pendant 3 tours.`;
      consequenceOpponent = `Les pions observés restent secrets (traverse Contre-espionnage).`;
      visibleTargetOwner = joinedTargets;
      visibleTargetOpponent = null;
      break;
    }

    case 'double_action': {
      // §8.13, §21.11, Q22: Immediately grants 2 successive piece actions in the same turn; no 2nd card allowed
      const cardEventRecord: ServerCardEventRecord = {
        card: 'double_action',
        cardName: cardMeta.name,
        badge: visualMeta.badge,
        category: visualMeta.category,
        shortDescriptionForOwner: `Vous disposez immédiatement de 2 actions de déplacement/combat.`,
        shortDescriptionForOpponent: `L'adversaire bénéficie de 2 actions pendant ce tour.`,
        consequenceForOwner: `2 actions consécutives dans ce tour (aucune 2e carte autorisée).`,
        consequenceForOpponent: `L'adversaire va effectuer 2 déplacements/attaques consécutifs.`,
        visibleTargetNotationForOwner: null,
        visibleTargetNotationForOpponent: null,
      };
      const updatedState: ServerMatchState = {
        ...state,
        players: {
          ...state.players,
          [playerColor]: nextPlayerState,
        },
        turn: {
          ...state.turn,
          remainingActions: 2,
          doubleActionActive: true,
        },
        actionLog: appendLog(
          state,
          playerColor,
          `Carte jouée : Double action activée (vous disposez immédiatement de 2 actions de déplacement/combat).`,
          `🃏 Alerte Carte : L'adversaire a utilisé la carte Double action (2 actions pendant ce tour).`,
          nowMs,
          {
            eventType: 'CARD_PLAYED',
            icon: visualMeta.badge,
            cardEvent: cardEventRecord,
          },
        ),
      };
      return updatedState;
    }

    case 'piege': {
      const dest = payload.destination;
      if (!isWithinBoard(dest)) {
        throw new Error(`Case de piège hors du plateau.`);
      }
      const isOccupied = nextPieces.some(
        (p) => p.alive && p.position !== null && coordKey(p.position) === coordKey(dest),
      );
      const hasTrapAlready = nextTraps.some(
        (tr) => tr.active && coordKey(tr.coord) === coordKey(dest),
      );
      if (isOccupied || hasTrapAlready) {
        throw new Error(`La case du piège doit être libre.`);
      }
      const newTrap: ServerTrapRecord = {
        id: `trap-${nextTraps.length + 1}`,
        owner: playerColor,
        coord: dest,
        active: true,
      };
      nextTraps.push(newTrap);
      totalTrapAlertsCount += 1;
      const destLabel = coordToNotation(dest);
      logForOwner = `Carte jouée : Piège posé secrètement en ${destLabel}.`;
      // §8.14, §21.19, Q18: Opponent is notified a trap was placed without revealing the square
      logForOpponent = `🃏 Alerte Carte : Attention, l'adversaire a utilisé la carte Piège (case secrète) !`;
      shortDescOwner = `Vous avez posé un piège invisible en ${destLabel}.`;
      shortDescOpponent = `L'adversaire a posé un piège invisible sur le plateau.`;
      consequenceOwner = `Toute pièce (alliée ou ennemie) entrant sur ${destLabel} sera immobilisée 1 tour.`;
      consequenceOpponent = `Emplacement secret — immobilise pendant 1 tour la première pièce qui y entre.`;
      visibleTargetOwner = destLabel;
      visibleTargetOpponent = null;
      break;
    }

    case 'teleportation': {
      const target = nextPieces.find((p) => p.id === payload.targetPieceId);
      if (!target || !target.alive || target.owner !== playerColor || target.position === null) {
        throw new Error(`Pièce alliée cible invalide.`);
      }
      const fromCoord = target.position;
      const validCoords = generateTeleportCandidatesForPiece(target, nextPieces);
      const isAllowed = validCoords.some(
        (c) => c.row === payload.destination.row && c.col === payload.destination.col,
      );
      if (!isAllowed) {
        throw new Error(`Destination de Téléportation invalide ou bloquée.`);
      }

      let moved: ServerPieceRecord = {
        ...target,
        position: payload.destination,
      };
      const colossusCheck = applyColossusEdgeReversalIfNeeded(moved);
      moved = colossusCheck.updatedPiece;

      const trapCheck = checkAndApplyTrapAt(moved, nextTraps);
      moved = trapCheck.updatedPiece;
      nextTraps = [...trapCheck.updatedTraps];

      nextPieces = nextPieces.map((p) => (p.id === moved.id ? moved : p));
      const triggersPromo = shouldTriggerSoldierPromotion(moved);
      if (triggersPromo) {
        nextTurn = {
          ...nextTurn,
          pendingPromotionPieceId: moved.id,
        };
      }
      const fromLabel = coordToNotation(fromCoord);
      const toLabel = coordToNotation(payload.destination);
      nextLastMove = {
        seq: nextSeq,
        turnNumber: state.turn.turnNumber,
        actor: playerColor,
        kind: 'teleportation',
        from: fromCoord,
        to: payload.destination,
        eliminatedCoords: [],
        steps: [{ from: fromCoord, to: payload.destination }],
        triggeredTrapCoord: trapCheck.triggeredTrap ? payload.destination : null,
        promotedAtCoord: triggersPromo ? payload.destination : null,
        blockedAtCoord: null,
        timestampMs: nowMs,
      };
      logForOwner = `Carte jouée : Téléportation ${fromLabel} → ${toLabel}.`;
      logForOpponent = `🃏 Alerte Carte : L'adversaire a utilisé la carte Téléportation (${fromLabel} → ${toLabel}).`;
      shortDescOwner = `Vous téléportez votre pièce de ${fromLabel} vers ${toLabel}.`;
      shortDescOpponent = `L'adversaire téléporte une pièce de ${fromLabel} vers ${toLabel}.`;
      consequenceOwner = `Déplacement spécial effectué sur le plateau (${fromLabel} → ${toLabel}).`;
      consequenceOpponent = `Déplacement effectué de ${fromLabel} vers ${toLabel}.`;
      visibleTargetOwner = `${fromLabel} → ${toLabel}`;
      visibleTargetOpponent = `${fromLabel} → ${toLabel}`;
      break;
    }

    case 'retreat': {
      const target = nextPieces.find((p) => p.id === payload.targetPieceId);
      if (!target || !target.alive || target.owner !== playerColor || target.position === null) {
        throw new Error(`Pièce alliée cible invalide.`);
      }
      const fromCoord = target.position;
      const fromLabel = coordToNotation(fromCoord);
      const toLabel = coordToNotation(payload.destination);
      const ownerVis = buildVisibilityContext(state, playerColor);
      const opponentVis = buildVisibilityContext(state, opponentColor);
      const retreatOptions = generateRetreatCandidatesForPiece(target, nextPieces, ownerVis);
      const chosen = retreatOptions.find(
        (c) => c.to.row === payload.destination.row && c.to.col === payload.destination.col,
      );
      if (!chosen) {
        throw new Error(`Déplacement Retreat invalide.`);
      }

      let retreatEliminated = false;
      let retreatBlocked = false;
      let retreatTrapTriggered = false;
      let retreatColossusKilledByKamikaze = false;
      let retreatColossusSurvivedKamikaze = false;
      let retreatColossusHitsTaken = 0;

      if (chosen.kind === 'normal_move') {
        let moved: ServerPieceRecord = {
          ...target,
          position: payload.destination,
        };
        const trapCheck = checkAndApplyTrapAt(moved, nextTraps);
        moved = trapCheck.updatedPiece;
        nextTraps = [...trapCheck.updatedTraps];
        retreatTrapTriggered = trapCheck.triggeredTrap !== null;
        nextPieces = nextPieces.map((p) => (p.id === moved.id ? moved : p));
      } else {
        // Elimination while retreating is allowed (§8.4, §21.21)
        const defender = nextPieces.find((p) => p.id === chosen.targetEnemyPieceId);
        if (!defender) {
          throw new Error(`Cible de Retreat introuvable.`);
        }
        const combat = resolveDirectCapture(target, defender, ownerVis, opponentVis);
        retreatEliminated = combat.defenderEliminated;
        retreatBlocked = !combat.defenderEliminated;
        retreatColossusKilledByKamikaze =
          combat.attackerEliminatedByKamikaze && target.character === 'colosse';
        retreatColossusSurvivedKamikaze =
          combat.defenderEliminated &&
          defender.hasKamikaze &&
          target.character === 'colosse' &&
          !combat.attackerEliminatedByKamikaze;
        retreatColossusHitsTaken = combat.updatedAttacker.kamikazeHitsTaken;
        let finalAttacker = combat.updatedAttacker;
        if (combat.defenderEliminated && finalAttacker.alive) {
          const trapCheck = checkAndApplyTrapAt(finalAttacker, nextTraps);
          finalAttacker = trapCheck.updatedPiece;
          nextTraps = [...trapCheck.updatedTraps];
          retreatTrapTriggered = trapCheck.triggeredTrap !== null;
        }
        nextPieces = nextPieces.map((p) => {
          if (p.id === finalAttacker.id) return finalAttacker;
          if (p.id === combat.updatedDefender.id) return combat.updatedDefender;
          return p;
        });
        nextGraveyard.push(...combat.graveyardEntriesCreated);
        if (combat.defenderEliminated) {
          nextTurn = {
            ...nextTurn,
            eliminatedEnemyIdsThisTurn: recordUniqueEliminatedEnemy(
              nextTurn.eliminatedEnemyIdsThisTurn,
              defender,
              playerColor,
            ),
          };
          nextPlayerState = awardEliminationsAndCards(
            nextPlayerState,
            1,
            state.ruleset,
            randomFn,
            state.turn.turnNumber,
            nowMs,
          );
        }
        if (combat.kingEliminatedColor !== null) {
          const winnerColor = getOpponentColor(combat.kingEliminatedColor);
          return reconcileTraqueurMarks(
            {
              ...state,
              phase: 'finished',
              pieces: nextPieces,
              traps: nextTraps,
              graveyard: nextGraveyard,
              players: {
                ...state.players,
                [playerColor]: nextPlayerState,
              },
              winner: winnerColor,
              outcomeReason: 'king_eliminated',
              lastMove: {
                seq: nextSeq,
                turnNumber: state.turn.turnNumber,
                actor: playerColor,
                kind: 'retreat_capture',
                from: fromCoord,
                to: payload.destination,
                eliminatedCoords: [payload.destination],
                steps: [{ from: fromCoord, to: payload.destination, capturedCoord: payload.destination }],
                timestampMs: nowMs,
              },
            },
            nowMs,
          );
        }
      }
      if (retreatColossusKilledByKamikaze) {
        updatedOpponentState = bumpPlayerNewStats(updatedOpponentState, {
          colossiEliminatedByKamikaze: 1,
        });
      }
      const retreatKamikazeSuffix = retreatColossusKilledByKamikaze
        ? ` Le ${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}e déclenchement de Kamikaze a éliminé le Colosse !`
        : retreatColossusSurvivedKamikaze
          ? ` Le Colosse a résisté au 1er déclenchement de Kamikaze (${retreatColossusHitsTaken}/${COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD}).`
          : '';
      nextLastMove = {
        seq: nextSeq,
        turnNumber: state.turn.turnNumber,
        actor: playerColor,
        kind: retreatBlocked
          ? 'attack_blocked'
          : retreatEliminated
            ? 'retreat_capture'
            : 'retreat_move',
        from: fromCoord,
        to: retreatBlocked ? fromCoord : payload.destination,
        eliminatedCoords: retreatEliminated ? [payload.destination] : [],
        steps: [
          {
            from: fromCoord,
            to: payload.destination,
            capturedCoord: retreatEliminated ? payload.destination : null,
          },
        ],
        triggeredTrapCoord: retreatTrapTriggered ? payload.destination : null,
        blockedAtCoord: retreatBlocked ? payload.destination : null,
        timestampMs: nowMs,
      };
      logForOwner = `Carte jouée : Retreat exécuté (${fromLabel} → ${toLabel}).${retreatKamikazeSuffix}`;
      logForOpponent = `🃏 Alerte Carte : L'adversaire a utilisé la carte Retreat (${fromLabel} → ${toLabel}).${retreatKamikazeSuffix}`;
      shortDescOwner = `Vous faites reculer votre pièce de ${fromLabel} vers ${toLabel}.`;
      shortDescOpponent = `L'adversaire fait reculer une pièce de ${fromLabel} vers ${toLabel}.`;
      consequenceOwner = retreatEliminated
        ? `Repli avec élimination en ${toLabel}.${retreatKamikazeSuffix}`
        : `Déplacement en arrière effectué (${fromLabel} → ${toLabel}).`;
      consequenceOpponent = retreatEliminated
        ? `Déplacement en arrière avec élimination en ${toLabel}.${retreatKamikazeSuffix}`
        : `Déplacement effectué de ${fromLabel} vers ${toLabel}.`;
      visibleTargetOwner = `${fromLabel} → ${toLabel}`;
      visibleTargetOpponent = `${fromLabel} → ${toLabel}`;
      break;
    }

    case 'resurrection': {
      const backRow = getOwnEdgeRow(playerColor);
      if (payload.destination.row !== backRow || !isWithinBoard(payload.destination)) {
        throw new Error(`La Résurrection doit se faire sur votre première rangée (rangée ${backRow}).`);
      }
      const isOccupied = nextPieces.some(
        (p) => p.alive && p.position !== null && coordKey(p.position) === coordKey(payload.destination),
      );
      if (isOccupied) {
        throw new Error(`La case d'apparition doit être libre (§8.7).`);
      }

      const graveIdx = nextGraveyard.findIndex(
        (g) => g.pieceId === payload.graveyardPieceId && g.owner === playerColor,
      );
      if (graveIdx === -1) {
        throw new Error(`Pièce éliminée introuvable dans votre cimetière.`);
      }
      const graveEntry = nextGraveyard[graveIdx];
      if (!isCardAllowedOnCharacter('resurrection', graveEntry.characterAtDeath)) {
        throw new Error(`Impossible de ressusciter ${CHARACTER_CATALOG[graveEntry.characterAtDeath].name} (§8.7).`);
      }

      const aliveOwn = nextPieces.filter((p) => p.alive && p.owner === playerColor);
      const aliveCounts = countCharacters(aliveOwn.map((p) => p.character));
      if (!canAddCharacterInstance(graveEntry.characterAtDeath, aliveCounts[graveEntry.characterAtDeath])) {
        throw new Error(`Limite maximale atteinte pour ${CHARACTER_CATALOG[graveEntry.characterAtDeath].name} (§5, §8.7).`);
      }

      nextGraveyard = nextGraveyard.filter((_, idx) => idx !== graveIdx);
      nextPieces = nextPieces.map((p) =>
        p.id === graveEntry.pieceId
          ? {
              ...p,
              character: graveEntry.characterAtDeath, // Preserves promoted identity (§8.7, §21.9)
              alive: true,
              position: payload.destination,
              progressionDirection: getInitialForwardDelta(playerColor),
              hasKamikaze: false,
              hasProtection: false,
              invincibleTicksRemaining: 0,
              immobilizedTicksRemaining: 0,
              traqueurMarkedTargetId: null,
              traqueurPursuitReady: false,
              arbaletrierCooldownTurnsRemaining: 0,
            }
          : p,
      );

      const destLabel = coordToNotation(payload.destination);
      const charName = CHARACTER_CATALOG[graveEntry.characterAtDeath].name;
      nextLastMove = {
        seq: nextSeq,
        turnNumber: state.turn.turnNumber,
        actor: playerColor,
        kind: 'resurrection',
        from: payload.destination,
        to: payload.destination,
        eliminatedCoords: [],
        steps: [{ from: payload.destination, to: payload.destination }],
        timestampMs: nowMs,
      };
      logForOwner = `Carte jouée : Résurrection de ${charName} en ${destLabel}.`;
      logForOpponent = `🃏 Alerte Carte : L'adversaire a utilisé la carte Résurrection en ${destLabel}.`;
      shortDescOwner = `Vous ressuscitez ${charName} sur la case ${destLabel}.`;
      shortDescOpponent = `L'adversaire ramène une pièce éliminée sur sa première rangée (${destLabel}).`;
      consequenceOwner = `${charName} est de retour en jeu en ${destLabel}.`;
      consequenceOpponent = graveEntry.knownToOpponentAtDeath
        ? `Pièce revenue en ${destLabel} (${charName}).`
        : `Une pièce adverse est revenue en jeu en ${destLabel} (identité cachée).`;
      visibleTargetOwner = destLabel;
      visibleTargetOpponent = destLabel;
      break;
    }

    case 'recrutement': {
      if (player.recruitmentUsed) {
        throw new Error(`Recrutement ne peut être utilisé qu'une seule fois par partie (§8.12).`);
      }
      const backRow = getOwnEdgeRow(playerColor);
      if (payload.destination.row !== backRow || !isWithinBoard(payload.destination)) {
        throw new Error(`Le Recrutement doit se faire sur votre première rangée.`);
      }
      const isOccupied = nextPieces.some(
        (p) => p.alive && p.position !== null && coordKey(p.position) === coordKey(payload.destination),
      );
      if (isOccupied) {
        throw new Error(`La case d'apparition doit être libre (§8.12).`);
      }

      const soldierGraveIdx = nextGraveyard.findIndex(
        (g) => g.owner === playerColor && g.characterAtDeath === 'soldat',
      );
      if (soldierGraveIdx === -1) {
        throw new Error(`Aucun Soldat éliminé disponible pour Recrutement.`);
      }

      const soldierGrave = nextGraveyard[soldierGraveIdx];
      nextGraveyard = nextGraveyard.filter((_, idx) => idx !== soldierGraveIdx);
      nextPieces = nextPieces.map((p) =>
        p.id === soldierGrave.pieceId
          ? {
              ...p,
              character: 'soldat',
              alive: true,
              position: payload.destination,
              hasKamikaze: false,
              hasProtection: false,
              invincibleTicksRemaining: 0,
              immobilizedTicksRemaining: 0,
              traqueurMarkedTargetId: null,
              traqueurPursuitReady: false,
              arbaletrierCooldownTurnsRemaining: 0,
            }
          : p,
      );
      nextPlayerState = {
        ...nextPlayerState,
        recruitmentUsed: true,
      };
      const destLabel = coordToNotation(payload.destination);
      nextLastMove = {
        seq: nextSeq,
        turnNumber: state.turn.turnNumber,
        actor: playerColor,
        kind: 'recrutement',
        from: payload.destination,
        to: payload.destination,
        eliminatedCoords: [],
        steps: [{ from: payload.destination, to: payload.destination }],
        timestampMs: nowMs,
      };
      logForOwner = `Carte jouée : Recrutement d'un Soldat en ${destLabel}.`;
      logForOpponent = `🃏 Alerte Carte : L'adversaire a utilisé la carte Recrutement en ${destLabel}.`;
      shortDescOwner = `Vous recrutez un Soldat éliminé sur la case ${destLabel}.`;
      shortDescOpponent = `L'adversaire récupère un Soldat éliminé sur sa première rangée (${destLabel}).`;
      consequenceOwner = `Soldat de retour en ${destLabel} (utilisation unique par partie).`;
      consequenceOpponent = `Retour d'un Soldat adverse sur la case ${destLabel}.`;
      visibleTargetOwner = destLabel;
      visibleTargetOpponent = destLabel;
      break;
    }

    case 'sacrifice': {
      // §8.16, §21.22, Contradiction #5: Sacrifice own Soldier to draw 1 card; does NOT give opponent a kill point!
      const soldier = nextPieces.find((p) => p.id === payload.targetSoldierPieceId);
      if (
        !soldier ||
        !soldier.alive ||
        soldier.owner !== playerColor ||
        soldier.character !== 'soldat' ||
        soldier.position === null
      ) {
        throw new Error(`Vous devez sélectionner un Soldat allié vivant à sacrifier.`);
      }
      const soldierPosLabel = coordToNotation(soldier.position);

      const opponentVis = buildVisibilityContext(state, opponentColor);
      const graveRecord = createGraveyardRecordOnElimination(
        soldier,
        null,
        false,
        opponentColor,
        opponentVis,
        true,
      );
      nextGraveyard.push(graveRecord);

      nextPieces = nextPieces.map((p) =>
        p.id === soldier.id ? { ...p, alive: false, position: null } : p,
      );

      // Draw 1 card (hand size is now <= 2 since Sacrifice was consumed first, so drawing brings hand to <= 3)
      if (nextPlayerState.hand.length < state.ruleset.maxHandSize) {
        const drawn = drawRandomCardFromPool(state.ruleset.enabledCards, randomFn);
        if (drawn !== null) {
          const nextHand = [...nextPlayerState.hand, drawn];
          nextPlayerState = {
            ...nextPlayerState,
            hand: nextHand,
            lastCardDraw: buildCardDrawNotification(
              nextPlayerState,
              drawn,
              nextHand.length,
              state.ruleset,
              'sacrifice',
              state.turn.turnNumber,
              nowMs,
            ),
          };
        }
      }
      logForOwner = `Carte jouée : Sacrifice d'un Soldat en ${soldierPosLabel} (vous piochez une carte).`;
      logForOpponent = `🃏 Alerte Carte : L'adversaire a utilisé la carte Sacrifice (${soldierPosLabel}).`;
      shortDescOwner = `Vous sacrifiez votre Soldat en ${soldierPosLabel} pour piocher une carte.`;
      shortDescOpponent = `L'adversaire a sacrifié volontairement un Soldat en ${soldierPosLabel}.`;
      consequenceOwner = `Vous piochez immédiatement 1 carte (aucune élimination accordée à l'adversaire).`;
      consequenceOpponent = `Un Soldat adverse est retiré et l'adversaire pioche 1 carte.`;
      visibleTargetOwner = soldierPosLabel;
      visibleTargetOpponent = soldierPosLabel;
      break;
    }
  }

  const cardEventRecord: ServerCardEventRecord = {
    card: payload.card,
    cardName: cardMeta.name,
    badge: visualMeta.badge,
    category: visualMeta.category,
    shortDescriptionForOwner: shortDescOwner,
    shortDescriptionForOpponent: shortDescOpponent,
    consequenceForOwner: consequenceOwner,
    consequenceForOpponent: consequenceOpponent,
    visibleTargetNotationForOwner: visibleTargetOwner,
    visibleTargetNotationForOpponent: visibleTargetOpponent,
  };

  const nextState = reconcileTraqueurMarks(
    {
      ...state,
      pieces: nextPieces,
      traps: nextTraps,
      graveyard: nextGraveyard,
      totalTrapAlertsCount,
      lastMove: nextLastMove,
      players: {
        ...state.players,
        [playerColor]: nextPlayerState,
        [opponentColor]: updatedOpponentState,
      },
      turn: nextTurn,
      actionLog: appendLog(state, playerColor, logForOwner, logForOpponent, nowMs, {
        eventType: 'CARD_PLAYED',
        icon: visualMeta.badge,
        cardEvent: cardEventRecord,
      }),
    },
    nowMs,
  );

  return advanceTurnOrSubAction(nextState, 1, nowMs);
}

/**
 * Tick the authoritative match clock and end the game if a player's clock reaches 0 (§11, §21.28, §21.29).
 */
export function tickMatchClock(
  state: ServerMatchState,
  nowMs: number = Date.now(),
): ServerMatchState {
  if (state.phase !== 'playing') {
    return state;
  }
  const evalResult = evaluateClockAt(state.clock, nowMs);
  if (evalResult.timedOutPlayer !== null) {
    return {
      ...state,
      phase: 'finished',
      clock: evalResult.state,
      winner: evalResult.winnerByTimeout,
      outcomeReason: 'clock_timeout',
      actionLog: appendLog(
        state,
        evalResult.timedOutPlayer,
        `Temps écoulé pour ${evalResult.timedOutPlayer === 'red' ? 'Rouge' : 'Noir'} !`,
        `Temps écoulé pour ${evalResult.timedOutPlayer === 'red' ? 'Rouge' : 'Noir'} !`,
        nowMs,
      ),
    };
  }
  return {
    ...state,
    clock: evalResult.state,
  };
}

/**
 * Voluntary resignation (§12.2, §14).
 */
export function resignMatch(
  state: ServerMatchState,
  resigningPlayer: PlayerColor,
  nowMs: number = Date.now(),
): ServerMatchState {
  if (state.phase === 'finished') {
    return state;
  }
  const winner = getOpponentColor(resigningPlayer);
  return {
    ...state,
    phase: 'finished',
    winner,
    outcomeReason: 'resignation',
    actionLog: appendLog(
      state,
      resigningPlayer,
      `Abandon de ${resigningPlayer === 'red' ? 'Rouge' : 'Noir'}. Victoire de ${winner === 'red' ? 'Rouge' : 'Noir'}.`,
      `Abandon de ${resigningPlayer === 'red' ? 'Rouge' : 'Noir'}. Victoire de ${winner === 'red' ? 'Rouge' : 'Noir'}.`,
      nowMs,
    ),
  };
}

/**
 * Forfeit after exceeding the 60-second reconnection deadline (§12.2, §14, §21.30).
 */
export function forfeitByDisconnectionTimeout(
  state: ServerMatchState,
  disconnectedPlayer: PlayerColor,
  nowMs: number = Date.now(),
): ServerMatchState {
  if (state.phase === 'finished') {
    return state;
  }
  const winner = getOpponentColor(disconnectedPlayer);
  return {
    ...state,
    phase: 'finished',
    winner,
    outcomeReason: 'disconnect_forfeit',
    actionLog: appendLog(
      state,
      disconnectedPlayer,
      `Forfait de ${disconnectedPlayer === 'red' ? 'Rouge' : 'Noir'} (délai de reconnexion de 60s dépassé).`,
      `Forfait de ${disconnectedPlayer === 'red' ? 'Rouge' : 'Noir'} (délai de reconnexion de 60s dépassé).`,
      nowMs,
    ),
  };
}

/**
 * Propose or accept a mutual draw (§14, §21.32).
 */
export function proposeOrAcceptMutualDraw(
  state: ServerMatchState,
  playerColor: PlayerColor,
  nowMs: number = Date.now(),
): ServerMatchState {
  if (state.phase !== 'playing') {
    throw new Error(`La partie n'est pas en cours.`);
  }
  const opponent = getOpponentColor(playerColor);
  if (state.drawOfferFrom === opponent) {
    return {
      ...state,
      phase: 'finished',
      winner: 'draw',
      outcomeReason: 'mutual_draw',
      drawOfferFrom: null,
      actionLog: appendLog(
        state,
        playerColor,
        'Match nul conclu par accord mutuel.',
        'Match nul conclu par accord mutuel.',
        nowMs,
      ),
    };
  }
  return {
    ...state,
    drawOfferFrom: playerColor,
  };
}

/**
 * Migration ascendante/rétrocompatible d'une sauvegarde ou partie en cours (§13).
 * Initialise proprement les nouveaux champs (stats = 0, compteurs/marquages = défaut) sans corrompre les anciens états.
 */
export function migrateLegacyMatchState(rawState: ServerMatchState): ServerMatchState {
  const migratePlayer = (
    p: PlayerRuntimeState,
  ): PlayerRuntimeState => ({
    ...p,
    lastCardDraw: p.lastCardDraw ?? null,
    newMechanicsStats: {
      ...createZeroNewMechanicsStats(),
      ...(p.newMechanicsStats ?? {}),
    },
  });

  const migratedPieces: ServerPieceRecord[] = (rawState.pieces ?? []).map((p) => ({
    ...p,
    traqueurMarkedTargetId: p.traqueurMarkedTargetId ?? null,
    traqueurPursuitReady: Boolean(p.traqueurPursuitReady),
    arbaletrierCooldownTurnsRemaining: Number(p.arbaletrierCooldownTurnsRemaining ?? 0),
  }));

  const rawTurn = rawState.turn as TurnRuntimeState & {
    readonly isCavalierBonusTurn?: boolean;
    readonly cavalierZeroKillPenaltyTriggered?: boolean;
  };
  const migratedDoubleAction = Boolean(rawTurn?.doubleActionActive);
  const rawRemainingActions = rawTurn?.remainingActions ?? 1;
  const normalizedRemainingActions =
    rawRemainingActions > 1 && !migratedDoubleAction ? 1 : rawRemainingActions;
  const migratedIsBonusTurn = Boolean(rawTurn?.isBonusTurn ?? rawTurn?.isCavalierBonusTurn);
  const migratedTurn: TurnRuntimeState = {
    turnNumber: rawTurn?.turnNumber ?? 1,
    activePlayer: rawTurn?.activePlayer ?? INITIAL_FIRST_PLAYER,
    remainingActions: normalizedRemainingActions,
    doubleActionActive: migratedDoubleAction,
    isBonusTurn: migratedIsBonusTurn,
    bonusTurnReason:
      rawTurn?.bonusTurnReason ??
      (migratedIsBonusTurn ? '2+ éliminations réalisées durant le tour' : null),
    rageUsedThisTurn: Boolean(rawTurn?.rageUsedThisTurn),
    eliminatedEnemyIdsThisTurn: Array.isArray(rawTurn?.eliminatedEnemyIdsThisTurn)
      ? rawTurn.eliminatedEnemyIdsThisTurn
      : [],
    pendingCavalierJumpPieceId: rawTurn?.pendingCavalierJumpPieceId ?? null,
    pendingBerserkerRagePieceId: rawTurn?.pendingBerserkerRagePieceId ?? null,
    pendingPromotionPieceId: rawTurn?.pendingPromotionPieceId ?? null,
    nextOpponentActionsOverride: null,
    skipOpponentNextTurn: Boolean(rawTurn?.skipOpponentNextTurn),
  };

  return {
    ...rawState,
    turn: migratedTurn,
    totalTrapAlertsCount: rawState.totalTrapAlertsCount ?? 0,
    lastMove: rawState.lastMove ?? null,
    pieces: migratedPieces,
    players: {
      red: migratePlayer(rawState.players.red),
      black: migratePlayer(rawState.players.black),
    },
  };
}

/**
 * Project the authoritative `ServerMatchState` into a strictly filtered `ClientMatchView`
 * for `viewerColor` (§4.5, §9, §19).
 *
 * Security guarantee:
 * - Unrevealed enemy pieces have `character: null`.
 * - Secret enemy buffs (`Kamikaze`, `Protection`, `Contre-espionnage`) and enemy trap coordinates are stripped.
 * - Opponent's hand cards are hidden (only hand count is exposed).
 */
export function projectMatchStateForViewer(
  state: ServerMatchState,
  viewerColor: PlayerColor,
): ClientMatchView {
  const opponentColor = getOpponentColor(viewerColor);
  const vis = buildVisibilityContext(state, viewerColor);

  const markedTargetIdsByViewer = new Set<string>();
  for (const p of state.pieces) {
    if (
      p.alive &&
      p.owner === viewerColor &&
      p.character === 'traqueur' &&
      p.traqueurMarkedTargetId
    ) {
      markedTargetIdsByViewer.add(p.traqueurMarkedTargetId);
    }
  }

  const projectedPieces: ClientPieceView[] = state.pieces
    .filter((p) => p.alive && p.position !== null)
    .map((p) => projectPieceForViewer(p, viewerColor, vis, markedTargetIdsByViewer));

  const ownTraps: Coord[] = state.traps
    .filter((tr) => tr.active && tr.owner === viewerColor)
    .map((tr) => tr.coord);

  const projectedGraveyard: GraveyardEntryView[] = state.graveyard.map((g) =>
    projectGraveyardEntryForViewer(g, viewerColor),
  );

  const guetteurReconCoords: Coord[] = [];
  for (const key of vis.viewerGuetteurReconKeys) {
    const [rStr, cStr] = key.split(',');
    guetteurReconCoords.push({ row: Number(rStr), col: Number(cStr) });
  }

  const availablePromotionChoices =
    state.turn.pendingPromotionPieceId !== null && state.turn.activePlayer === viewerColor
      ? getAvailablePromotionCharacters(viewerColor, state.pieces)
      : [];

  const canPlayCardNow =
    state.phase === 'playing' &&
    state.turn.activePlayer === viewerColor &&
    !state.turn.isBonusTurn &&
    !state.turn.doubleActionActive &&
    state.turn.pendingCavalierJumpPieceId === null &&
    state.turn.pendingBerserkerRagePieceId === null &&
    state.turn.pendingPromotionPieceId === null;

  return {
    matchId: state.matchId,
    viewerColor,
    mode: state.mode,
    phase: state.phase,
    ruleset: state.ruleset,
    pieces: projectedPieces,
    ownTraps,
    totalActiveTrapNotifications: state.totalTrapAlertsCount,
    graveyard: projectedGraveyard,
    ownHand: state.players[viewerColor].hand,
    opponentHandCount: state.players[opponentColor].hand.length,
    ownKillCounterTowardCard: state.players[viewerColor].killCounterTowardCard,
    opponentKillCounterTowardCard: state.players[opponentColor].killCounterTowardCard,
    ownRecruitmentUsed: state.players[viewerColor].recruitmentUsed,
    ownBlockCooldownTurns: state.players[viewerColor].blockCooldownTurnsRemaining,
    fogActiveByPlayer: {
      red: state.players.red.fogTicksRemaining > 0,
      black: state.players.black.fogTicksRemaining > 0,
    },
    guetteurReconCoords,
    turn: {
      turnNumber: state.turn.turnNumber,
      activePlayer: state.turn.activePlayer,
      remainingActions: state.turn.remainingActions,
      doubleActionActive: state.turn.doubleActionActive,
      isBonusTurn: state.turn.isBonusTurn,
      bonusTurnReason: state.turn.bonusTurnReason,
      eliminationsThisTurnCount: state.turn.eliminatedEnemyIdsThisTurn.length,
      pendingCavalierJumpPieceId: state.turn.pendingCavalierJumpPieceId,
      pendingBerserkerRagePieceId: state.turn.pendingBerserkerRagePieceId,
      pendingPromotionPieceId: state.turn.pendingPromotionPieceId,
      availablePromotionChoices,
      canPlayCardNow,
    },
    clock: state.clock,
    winner: state.winner,
    outcomeReason: state.outcomeReason,
    drawOfferFrom: state.drawOfferFrom,
    repetitionWarningActive: state.repetitionWarningActive,
    maxRepetitionCountSeen: state.maxRepetitionCountSeen,
    placementStatus: {
      redConfirmed: state.players.red.placementConfirmed,
      blackConfirmed: state.players.black.placementConfirmed,
      ownConfirmed: state.players[viewerColor].placementConfirmed,
      opponentConfirmed: state.players[opponentColor].placementConfirmed,
    },
    ownConfirmedPlacement: state.players[viewerColor].placementConfirmed
      ? state.players[viewerColor].stagedPlacement
      : [],
    ownLastCardDraw: state.players[viewerColor].lastCardDraw ?? null,
    ownNewMechanicsStats:
      state.players[viewerColor].newMechanicsStats ?? createZeroNewMechanicsStats(),
    lastMove: state.lastMove ?? null,
    cardNotifications: state.actionLog
      .filter((entry) => entry.cardEvent !== undefined && entry.cardEvent !== null)
      .map((entry) => {
        const ce = entry.cardEvent!;
        const isOwner = entry.actor === viewerColor;
        return {
          id: `card-notif-${entry.seq}`,
          seq: entry.seq,
          turnNumber: entry.turnNumber,
          timestampMs: entry.timestampMs,
          actor: entry.actor,
          card: ce.card,
          cardName: ce.cardName,
          badge: ce.badge,
          category: ce.category,
          shortDescription: isOwner
            ? ce.shortDescriptionForOwner
            : ce.shortDescriptionForOpponent,
          consequenceText: isOwner
            ? ce.consequenceForOwner
            : ce.consequenceForOpponent,
          visibleTargetNotation: isOwner
            ? ce.visibleTargetNotationForOwner
            : ce.visibleTargetNotationForOpponent,
        };
      }),
    actionLog: state.actionLog
      .filter((entry) => {
        const text = viewerColor === 'red' ? entry.summaryForRed : entry.summaryForBlack;
        return text.trim().length > 0;
      })
      .map((entry) => {
      const ce = entry.cardEvent ?? null;
      const isOwner = entry.actor === viewerColor;
      const cardNotification: CardNotificationView | null = ce
        ? {
            id: `card-notif-${entry.seq}`,
            seq: entry.seq,
            turnNumber: entry.turnNumber,
            timestampMs: entry.timestampMs,
            actor: entry.actor,
            card: ce.card,
            cardName: ce.cardName,
            badge: ce.badge,
            category: ce.category,
            shortDescription: isOwner
              ? ce.shortDescriptionForOwner
              : ce.shortDescriptionForOpponent,
            consequenceText: isOwner
              ? ce.consequenceForOwner
              : ce.consequenceForOpponent,
            visibleTargetNotation: isOwner
              ? ce.visibleTargetNotationForOwner
              : ce.visibleTargetNotationForOpponent,
          }
        : null;
      return {
        seq: entry.seq,
        turnNumber: entry.turnNumber,
        timestampMs: entry.timestampMs,
        actor: entry.actor,
        eventType: entry.eventType ?? 'PIECE_MOVED',
        icon: entry.icon ?? 'DEPL',
        text: viewerColor === 'red' ? entry.summaryForRed : entry.summaryForBlack,
        cardNotification,
      };
    }),
  };
}
