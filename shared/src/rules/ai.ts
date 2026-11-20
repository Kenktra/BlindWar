import type {
  CardType,
  CharacterType,
  ClientPieceView,
  Coord,
  PlacementEntry,
  PlayerColor,
  ServerPieceRecord,
} from '../types/core.js';
import {
  coordKey,
  getInitialForwardDelta,
  getOwnEdgeRow,
} from '../constants/board.js';
import {
  autoCompletePlacement,
} from './placement.js';
import {
  computeGuetteurReconZoneKeys,
  type VisibilityContext,
} from './visibility.js';
import {
  generateCavalierJumpCandidates,
  generateMoveCandidatesForPiece,
  generateTraqueurMarkCandidates,
  type MoveCandidate,
} from './movement-locked.js';
import {
  createMatchState,
  executePieceMove,
  markTraqueurTarget,
  playCard,
  projectMatchStateForViewer,
  selectSoldierPromotion,
  skipBerserkerRageMove,
  stopCavalierJumpChain,
  submitPlayerPlacement,
  type ClientMatchView,
  type ServerMatchState,
} from './engine.js';

export type AiDifficulty = 'easy' | 'medium' | 'hard';

export interface AiDifficultyMeta {
  readonly id: AiDifficulty;
  readonly label: string;
  readonly badge: string;
  readonly description: string;
  readonly thinkDelayMs: number;
}

export const AI_DIFFICULTY_CATALOG: Readonly<Record<AiDifficulty, AiDifficultyMeta>> = {
  easy: {
    id: 'easy',
    label: 'Recrue (Facile)',
    badge: '★☆☆',
    description: 'Idéal pour découvrir les pièces et tester vos stratégies sans pression.',
    thinkDelayMs: 420,
  },
  medium: {
    id: 'medium',
    label: 'Tacticien (Moyen)',
    badge: '★★☆',
    description: 'Utilise le marquage du Traqueur, les tirs d’Arbalétrier et les captures opportunes.',
    thinkDelayMs: 520,
  },
  hard: {
    id: 'hard',
    label: 'Commandant (Difficile)',
    badge: '★★★',
    description: 'Protège son Roi, combine cartes tactiques, Frappe traversante et reconnaissance.',
    thinkDelayMs: 600,
  },
};

export const AI_DIFFICULTIES: readonly AiDifficulty[] = ['easy', 'medium', 'hard'];

const ROLE_VALUE: Readonly<Record<CharacterType, number>> = {
  roi: 1000,
  reine: 95,
  colosse: 90,
  executeur: 85,
  arbaletrier: 82,
  traqueur: 78,
  cavalier: 72,
  berserker: 70,
  assassin: 58,
  guetteur_h: 48,
  guetteur_d: 48,
  soldat: 25,
};

/**
 * Generate a tactical initial 27-piece placement for the AI player.
 * Keeps the Roi protected on the back row and distributes scouts and vanguard units.
 */
export function chooseAiPlacement(
  aiColor: PlayerColor,
  difficulty: AiDifficulty = 'medium',
): PlacementEntry[] {
  const backRow = getOwnEdgeRow(aiColor);
  const midRow = aiColor === 'red' ? 7 : 1;
  const frontRow = aiColor === 'red' ? 6 : 2;

  const kingCol = difficulty === 'easy' ? 4 : 4;
  const staged: PlacementEntry[] = [
    { character: 'roi', coord: { row: backRow, col: kingCol } },
    { character: 'reine', coord: { row: backRow, col: 3 } },
    { character: 'arbaletrier', coord: { row: backRow, col: 5 } },
    { character: 'traqueur', coord: { row: midRow, col: 4 } },
    { character: 'executeur', coord: { row: midRow, col: 3 } },
    { character: 'colosse', coord: { row: midRow, col: 5 } },
    { character: 'cavalier', coord: { row: midRow, col: 1 } },
    { character: 'cavalier', coord: { row: midRow, col: 7 } },
    { character: 'berserker', coord: { row: midRow, col: 2 } },
    { character: 'guetteur_h', coord: { row: frontRow, col: 1 } },
    { character: 'guetteur_d', coord: { row: frontRow, col: 4 } },
    { character: 'guetteur_h', coord: { row: frontRow, col: 7 } },
  ];

  return autoCompletePlacement(aiColor, staged);
}

