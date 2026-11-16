import type {
  Coord,
  PlayerColor,
  ServerPieceRecord,
} from '../types/core.js';
import { CHARACTER_CATALOG } from '../constants/army.js';
import {
  coordKey,
  getInitialForwardDelta,
  isWithinBoard,
} from '../constants/board.js';
import {
  type VisibilityContext,
  resolvePieceRevealKindForViewer,
} from './visibility.js';

export type MoveCandidateKind =
  | 'normal_move'
  | 'capture_move'
  | 'cavalier_jump'
  | 'piercing_strike'
  | 'crossbow_shot';

export interface MoveCandidate {
  readonly from: Coord;
  readonly to: Coord;
  readonly kind: MoveCandidateKind;
  readonly targetEnemyPieceId: string | null;
  readonly passedThroughEnemyPieceId?: string | null;
}

const ALL_EIGHT_DIRECTIONS: readonly Coord[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
  { row: -1, col: -1 },
  { row: -1, col: 1 },
  { row: 1, col: -1 },
  { row: 1, col: 1 },
];

const ORTHOGONAL_DIRECTIONS: readonly Coord[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

const DIAGONAL_DIRECTIONS: readonly Coord[] = [
  { row: -1, col: -1 },
  { row: -1, col: 1 },
  { row: 1, col: -1 },
  { row: 1, col: 1 },
];

/** Offsets du Bond en « L » du Cavalier reworké (passe par-dessus toute pièce intermédiaire). */
const KNIGHT_LEAP_OFFSETS: readonly Coord[] = [
  { row: -2, col: -1 },
  { row: -2, col: 1 },
  { row: -1, col: -2 },
  { row: -1, col: 2 },
  { row: 1, col: -2 },
  { row: 1, col: 2 },
  { row: 2, col: -1 },
  { row: 2, col: 1 },
];

const VERTICAL_DIRECTIONS: readonly Coord[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
];

/** Return the exact 5 movement directions of a Colossus based on its current progression (§6.6, §24). */
export function getColossusDirections(progressionDirection: -1 | 1): Coord[] {
  return [
    { row: progressionDirection, col: 0 }, // 1. Tout droit vers l'avant
    { row: progressionDirection, col: -1 }, // 2. Diagonale avant gauche
    { row: progressionDirection, col: 1 }, // 3. Diagonale avant droite
    { row: 0, col: -1 }, // 4. Horizontalement à gauche
    { row: 0, col: 1 }, // 5. Horizontalement à droite
  ];
}

/** Return the 3 forward directions of a Soldier based on its owner color (§6.9). */
export function getSoldierDirections(owner: PlayerColor): Coord[] {
  const forwardDelta = getInitialForwardDelta(owner);
  return [
    { row: forwardDelta, col: 0 },
    { row: forwardDelta, col: -1 },
    { row: forwardDelta, col: 1 },
  ];
}

/**
 * Check whether `attacker` is allowed to select `occupant` as a direct attack target in the UI:
 * - Invincible pieces are never selectable (§7, §8.2, §21.14).
 * - If `occupant` is an already-known Colossus and `attacker` cannot kill a Colossus, direct attack is blocked (Q6).
 * - If `occupant` is an unknown Colossus, targeting remains allowed so the identity is not leaked before attempting (Q6).
 */
export function canSelectEnemyForDirectAttack(
  attacker: ServerPieceRecord,
  occupant: ServerPieceRecord,
  visibilityContextForOwner: VisibilityContext,
): boolean {
  if (occupant.owner === attacker.owner) {
    return false;
  }

  const revealState = resolvePieceRevealKindForViewer(
    occupant,
    attacker.owner,
    visibilityContextForOwner,
  );
  const isKnownColossus = occupant.character === 'colosse' && revealState !== 'none';
  if (isKnownColossus && !CHARACTER_CATALOG[attacker.character].canKillColossus) {
    return false;
  }

  return true;
}

/**
 * Generate Cavalier jump candidates from `piece.position` (§6.5, Contradiction #2, §21.4, §21.5).
 */
export function generateCavalierJumpCandidates(
  piece: ServerPieceRecord,
  allPieces: readonly ServerPieceRecord[],
  visibilityContextForOwner: VisibilityContext,
): MoveCandidate[] {
  if (
    piece.character !== 'cavalier' ||
    !piece.alive ||
    piece.position === null ||
    piece.immobilizedTicksRemaining > 0
  ) {
    return [];
  }

  const boardMap = new Map<string, ServerPieceRecord>();
  for (const p of allPieces) {
    if (p.alive && p.position !== null) {
      boardMap.set(coordKey(p.position), p);
    }
  }

  const origin = piece.position;
  const jumps: MoveCandidate[] = [];

  for (const d of ALL_EIGHT_DIRECTIONS) {
    const jumpedCoord: Coord = { row: origin.row + d.row, col: origin.col + d.col };
    const landingCoord: Coord = { row: origin.row + d.row * 2, col: origin.col + d.col * 2 };
    if (!isWithinBoard(jumpedCoord) || !isWithinBoard(landingCoord)) {
      continue;
    }

    const jumpedPiece = boardMap.get(coordKey(jumpedCoord));
    const landingOccupant = boardMap.get(coordKey(landingCoord));
    if (!jumpedPiece || jumpedPiece.owner === piece.owner || landingOccupant) {
      continue;
    }

    // Cannot jump over an already-known Colossus (§6.5, §21.5)
    // Note: Invincibilité is secret to the opponent, so jump candidates are not pre-filtered by invincibleTicksRemaining;
    // instead, jumping an Invincible piece interrupts the jump in resolveCavalierSingleJump.
    const revealState = resolvePieceRevealKindForViewer(
      jumpedPiece,
      piece.owner,
      visibilityContextForOwner,
    );
    const isKnownColossus = jumpedPiece.character === 'colosse' && revealState !== 'none';
    if (isKnownColossus) {
      continue;
    }

    jumps.push({
      from: origin,
      to: landingCoord,
      kind: 'cavalier_jump',
      targetEnemyPieceId: jumpedPiece.id,
    });
  }

  return jumps;
}

/**
 * Generate legal movement & attack candidates for `piece` according to validated rules (§6, §7, §21, §24, Q1–Q6).
 */
export function generateMoveCandidatesForPiece(
  piece: ServerPieceRecord,
  allPieces: readonly ServerPieceRecord[],
  visibilityContextForOwner: VisibilityContext,
  isBerserkerRageSecondMove: boolean = false,
): MoveCandidate[] {
  if (!piece.alive || piece.position === null || piece.immobilizedTicksRemaining > 0) {
    return [];
  }

  const boardMap = new Map<string, ServerPieceRecord>();
  for (const p of allPieces) {
    if (p.alive && p.position !== null) {
      boardMap.set(coordKey(p.position), p);
    }
  }

  const origin = piece.position;
  const candidates: MoveCandidate[] = [];

  const tryAddSingleStep = (delta: Coord, allowEmpty: boolean, allowCapture: boolean): void => {
    const dest: Coord = { row: origin.row + delta.row, col: origin.col + delta.col };
    if (!isWithinBoard(dest)) {
      return;
    }
    const occupant = boardMap.get(coordKey(dest));
    if (!occupant) {
      if (allowEmpty) {
        candidates.push({
          from: origin,
          to: dest,
          kind: 'normal_move',
          targetEnemyPieceId: null,
        });
      }
      return;
    }

    if (
      allowCapture &&
      !isBerserkerRageSecondMove &&
      canSelectEnemyForDirectAttack(piece, occupant, visibilityContextForOwner)
    ) {
      candidates.push({
        from: origin,
        to: dest,
        kind: 'capture_move',
        targetEnemyPieceId: occupant.id,
      });
    }
  };

  const tryAddRayUpToTwo = (directions: readonly Coord[], allowCapture: boolean): void => {
    for (const dir of directions) {
      for (let step = 1; step <= 2; step += 1) {
        const dest: Coord = {
          row: origin.row + dir.row * step,
          col: origin.col + dir.col * step,
        };
        if (!isWithinBoard(dest)) {
          break;
        }
        const occupant = boardMap.get(coordKey(dest));
        if (!occupant) {
          candidates.push({
            from: origin,
            to: dest,
            kind: 'normal_move',
            targetEnemyPieceId: null,
          });
          continue;
        }

        // Cannot pass through any piece (§6.7, §6.8)
        if (
          allowCapture &&
          !isBerserkerRageSecondMove &&
          canSelectEnemyForDirectAttack(piece, occupant, visibilityContextForOwner)
        ) {
          candidates.push({
            from: origin,
            to: dest,
            kind: 'capture_move',
            targetEnemyPieceId: occupant.id,
          });
        }
        break;
      }
    }
  };

  const forwardDelta = getInitialForwardDelta(piece.owner);

  switch (piece.character) {
    case 'guetteur_h': {
      for (const d of DIAGONAL_DIRECTIONS) {
        tryAddSingleStep(d, true, true);
      }
      break;
    }

    case 'guetteur_d': {
      // Validated: Guetteur D moves 1 square horizontally or vertically (all 4 orthogonal directions)
      for (const d of ORTHOGONAL_DIRECTIONS) {
        tryAddSingleStep(d, true, true);
      }
      break;
    }

    case 'assassin':
    case 'roi': {
      for (const d of ALL_EIGHT_DIRECTIONS) {
        tryAddSingleStep(d, true, true);
      }
      break;
    }

    case 'colosse': {
      for (const d of getColossusDirections(piece.progressionDirection)) {
        tryAddSingleStep(d, true, true);
      }
      break;
    }

    case 'reine': {
      tryAddRayUpToTwo(ALL_EIGHT_DIRECTIONS, true);
      break;
    }

    case 'berserker': {
      tryAddRayUpToTwo(ORTHOGONAL_DIRECTIONS, !isBerserkerRageSecondMove);
      break;
    }

    case 'soldat': {
      // Straight forward: movement only, CANNOT capture (§6.9, §21.1, §24)
      tryAddSingleStep({ row: forwardDelta, col: 0 }, true, false);
      // Forward diagonals: movement and capture (§6.9, §21.1, §24)
      tryAddSingleStep({ row: forwardDelta, col: -1 }, true, true);
      tryAddSingleStep({ row: forwardDelta, col: 1 }, true, true);
      break;
    }

    case 'cavalier': {
      // Rework Cavalier : pas orthogonal d'1 case + Bond en « L » (passe par-dessus tout obstacle) + Saut Percée en chaîne
      for (const d of ORTHOGONAL_DIRECTIONS) {
        tryAddSingleStep(d, true, true);
      }
      for (const leap of KNIGHT_LEAP_OFFSETS) {
        tryAddSingleStep(leap, true, true);
      }
      candidates.push(
        ...generateCavalierJumpCandidates(piece, allPieces, visibilityContextForOwner),
      );
      break;
    }

    case 'traqueur': {
      const markedTarget =
        !isBerserkerRageSecondMove &&
        piece.traqueurMarkedTargetId &&
        piece.traqueurPursuitReady
          ? allPieces.find(
              (p) =>
                p.id === piece.traqueurMarkedTargetId &&
                p.alive &&
                p.position !== null &&
                p.owner !== piece.owner &&
                resolvePieceRevealKindForViewer(p, piece.owner, visibilityContextForOwner) !== 'none',
            ) ?? null
          : null;

      for (const dir of ORTHOGONAL_DIRECTIONS) {
        let rayClearUpToThree = true;
        for (let step = 1; step <= 3; step += 1) {
          const dest: Coord = {
            row: origin.row + dir.row * step,
            col: origin.col + dir.col * step,
          };
          if (!isWithinBoard(dest)) {
            rayClearUpToThree = false;
            break;
          }
          const occupant = boardMap.get(coordKey(dest));
          if (!occupant) {
            candidates.push({
              from: origin,
              to: dest,
              kind: 'normal_move',
              targetEnemyPieceId: null,
            });
            continue;
          }

          if (
            !isBerserkerRageSecondMove &&
            canSelectEnemyForDirectAttack(piece, occupant, visibilityContextForOwner)
          ) {
            candidates.push({
              from: origin,
              to: dest,
              kind: 'capture_move',
              targetEnemyPieceId: occupant.id,
            });
          }
          rayClearUpToThree = false;
          break;
        }

        // Poursuite (+1 case = jusqu'à 4 cases) au tour suivant, strictement pour se rapprocher de la cible marquée
        if (rayClearUpToThree && markedTarget && markedTarget.position !== null) {
          const dest4: Coord = {
            row: origin.row + dir.row * 4,
            col: origin.col + dir.col * 4,
          };
          if (isWithinBoard(dest4)) {
            const targetPos = markedTarget.position;
            const manhattanBefore =
              Math.abs(origin.row - targetPos.row) + Math.abs(origin.col - targetPos.col);
            const manhattanAfter =
              Math.abs(dest4.row - targetPos.row) + Math.abs(dest4.col - targetPos.col);
            const dirDot =
              dir.row * (targetPos.row - origin.row) + dir.col * (targetPos.col - origin.col);
            if (manhattanAfter < manhattanBefore && dirDot > 0) {
              const occ4 = boardMap.get(coordKey(dest4));
              if (!occ4) {
                candidates.push({
                  from: origin,
                  to: dest4,
                  kind: 'normal_move',
                  targetEnemyPieceId: null,
                });
              } else if (
                occ4.id === markedTarget.id &&
                canSelectEnemyForDirectAttack(piece, occ4, visibilityContextForOwner)
              ) {
                candidates.push({
                  from: origin,
                  to: dest4,
                  kind: 'capture_move',
                  targetEnemyPieceId: occ4.id,
                });
              }
            }
          }
        }
      }
      break;
    }

    case 'executeur': {
      for (const dir of ORTHOGONAL_DIRECTIONS) {
        const step1: Coord = { row: origin.row + dir.row, col: origin.col + dir.col };
        if (!isWithinBoard(step1)) {
          continue;
        }
        const occ1 = boardMap.get(coordKey(step1));
        if (!occ1) {
          candidates.push({
            from: origin,
            to: step1,
            kind: 'normal_move',
            targetEnemyPieceId: null,
          });
          const step2: Coord = {
            row: origin.row + dir.row * 2,
            col: origin.col + dir.col * 2,
          };
          if (isWithinBoard(step2)) {
            const occ2 = boardMap.get(coordKey(step2));
            if (!occ2) {
              candidates.push({
                from: origin,
                to: step2,
                kind: 'normal_move',
                targetEnemyPieceId: null,
              });
            } else if (
              !isBerserkerRageSecondMove &&
              canSelectEnemyForDirectAttack(piece, occ2, visibilityContextForOwner)
            ) {
              candidates.push({
                from: origin,
                to: step2,
                kind: 'capture_move',
                targetEnemyPieceId: occ2.id,
              });
            }
          }
          continue;
        }

        // Case intermédiaire occupée : allié interdit ; ennemi autorise attaque directe OU Frappe traversante
        if (occ1.owner === piece.owner) {
          continue;
        }

        if (
          !isBerserkerRageSecondMove &&
          canSelectEnemyForDirectAttack(piece, occ1, visibilityContextForOwner)
        ) {
          candidates.push({
            from: origin,
            to: step1,
            kind: 'capture_move',
            targetEnemyPieceId: occ1.id,
          });
        }

        if (!isBerserkerRageSecondMove) {
          const occ1Reveal = resolvePieceRevealKindForViewer(
            occ1,
            piece.owner,
            visibilityContextForOwner,
          );
          const occ1IsKnownColossus = occ1.character === 'colosse' && occ1Reveal !== 'none';
          if (!occ1IsKnownColossus) {
            const step2: Coord = {
              row: origin.row + dir.row * 2,
              col: origin.col + dir.col * 2,
            };
            if (isWithinBoard(step2)) {
              const occ2 = boardMap.get(coordKey(step2));
              if (occ2 && occ2.owner !== piece.owner) {
                // Frappe traversante : peut cibler n'importe quel ennemi derrière occ1 (y compris le Colosse ou derrière le Roi)
                candidates.push({
                  from: origin,
                  to: step2,
                  kind: 'piercing_strike',
                  targetEnemyPieceId: occ2.id,
                  passedThroughEnemyPieceId: occ1.id,
                });
              }
            }
          }
        }
      }
      break;
    }

    case 'arbaletrier': {
      // Déplacement normal d'1 case H/V
      for (const d of ORTHOGONAL_DIRECTIONS) {
        tryAddSingleStep(d, true, true);
      }

      // Tir d'arbalète à distance (1 à 3 cases dans les 8 directions, ligne dégagée, 1 tir tous les 3 tours personnels)
      if (!isBerserkerRageSecondMove && (piece.arbaletrierCooldownTurnsRemaining ?? 0) === 0) {
        for (const dir of ALL_EIGHT_DIRECTIONS) {
          for (let step = 1; step <= 3; step += 1) {
            const dest: Coord = {
              row: origin.row + dir.row * step,
              col: origin.col + dir.col * step,
            };
            if (!isWithinBoard(dest)) {
              break;
            }
            const occupant = boardMap.get(coordKey(dest));
            if (!occupant) {
              continue;
            }
            if (
              occupant.owner !== piece.owner &&
              canSelectEnemyForDirectAttack(piece, occupant, visibilityContextForOwner)
            ) {
              candidates.push({
                from: origin,
                to: dest,
                kind: 'crossbow_shot',
                targetEnemyPieceId: occupant.id,
              });
            }
            // Aucune pièce ne peut être traversée par un tir d'arbalète
            break;
          }
        }
      }
      break;
    }
  }

  return candidates;
}

/**
 * Generate valid target squares for the `Retreat` card (§8.4, §21.21, Q22):
 * Moves a piece 1 square backward (straight backward or backward diagonals? §8.4 says "reculer d'une case",
 * authorizing backward movement and backward elimination if combat rules allow).
 */
export function generateRetreatCandidatesForPiece(
  piece: ServerPieceRecord,
  allPieces: readonly ServerPieceRecord[],
  visibilityContextForOwner: VisibilityContext,
): MoveCandidate[] {
  if (!piece.alive || piece.position === null || piece.immobilizedTicksRemaining > 0) {
    return [];
  }

  const boardMap = new Map<string, ServerPieceRecord>();
  for (const p of allPieces) {
    if (p.alive && p.position !== null) {
      boardMap.set(coordKey(p.position), p);
    }
  }

  const backwardRowDelta =
    piece.character === 'colosse'
      ? (-piece.progressionDirection as -1 | 1)
      : (-getInitialForwardDelta(piece.owner) as -1 | 1);

  const backwardDirections: readonly Coord[] = [
    { row: backwardRowDelta, col: 0 },
    { row: backwardRowDelta, col: -1 },
    { row: backwardRowDelta, col: 1 },
  ];

  const origin = piece.position;
  const candidates: MoveCandidate[] = [];

  for (const d of backwardDirections) {
    const dest: Coord = { row: origin.row + d.row, col: origin.col + d.col };
    if (!isWithinBoard(dest)) {
      continue;
    }
    const occupant = boardMap.get(coordKey(dest));
    if (!occupant) {
      candidates.push({
        from: origin,
        to: dest,
        kind: 'normal_move',
        targetEnemyPieceId: null,
      });
    } else if (canSelectEnemyForDirectAttack(piece, occupant, visibilityContextForOwner)) {
      candidates.push({
        from: origin,
        to: dest,
        kind: 'capture_move',
        targetEnemyPieceId: occupant.id,
      });
    }
  }

  return candidates;
}

/**
 * Generate valid target squares for the `Téléportation` card (§8.10, §21.20, Q21):
 * - Up to 2 squares
 * - Path must be clear (no obstacle crossed) and destination square must be empty
 * - Respects directional restrictions of Soldier (3 forward directions) and Colossus (5 progression directions) per Q21!
 */
export function generateTeleportCandidatesForPiece(
  piece: ServerPieceRecord,
  allPieces: readonly ServerPieceRecord[],
): Coord[] {
  if (!piece.alive || piece.position === null || piece.immobilizedTicksRemaining > 0) {
    return [];
  }

  const occupied = new Set<string>();
  for (const p of allPieces) {
    if (p.alive && p.position !== null) {
      occupied.add(coordKey(p.position));
    }
  }

  let allowedDirections: readonly Coord[] = ALL_EIGHT_DIRECTIONS;
  if (piece.character === 'soldat') {
    allowedDirections = getSoldierDirections(piece.owner);
  } else if (piece.character === 'colosse') {
    allowedDirections = getColossusDirections(piece.progressionDirection);
  }

  const origin = piece.position;
  const validTargets: Coord[] = [];

  for (const dir of allowedDirections) {
    for (let step = 1; step <= 2; step += 1) {
      const dest: Coord = {
        row: origin.row + dir.row * step,
        col: origin.col + dir.col * step,
      };
      if (!isWithinBoard(dest)) {
        break;
      }
      if (occupied.has(coordKey(dest))) {
        // Obstacle blocks the path (§8.10, §21.20)
        break;
      }
      validTargets.push(dest);
    }
  }

  return validTargets;
}

/**
 * Generate all legal enemy pieces that a Traqueur may mark right now (§3.3):
 * - Target must be an enemy piece already revealed to the Traqueur's owner
 * - Orthogonal alignment at distance 1 to 3
 * - Clear line of sight (no piece in between)
 */
export function generateTraqueurMarkCandidates(
  piece: ServerPieceRecord,
  allPieces: readonly ServerPieceRecord[],
  visibilityContextForOwner: VisibilityContext,
): ServerPieceRecord[] {
  if (
    piece.character !== 'traqueur' ||
    !piece.alive ||
    piece.position === null ||
    piece.immobilizedTicksRemaining > 0
  ) {
    return [];
  }

  const boardMap = new Map<string, ServerPieceRecord>();
  for (const p of allPieces) {
    if (p.alive && p.position !== null) {
      boardMap.set(coordKey(p.position), p);
    }
  }

  const origin = piece.position;
  const targets: ServerPieceRecord[] = [];

  for (const dir of ORTHOGONAL_DIRECTIONS) {
    for (let step = 1; step <= 3; step += 1) {
      const sq: Coord = {
        row: origin.row + dir.row * step,
        col: origin.col + dir.col * step,
      };
      if (!isWithinBoard(sq)) {
        break;
      }
      const occupant = boardMap.get(coordKey(sq));
      if (!occupant) {
        continue;
      }
      // Cannot cross any piece; stop scan at first piece
      if (occupant.owner !== piece.owner) {
        const reveal = resolvePieceRevealKindForViewer(
          occupant,
          piece.owner,
          visibilityContextForOwner,
        );
        if (reveal !== 'none') {
          targets.push(occupant);
        }
      }
      break;
    }
  }

  return targets;
}

/** Check whether a player has at least one legal piece move on the board. */
export function hasAnyLegalPieceMove(
  playerColor: PlayerColor,
  allPieces: readonly ServerPieceRecord[],
  visibilityContextForPlayer: VisibilityContext,
): boolean {
  for (const piece of allPieces) {
    if (!piece.alive || piece.owner !== playerColor) {
      continue;
    }
    const moves = generateMoveCandidatesForPiece(
      piece,
      allPieces,
      visibilityContextForPlayer,
      false,
    );
    if (moves.length > 0) {
      return true;
    }
  }
  return false;
}
