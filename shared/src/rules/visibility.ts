import type {
  ClientPieceView,
  Coord,
  GraveyardEntryView,
  PlayerColor,
  RevealKind,
  ServerGraveyardRecord,
  ServerPieceRecord,
} from '../types/core.js';
import { CHARACTER_CATALOG } from '../constants/army.js';
import { coordKey, getOpponentColor, isWithinBoard } from '../constants/board.js';

const ORTHOGONAL_DELTAS: readonly Coord[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

const DIAGONAL_DELTAS: readonly Coord[] = [
  { row: -1, col: -1 },
  { row: -1, col: 1 },
  { row: 1, col: -1 },
  { row: 1, col: 1 },
];

/**
 * Return the squares observed by a single alive Guetteur (§6.1, §6.2):
 * - Guetteur H: orthogonal neighbors at distance 1
 * - Guetteur D: diagonal neighbors at distance 1
 */
export function getGuetteurDetectionCoords(piece: ServerPieceRecord): Coord[] {
  if (!piece.alive || piece.position === null) {
    return [];
  }

  let deltas: readonly Coord[] = [];
  if (piece.character === 'guetteur_h') {
    deltas = ORTHOGONAL_DELTAS;
  } else if (piece.character === 'guetteur_d') {
    deltas = DIAGONAL_DELTAS;
  } else {
    return [];
  }

  const coords: Coord[] = [];
  for (const d of deltas) {
    const target: Coord = {
      row: piece.position.row + d.row,
      col: piece.position.col + d.col,
    };
    if (isWithinBoard(target)) {
      coords.push(target);
    }
  }
  return coords;
}

/**
 * Compute the set of coordinate keys currently under proximity reconnaissance
 * by all alive Guetteurs belonging to `viewerColor` (§6.1, §6.2).
 */
export function computeGuetteurReconZoneKeys(
  allPieces: readonly ServerPieceRecord[],
  viewerColor: PlayerColor,
): Set<string> {
  const keys = new Set<string>();
  for (const piece of allPieces) {
    if (!piece.alive || piece.owner !== viewerColor) {
      continue;
    }
    if (piece.character === 'guetteur_h' || piece.character === 'guetteur_d') {
      for (const coord of getGuetteurDetectionCoords(piece)) {
        keys.add(coordKey(coord));
      }
    }
  }
  return keys;
}

export interface VisibilityContext {
  /** Remaining Brouillard turns active for each player's army (§8.8, §21.3, §21.16). */
  readonly fogTurnsRemainingByOwner: Readonly<Record<PlayerColor, number>>;
  /** Precomputed set of coordinate keys observed by `viewerColor`'s alive Guetteurs. */
  readonly viewerGuetteurReconKeys: ReadonlySet<string>;
}

/**
 * Determine the visibility state (`RevealKind`) of `piece` for `viewerColor` (§4.1–§4.5, §8.8, §8.9, §8.15, §21.3, §21.17).
 */
export function resolvePieceRevealKindForViewer(
  piece: ServerPieceRecord,
  viewerColor: PlayerColor,
  context: VisibilityContext,
): RevealKind {
  if (piece.owner === viewerColor) {
    return 'permanent';
  }

  // Permanent revelations (Assassin or Révélation permanente) cannot be cancelled by Brouillard or Contre-espionnage (§4.3, §8.6, §8.8, §8.15)
  if (piece.permanentlyRevealedTo[viewerColor]) {
    return 'permanent';
  }

  // Brouillard on the piece owner's army blocks all temporary & Guetteur revelations (§8.8, §21.3, §24)
  if (context.fogTurnsRemainingByOwner[piece.owner] > 0) {
    return 'none';
  }

  // Espionnage bypasses Contre-espionnage (§8.9, §8.15, §21.17, Q12)
  if (piece.espionageRevealedTicksTo[viewerColor] > 0) {
    return 'temporary';
  }

  // Contre-espionnage blocks standard temporary revelations and Guetteur proximity (§8.15)
  if (piece.counterEspionageTicksRemaining > 0) {
    return 'none';
  }

  if (piece.tempRevealedTicksTo[viewerColor] > 0) {
    return 'temporary';
  }

  if (piece.position !== null && context.viewerGuetteurReconKeys.has(coordKey(piece.position))) {
    return 'proximity';
  }

  return 'none';
}

/**
 * Project an authoritative `ServerPieceRecord` into a client-safe `ClientPieceView`
 * for `viewerColor` (§4.5, §9, §19, §21.10, Q12).
 * Guarantees that hidden enemy identities and secret buffs are stripped before network transmission.
 */
export function projectPieceForViewer(
  piece: ServerPieceRecord,
  viewerColor: PlayerColor,
  context: VisibilityContext,
  markedTargetIdsByViewer?: ReadonlySet<string>,
): ClientPieceView {
  if (piece.position === null) {
    throw new Error(`Cannot project off-board piece ${piece.id} onto board view.`);
  }

  const isOwner = piece.owner === viewerColor;
  const revealKind = resolvePieceRevealKindForViewer(piece, viewerColor, context);
  const isIdentityVisible = isOwner || revealKind !== 'none';

  // Validated rule: When a player uses any card (Espionnage, Invincibilité, Kamikaze, Protection, Contre-espionnage),
  // the opponent is notified of the card used in the log/banner, but NEVER knows which piece was targeted.
  const isExposedByEnemyEspionage = false;

  return {
    id: piece.id,
    owner: piece.owner,
    position: piece.position,
    character: isIdentityVisible ? piece.character : null,
    revealKind,
    isInvincible: isOwner ? piece.invincibleTicksRemaining > 0 : false,
    isImmobilized: piece.immobilizedTicksRemaining > 0,
    isExposedByEnemyEspionage,
    isProtectedVisible: isOwner ? piece.hasProtection : false,
    hasKamikazeVisible: isOwner ? piece.hasKamikaze : false,
    hasCounterEspionageVisible: isOwner ? piece.counterEspionageTicksRemaining > 0 : false,
    kamikazeHitsTakenVisible:
      isIdentityVisible && piece.character === 'colosse' ? piece.kamikazeHitsTaken : null,
    progressionDirectionVisible:
      isIdentityVisible && piece.character === 'colosse' ? piece.progressionDirection : null,
    traqueurMarkedByViewer:
      !isOwner && revealKind !== 'none' && (markedTargetIdsByViewer?.has(piece.id) ?? false),
    traqueurHasActiveMarkVisible:
      isOwner && piece.character === 'traqueur'
        ? Boolean(piece.traqueurMarkedTargetId)
        : false,
    traqueurPursuitReadyVisible:
      isOwner && piece.character === 'traqueur'
        ? Boolean(piece.traqueurMarkedTargetId && piece.traqueurPursuitReady)
        : false,
    arbaletrierCooldownTurnsVisible:
      isOwner && piece.character === 'arbaletrier'
        ? (piece.arbaletrierCooldownTurnsRemaining ?? 0)
        : null,
  };
}

/**
 * Create an authoritative graveyard record at the exact moment a piece is eliminated (§4.4, §7, §21.2, §21.13).
 */
export function createGraveyardRecordOnElimination(
  eliminatedPiece: ServerPieceRecord,
  attackerPiece: ServerPieceRecord | null,
  killerTriggeredKamikazeDeath: boolean,
  opponentColor: PlayerColor,
  opponentVisibilityContext: VisibilityContext,
  wasSacrificed: boolean = false,
): ServerGraveyardRecord {
  const revealAtDeath = resolvePieceRevealKindForViewer(
    eliminatedPiece,
    opponentColor,
    opponentVisibilityContext,
  );

  // Case 3 (§4.4, §7, §21.13): Assassin reveals permanently UNLESS killed by Kamikaze
  const assassinRevealed =
    attackerPiece !== null &&
    attackerPiece.owner === opponentColor &&
    attackerPiece.character === 'assassin' &&
    !killerTriggeredKamikazeDeath;

  if (assassinRevealed) {
    return {
      pieceId: eliminatedPiece.id,
      owner: eliminatedPiece.owner,
      characterAtDeath: eliminatedPiece.character,
      wasSacrificed,
      knownToOpponentAtDeath: true,
      knownReason: 'assassin',
    };
  }

  // Case 2 (§4.4, §21.2): Identity was visible to the opponent at the moment of elimination
  if (revealAtDeath === 'permanent') {
    return {
      pieceId: eliminatedPiece.id,
      owner: eliminatedPiece.owner,
      characterAtDeath: eliminatedPiece.character,
      wasSacrificed,
      knownToOpponentAtDeath: true,
      knownReason: 'permanent_revelation',
    };
  }

  if (revealAtDeath === 'temporary' || revealAtDeath === 'proximity') {
    return {
      pieceId: eliminatedPiece.id,
      owner: eliminatedPiece.owner,
      characterAtDeath: eliminatedPiece.character,
      wasSacrificed,
      knownToOpponentAtDeath: true,
      knownReason: 'temporary_or_proximity',
    };
  }

  // Case 1 (§4.4): Unknown at the moment of elimination -> remains strictly anonymous
  return {
    pieceId: eliminatedPiece.id,
    owner: eliminatedPiece.owner,
    characterAtDeath: eliminatedPiece.character,
    wasSacrificed,
    knownToOpponentAtDeath: false,
    knownReason: null,
  };
}

/**
 * Project a graveyard record for a specific viewer (§4.4, §21.2).
 */
export function projectGraveyardEntryForViewer(
  record: ServerGraveyardRecord,
  viewerColor: PlayerColor,
): GraveyardEntryView {
  const charName = CHARACTER_CATALOG[record.characterAtDeath].name;

  if (record.owner === viewerColor) {
    return {
      pieceId: record.pieceId,
      owner: record.owner,
      known: true,
      character: record.characterAtDeath,
      label: `${charName} éliminé`,
      reason: 'owner',
    };
  }

  if (record.knownToOpponentAtDeath && record.knownReason !== null) {
    return {
      pieceId: record.pieceId,
      owner: record.owner,
      known: true,
      character: record.characterAtDeath,
      label: `${charName} éliminé`,
      reason: record.knownReason,
    };
  }

  return {
    pieceId: record.pieceId,
    owner: record.owner,
    known: false,
    character: null,
    label: 'Pièce éliminée',
  };
}