/**
 * Reconstruct a strictly anti-cheat pseudo-server piece list from the AI's own projected view.
 * Unknown enemy pieces are treated conservatively as `'soldat'` so the AI never cheats on hidden identities.
 */
function buildAiPerceivedContext(
  view: ClientMatchView,
  aiColor: PlayerColor,
): { readonly pieces: ServerPieceRecord[]; readonly visContext: VisibilityContext } {
  const markedTargetId =
    view.pieces.find((ep) => ep.owner !== aiColor && ep.traqueurMarkedByViewer)?.id ?? null;

  const pieces: ServerPieceRecord[] = view.pieces.map((pv) => ({
    id: pv.id,
    owner: pv.owner,
    character: pv.character ?? 'soldat',
    promotedFrom: null,
    position: pv.position,
    alive: true,
    progressionDirection:
      pv.progressionDirectionVisible ?? (pv.owner === 'red' ? -1 : 1),
    reversalCount: 0,
    kamikazeHitsTaken: pv.kamikazeHitsTakenVisible ?? 0,
    hasKamikaze: pv.hasKamikazeVisible,
    invincibleTicksRemaining: pv.isInvincible ? 2 : 0,
    hasProtection: pv.isProtectedVisible,
    counterEspionageTicksRemaining: pv.hasCounterEspionageVisible ? 2 : 0,
    espionageRevealedTicksTo: { red: 0, black: 0 },
    tempRevealedTicksTo: {
      red:
        (pv.revealKind === 'temporary' || pv.revealKind === 'proximity') && aiColor === 'red'
          ? 2
          : 0,
      black:
        (pv.revealKind === 'temporary' || pv.revealKind === 'proximity') && aiColor === 'black'
          ? 2
          : 0,
    },
    permanentlyRevealedTo: {
      red: pv.revealKind === 'permanent' && aiColor === 'red',
      black: pv.revealKind === 'permanent' && aiColor === 'black',
    },
    immobilizedTicksRemaining: pv.isImmobilized ? 2 : 0,
    traqueurMarkedTargetId:
      pv.character === 'traqueur' && pv.owner === aiColor ? markedTargetId : null,
    traqueurPursuitReady: pv.traqueurPursuitReadyVisible ?? false,
    arbaletrierCooldownTurnsRemaining: pv.arbaletrierCooldownTurnsVisible ?? 0,
  }));

  const visContext: VisibilityContext = {
    fogTurnsRemainingByOwner: {
      red: view.fogActiveByPlayer.red ? 2 : 0,
      black: view.fogActiveByPlayer.black ? 2 : 0,
    },
    viewerGuetteurReconKeys: computeGuetteurReconZoneKeys(pieces, aiColor),
  };

  return { pieces, visContext };
}

/**
 * Execute one atomic step for the active AI player (`state.turn.activePlayer`) while respecting
 * 100% of BLIND WAR rules and zero-knowledge secrecy (the AI only sees its projected `ClientMatchView`).
 */
export function executeAiTurnStep(
  state: ServerMatchState,
  difficulty: AiDifficulty = 'medium',
  nowMs: number = Date.now(),
): ServerMatchState {
  if (state.phase !== 'playing') {
    return state;
  }

  const aiColor = state.turn.activePlayer;
  const view = projectMatchStateForViewer(state, aiColor);
  const { pieces: perceivedPieces, visContext } = buildAiPerceivedContext(view, aiColor);

  // 1. Handle pending Soldier Promotion
  if (view.turn.pendingPromotionPieceId) {
    const priority: readonly CharacterType[] = [
      'reine',
      'colosse',
      'executeur',
      'arbaletrier',
      'traqueur',
      'cavalier',
      'berserker',
      'assassin',
      'guetteur_h',
      'guetteur_d',
    ];
    const chosen =
      priority.find((ch) => view.turn.availablePromotionChoices.includes(ch)) ??
      view.turn.availablePromotionChoices[0] ??
      'cavalier';
    return selectSoldierPromotion(state, aiColor, chosen, nowMs);
  }

  // 2. Handle pending Cavalier Jump Chain
  if (view.turn.pendingCavalierJumpPieceId) {
    const jumpingCav = perceivedPieces.find((p) => p.id === view.turn.pendingCavalierJumpPieceId);
    if (jumpingCav) {
      const nextJumps = generateCavalierJumpCandidates(jumpingCav, perceivedPieces, visContext);
      if (nextJumps.length > 0 && difficulty !== 'easy') {
        const chosen = nextJumps[0]!;
        return executePieceMove(state, aiColor, jumpingCav.id, chosen.to, nowMs, Math.random, chosen.kind);
      }
    }
    return stopCavalierJumpChain(state, aiColor, nowMs);
  }

  // 3. Handle pending Berserker Rage second move
  if (view.turn.pendingBerserkerRagePieceId) {
    const ragingBer = perceivedPieces.find((p) => p.id === view.turn.pendingBerserkerRagePieceId);
    if (ragingBer) {
      const rageMoves = generateMoveCandidatesForPiece(ragingBer, perceivedPieces, visContext, true);
      if (rageMoves.length > 0) {
        const forwardDelta = getInitialForwardDelta(aiColor);
        const forwardMove =
          rageMoves.find((m) => (m.to.row - m.from.row) * forwardDelta > 0) ?? rageMoves[0]!;
        return executePieceMove(
          state,
          aiColor,
          ragingBer.id,
          forwardMove.to,
          nowMs,
          Math.random,
          forwardMove.kind,
        );
      }
    }
    return skipBerserkerRageMove(state, aiColor, nowMs);
  }

  // 4. Medium/Hard AI: Free Traqueur Mark (0 action cost) if an unmarked revealed enemy is in range
  if (difficulty !== 'easy') {
    const ownTraqueur = perceivedPieces.find(
      (p) => p.owner === aiColor && p.character === 'traqueur' && p.alive,
    );
    if (ownTraqueur && !ownTraqueur.traqueurMarkedTargetId) {
      const markCandidates = generateTraqueurMarkCandidates(ownTraqueur, perceivedPieces, visContext);
      if (markCandidates.length > 0) {
        const bestTarget = [...markCandidates].sort(
          (a, b) => ROLE_VALUE[b.character] - ROLE_VALUE[a.character],
        )[0]!;
        try {
          return markTraqueurTarget(state, aiColor, ownTraqueur.id, bestTarget.id, nowMs);
        } catch {
          // Continue to standard move if marking is rejected
        }
      }
    }
  }

  // 5. Hard/Medium AI: Optional Tactical Card Play when advantageous
  if (difficulty !== 'easy' && view.turn.canPlayCardNow && view.ownHand.length > 0) {
    for (const card of view.ownHand) {
      try {
        if (card === 'double_action' || card === 'brouillard') {
          return playCard(state, aiColor, { card }, nowMs);
        }
        if (card === 'revelation_permanente' || card === 'revelation_temporaire') {
          const unknownEnemies = view.pieces.filter(
            (p) => p.owner !== aiColor && p.character === null,
          );
          if (unknownEnemies.length > 0) {
            return playCard(
              state,
              aiColor,
              { card, targetEnemyPieceId: unknownEnemies[0]!.id },
              nowMs,
            );
          }
        }
      } catch {
        // Ignore and proceed to piece movement
      }
    }
  }

  // 6. Evaluate all legal piece movements & attacks
  const ownPieces = perceivedPieces.filter((p) => p.owner === aiColor && p.alive && p.position);
  const forwardDelta = getInitialForwardDelta(aiColor);
  const perceivedPieceByCoord = new Map<string, ClientPieceView>();
  for (const pv of view.pieces) {
    perceivedPieceByCoord.set(coordKey(pv.position), pv);
  }

  interface ScoredMove {
    readonly piece: ServerPieceRecord;
    readonly move: MoveCandidate;
    readonly score: number;
  }

  const scoredMoves: ScoredMove[] = [];

  for (const piece of ownPieces) {
    const candidates = generateMoveCandidatesForPiece(piece, perceivedPieces, visContext, false);
    for (const move of candidates) {
      let score = 0;

      // Evaluate captures
      if (move.targetEnemyPieceId) {
        const targetView = view.pieces.find((pv) => pv.id === move.targetEnemyPieceId);
        if (targetView) {
          if (targetView.character === 'roi') {
            score += 10000; // Instant victory
          } else if (targetView.character) {
            score += 140 + ROLE_VALUE[targetView.character];
          } else {
            // Unrevealed enemy piece: average tactical value
            score += 135;
          }
        } else {
          score += 125;
        }

        // Ranged / piercing attacks don't expose the attacker
        if (move.kind === 'crossbow_shot' || move.kind === 'piercing_strike') {
          score += 45;
        } else if (move.kind === 'cavalier_jump') {
          score += 35;
        }
      }

      // Forward progression & center control
      const progressSteps = (move.to.row - move.from.row) * forwardDelta;
      if (piece.character !== 'roi') {
        score += progressSteps * 10;
        const centerDist = Math.abs(4 - move.to.col) + Math.abs(4 - move.to.row);
        score += (8 - centerDist) * 2;
      } else {
        // Keep the King safe on the back ranks unless capturing
        if (!move.targetEnemyPieceId) {
          score -= 35;
        }
      }

      // Soldier promotion bonus on reaching opponent back row
      const enemyEdge = aiColor === 'red' ? 0 : 8;
      if (piece.character === 'soldat' && move.to.row === enemyEdge) {
        score += 110;
      }

      // Slight deterministic/controlled jitter depending on difficulty
      const jitter =
        difficulty === 'easy'
          ? (Math.sin(move.from.row * 17 + move.to.col * 31 + state.turn.turnNumber) + 1) * 45
          : difficulty === 'medium'
            ? (Math.sin(move.from.col * 13 + move.to.row * 23 + state.turn.turnNumber) + 1) * 12
            : 0;

      scoredMoves.push({
        piece,
        move,
        score: score + jitter,
      });
    }
  }

  if (scoredMoves.length === 0) {
    return state;
  }

  scoredMoves.sort((a, b) => b.score - a.score);
  const chosen = scoredMoves[0]!;

  try {
    return executePieceMove(
      state,
      aiColor,
      chosen.piece.id,
      chosen.move.to,
      nowMs,
      Math.random,
      chosen.move.kind,
    );
  } catch {
    // Fallback to the first move that succeeds
    for (const alt of scoredMoves.slice(1)) {
      try {
        return executePieceMove(
          state,
          aiColor,
          alt.piece.id,
          alt.move.to,
          nowMs,
          Math.random,
          alt.move.kind,
        );
      } catch {
        continue;
      }
    }
    return state;
  }
}

// ============================================================================
// PREDEFINED TRAINING SITUATIONS (§10.A — Rejouer des situations prédéfinies)
// ============================================================================

export interface TrainingSituationSpec {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly difficulty: AiDifficulty;
  readonly focusCharacters: readonly CharacterType[];
  readonly description: string;
  readonly createInitialState: () => ServerMatchState;
}

function makeDrillPiece(
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

function buildDrillState(
  id: string,
  pieces: ServerPieceRecord[],
  redHand: readonly CardType[] = [],
  blackHand: readonly CardType[] = [],
): ServerMatchState {
  const base = createMatchState(`drill-${id}`, 'training');
  return {
    ...base,
    phase: 'playing',
    pieces,
    players: {
      ...base.players,
      red: {
        ...base.players.red,
        hand: [...redHand],
        placementConfirmed: true,
      },
      black: {
        ...base.players.black,
        hand: [...blackHand],
        placementConfirmed: true,
      },
    },
  };
}

export const TRAINING_SITUATIONS: readonly TrainingSituationSpec[] = [
  {
    id: 'drill-traqueur-hunt',
    title: 'Situation 1 : Traque & Ciblage Direct du Traqueur',
    subtitle: 'Sélectionnez le Traqueur et cliquez directement sur une cible révélée pour la marquer (0 PA).',
    difficulty: 'easy',
    focusCharacters: ['traqueur', 'guetteur_h', 'reine'],
    description:
      'Vos Guetteurs ont révélé l’avant-garde adverse. Sélectionnez votre Traqueur (E4) pour voir ses cibles directement sur l’échiquier, marquez gratuitement votre proie, puis menez l’assaut contre le Roi adverse.',
    createInitialState: () =>
      buildDrillState(
        'traqueur-hunt',
        [
          makeDrillPiece('r-king', 'red', 'roi', { row: 8, col: 4 }),
          makeDrillPiece('r-traq', 'red', 'traqueur', { row: 5, col: 4 }),
          makeDrillPiece('r-queen', 'red', 'reine', { row: 7, col: 3 }),
          makeDrillPiece('r-gh', 'red', 'guetteur_h', { row: 4, col: 3 }),
          makeDrillPiece('r-sol1', 'red', 'soldat', { row: 6, col: 2 }),
          makeDrillPiece('r-sol2', 'red', 'soldat', { row: 6, col: 6 }),
          makeDrillPiece('b-king', 'black', 'roi', { row: 0, col: 4 }),
          makeDrillPiece('b-target', 'black', 'berserker', { row: 3, col: 4 }, {
            permanentlyRevealedTo: { red: true, black: false },
          }),
          makeDrillPiece('b-guard1', 'black', 'soldat', { row: 2, col: 3 }, {
            permanentlyRevealedTo: { red: true, black: false },
          }),
          makeDrillPiece('b-guard2', 'black', 'cavalier', { row: 2, col: 5 }),
          makeDrillPiece('b-sol1', 'black', 'soldat', { row: 1, col: 4 }),
        ],
        ['revelation_permanente', 'double_action'],
      ),
  },
  {
    id: 'drill-executeur-colosse',
    title: 'Situation 2 : Briser le Colosse (Exécuteur & Kamikaze)',
    subtitle: 'Utilisez la Frappe traversante de l’Exécuteur ou un double Kamikaze contre le Colosse.',
    difficulty: 'medium',
    focusCharacters: ['executeur', 'colosse', 'roi'],
    description:
      'Un Colosse adverse révélé bloque le couloir central derrière un Soldat noir. Utilisez votre Exécuteur en E4 pour abattre le Colosse par Frappe traversante ou combinez vos unités royales.',
    createInitialState: () =>
      buildDrillState(
        'executeur-colosse',
        [
          makeDrillPiece('r-king', 'red', 'roi', { row: 8, col: 4 }),
          makeDrillPiece('r-exec', 'red', 'executeur', { row: 5, col: 4 }),
          makeDrillPiece('r-col', 'red', 'colosse', { row: 6, col: 3 }),
          makeDrillPiece('r-arb', 'red', 'arbaletrier', { row: 7, col: 5 }),
          makeDrillPiece('b-king', 'black', 'roi', { row: 0, col: 4 }),
          makeDrillPiece('b-front', 'black', 'soldat', { row: 4, col: 4 }, {
            permanentlyRevealedTo: { red: true, black: false },
          }),
          makeDrillPiece('b-col', 'black', 'colosse', { row: 3, col: 4 }, {
            permanentlyRevealedTo: { red: true, black: false },
          }),
          makeDrillPiece('b-ass1', 'black', 'assassin', { row: 2, col: 2 }),
          makeDrillPiece('b-ass2', 'black', 'assassin', { row: 2, col: 6 }),
        ],
        ['kamikaze', 'protection'],
      ),
  },
  {
    id: 'drill-arbaletrier-cavalier',
    title: 'Situation 3 : Tir d’Arbalète & Bond Équestre',
    subtitle: 'Combinez le tir à distance (1–3 cases) et les Bonds en « L » par-dessus la ligne de front.',
    difficulty: 'medium',
    focusCharacters: ['arbaletrier', 'cavalier', 'berserker'],
    description:
      'Tirez à distance avec votre Arbalétrier sans l’exposer, puis franchissez le mur de Soldats avec vos Cavaliers en « L » pour menacer le quartier général adverse.',
    createInitialState: () =>
      buildDrillState(
        'arbaletrier-cavalier',
        [
          makeDrillPiece('r-king', 'red', 'roi', { row: 8, col: 4 }),
          makeDrillPiece('r-arb', 'red', 'arbaletrier', { row: 6, col: 4 }),
          makeDrillPiece('r-cav1', 'red', 'cavalier', { row: 6, col: 2 }),
          makeDrillPiece('r-cav2', 'red', 'cavalier', { row: 6, col: 6 }),
          makeDrillPiece('r-ber', 'red', 'berserker', { row: 7, col: 4 }),
          makeDrillPiece('b-king', 'black', 'roi', { row: 0, col: 4 }),
          makeDrillPiece('b-line1', 'black', 'soldat', { row: 4, col: 2 }),
          makeDrillPiece('b-line2', 'black', 'soldat', { row: 4, col: 4 }),
          makeDrillPiece('b-line3', 'black', 'soldat', { row: 4, col: 6 }),
          makeDrillPiece('b-queen', 'black', 'reine', { row: 1, col: 3 }),
        ],
        ['teleportation', 'espionnage'],
      ),
  },
  {
    id: 'drill-endgame-kings',
    title: 'Situation 4 : Finale Tactique & Identités Cachées',
    subtitle: 'Débusquez le Roi adverse parmi ses gardes secrets grâce à vos Guetteurs et Assassins.',
    difficulty: 'hard',
    focusCharacters: ['assassin', 'guetteur_d', 'reine'],
    description:
      'En fin de partie, 5 unités noires non révélées protègent la dernière rangée. Approchez vos Guetteurs pour révéler le vrai Roi noir et portez le coup décisif.',
    createInitialState: () =>
      buildDrillState(
        'endgame-kings',
        [
          makeDrillPiece('r-king', 'red', 'roi', { row: 8, col: 4 }),
          makeDrillPiece('r-queen', 'red', 'reine', { row: 4, col: 4 }),
          makeDrillPiece('r-ass1', 'red', 'assassin', { row: 4, col: 2 }),
          makeDrillPiece('r-gd', 'red', 'guetteur_d', { row: 3, col: 5 }),
          makeDrillPiece('r-gh', 'red', 'guetteur_h', { row: 3, col: 3 }),
          makeDrillPiece('b-decoy1', 'black', 'soldat', { row: 1, col: 2 }),
          makeDrillPiece('b-decoy2', 'black', 'assassin', { row: 1, col: 3 }),
          makeDrillPiece('b-king', 'black', 'roi', { row: 1, col: 5 }),
          makeDrillPiece('b-decoy3', 'black', 'berserker', { row: 1, col: 6 }),
          makeDrillPiece('b-decoy4', 'black', 'soldat', { row: 2, col: 4 }),
        ],
        ['espionnage', 'revelation_temporaire', 'invincibilite'],
      ),
  },
];

/**
 * Create a full 27v27 match against the AI ready to play (or in placement phase).
 */
export function createAiTrainingMatch(
  difficulty: AiDifficulty = 'medium',
  autoPlaceHumanArmy: boolean = false,
): ServerMatchState {
  let state = createMatchState(`training-ai-${difficulty}-${Date.now()}`, 'training');
  const aiEntries = chooseAiPlacement('black', difficulty);
  state = submitPlayerPlacement(state, 'black', aiEntries, Date.now());
  if (autoPlaceHumanArmy) {
    const humanEntries = chooseAiPlacement('red', difficulty);
    state = submitPlayerPlacement(state, 'red', humanEntries, Date.now());
  }
  return state;
}

/**
 * Project a match state for a neutral Spectator (§10.C):
 * - Displays ONLY information authorized by the rules for a neutral observer.
 * - Unrevealed pieces stay masked unless permanently revealed to both or publicly exposed.
 * - Secret hands, traps, Kamikaze, Protection, and Counter-Espionage remain strictly hidden.
 */
export function projectMatchStateForSpectator(state: ServerMatchState): ClientMatchView {
  const redView = projectMatchStateForViewer(state, 'red');
  const blackView = projectMatchStateForViewer(state, 'black');
  const blackPieceMap = new Map(blackView.pieces.map((p) => [p.id, p]));

  const spectatorPieces: ClientPieceView[] = redView.pieces.map((rp) => {
    const bp = blackPieceMap.get(rp.id);
    // An observer only sees a piece's identity if the opponent has revealed it
    const revealedToOpponent =
      rp.owner === 'red'
        ? bp?.character !== null && bp?.character !== undefined
        : rp.character !== null;
    const exposedChar = revealedToOpponent
      ? rp.owner === 'red'
        ? (bp?.character ?? null)
        : rp.character
      : null;

    return {
      ...rp,
      character: exposedChar,
      revealKind: exposedChar ? 'permanent' : 'none',
      isProtectedVisible: false,
      hasKamikazeVisible: false,
      hasCounterEspionageVisible: false,
      traqueurHasActiveMarkVisible: false,
      traqueurPursuitReadyVisible: false,
      traqueurMarkedByViewer: false,
    };
  });

  return {
    ...redView,
    pieces: spectatorPieces,
    ownTraps: [],
    ownHand: [],
    guetteurReconCoords: [],
    ownConfirmedPlacement: [],
    ownLastCardDraw: null,
  };
}
