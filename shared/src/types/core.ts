/**
 * Core domain types shared between server, game engine, and client.
 *
 * Security rule (§4.5, §19): Client-facing view types never carry hidden
 * enemy character identities. Only the server holds `ServerPieceRecord`.
 */

export type PlayerColor = 'red' | 'black';

export type CharacterType =
  | 'guetteur_h'
  | 'guetteur_d'
  | 'assassin'
  | 'roi'
  | 'cavalier'
  | 'colosse'
  | 'reine'
  | 'berserker'
  | 'traqueur'
  | 'executeur'
  | 'arbaletrier'
  | 'soldat';

export type CardType =
  | 'kamikaze'
  | 'invincibilite'
  | 'block'
  | 'retreat'
  | 'revelation_temporaire'
  | 'revelation_permanente'
  | 'resurrection'
  | 'brouillard'
  | 'espionnage'
  | 'teleportation'
  | 'protection'
  | 'recrutement'
  | 'double_action'
  | 'piege'
  | 'contre_espionnage'
  | 'sacrifice';

export type GameMode =
  | 'local'
  | 'online_custom'
  | 'matchmaking_quick'
  | 'matchmaking_ranked'
  | 'matchmaking_unranked'
  | 'training';

export type MatchPhase = 'placement' | 'playing' | 'finished';

export type MatchOutcomeReason =
  | 'king_eliminated'
  | 'clock_timeout'
  | 'resignation'
  | 'disconnect_forfeit'
  | 'mutual_draw'
  | 'stalemate'
  | 'fivefold_repetition';

export interface Coord {
  readonly row: number;
  readonly col: number;
}

export type RevealKind = 'none' | 'temporary' | 'proximity' | 'permanent';

/**
 * Authoritative piece state stored exclusively on the server (or isolated local-mode vault).
 */
export interface ServerPieceRecord {
  readonly id: string;
  readonly owner: PlayerColor;
  /** Current character identity (preserved after promotion even if resurrected, §8.7 & §21.9). */
  readonly character: CharacterType;
  readonly promotedFrom: CharacterType | null;
  readonly position: Coord | null;
  readonly alive: boolean;
  /** Direction along board rows for Colossus: -1 moves toward row 0, +1 moves toward row 8. */
  readonly progressionDirection: -1 | 1;
  readonly reversalCount: number;
  readonly kamikazeHitsTaken: number;
  readonly hasKamikaze: boolean;
  /** Number of turn-ends remaining for Invincibility (lasts 1 full turn, §8.2, §21.14). */
  readonly invincibleTicksRemaining: number;
  /** Permanent shield until first hit (§8.11, §21.15). */
  readonly hasProtection: boolean;
  /** Remaining turns of Counter-Espionage on this piece. */
  readonly counterEspionageTicksRemaining: number;
  /** Remaining turns of Espionage revelation on this piece (bypasses Counter-Espionage, §8.9, §21.17, Q12). */
  readonly espionageRevealedTicksTo: Readonly<Record<PlayerColor, number>>;
  /** Remaining turns of standard temporary revelation on this piece (card, Colossus edge/attack/jump). */
  readonly tempRevealedTicksTo: Readonly<Record<PlayerColor, number>>;
  /** Permanent revelation per viewer color (Assassin kill or Révélation permanente). */
  readonly permanentlyRevealedTo: Readonly<Record<PlayerColor, boolean>>;
  /** Immobilization ticks remaining from triggering a Trap (§8.14, Q18). */
  readonly immobilizedTicksRemaining: number;
  /** ID of enemy piece currently marked by this Traqueur (null if none or not a Traqueur). */
  readonly traqueurMarkedTargetId?: string | null;
  /** True starting on the Traqueur owner's next turn after marking (+1 Poursuite bonus ready). */
  readonly traqueurPursuitReady?: boolean;
  /** Remaining own turns before this Arbalétrier can shoot again (0 = shot ready, 1..3 = recharging; 1 shot every 3 own turns). */
  readonly arbaletrierCooldownTurnsRemaining?: number;
}

/**
 * Invisible trap placed on a board square (§8.14, §21.19, Q18).
 * Affects both camps once placed; only `owner` sees its exact coordinate.
 */
export interface ServerTrapRecord {
  readonly id: string;
  readonly owner: PlayerColor;
  readonly coord: Coord;
  readonly active: boolean;
}

/**
 * Authoritative graveyard record stored on the server (§4.4, §21.2).
 */
export interface ServerGraveyardRecord {
  readonly pieceId: string;
  readonly owner: PlayerColor;
  /** Character identity at the time of elimination (includes promotion per §8.7 & §21.9). */
  readonly characterAtDeath: CharacterType;
  /** Whether this piece was voluntarily sacrificed via Sacrifice card (§8.16). */
  readonly wasSacrificed: boolean;
  /** Whether the opponent knew this piece's identity at the exact moment of elimination (§4.4, §21.2). */
  readonly knownToOpponentAtDeath: boolean;
  readonly knownReason: 'permanent_revelation' | 'temporary_or_proximity' | 'assassin' | null;
}

/**
 * Client-safe projection of a board piece for a specific viewer.
 * When an enemy piece is not revealed to the viewer, `character` is strictly `null`.
 */
export interface ClientPieceView {
  readonly id: string;
  readonly owner: PlayerColor;
  readonly position: Coord;
  readonly character: CharacterType | null;
  readonly revealKind: RevealKind;
  /** Invincibility is explicitly visible to both players (§7, §8.2, §21.14). */
  readonly isInvincible: boolean;
  readonly isImmobilized: boolean;
  /** True when the opponent is currently viewing this piece via Espionage (Q12: opponent is informed which pieces are seen by Espionage). */
  readonly isExposedByEnemyEspionage: boolean;
  /** Secret buffs (`Protection`, `Kamikaze`, `Contre-espionnage`) are visible ONLY to their owner (§9, §21.10). */
  readonly isProtectedVisible: boolean;
  readonly hasKamikazeVisible: boolean;
  readonly hasCounterEspionageVisible: boolean;
  readonly kamikazeHitsTakenVisible: number | null;
  readonly progressionDirectionVisible: -1 | 1 | null;
  /** True ONLY when this enemy piece is currently marked by the viewer's own Traqueur. */
  readonly traqueurMarkedByViewer?: boolean;
  /** Owner-only: whether viewer's Traqueur currently has an active mark / ready Pursuit bonus. */
  readonly traqueurHasActiveMarkVisible?: boolean;
  readonly traqueurPursuitReadyVisible?: boolean;
  /** Owner-only: remaining own turns before Arbalétrier can shoot again (null for hidden/enemy pieces). */
  readonly arbaletrierCooldownTurnsVisible?: number | null;
}

/**
 * Client-safe graveyard entry obeying §4.4 and §21.2:
 * - Case 1: Unknown at elimination -> strictly anonymous ("Pièce éliminée", character: null).
 * - Case 2: Known at elimination (permanent, temporary, Guetteur, card) -> character revealed.
 * - Case 3: Eliminated by Assassin (without Assassin dying to Kamikaze, §21.13) -> character revealed.
 */
export type GraveyardEntryView =
  | {
      readonly pieceId: string;
      readonly owner: PlayerColor;
      readonly known: false;
      readonly character: null;
      readonly label: 'Pièce éliminée';
    }
  | {
      readonly pieceId: string;
      readonly owner: PlayerColor;
      readonly known: true;
      readonly character: CharacterType;
      readonly label: string;
      readonly reason: 'owner' | 'permanent_revelation' | 'temporary_or_proximity' | 'assassin';
    };

export interface PlacementEntry {
  readonly character: CharacterType;
  readonly coord: Coord;
}

export interface PlacementValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export interface DualClockState {
  readonly remainingMs: Readonly<Record<PlayerColor, number>>;
  readonly activePlayer: PlayerColor | null;
  readonly lastTickTimestampMs: number | null;
}

export interface CustomRulesetConfig {
  readonly prepDurationSeconds: number;
  readonly clockDurationSeconds: number;
  readonly maxHandSize: number;
  readonly enabledCards: readonly CardType[];
  readonly blockCooldownTurns: number;
  readonly counterEspionageDurationTurns: number;
}

/**
 * Type d'événement structuré du moteur de jeu (§5 Architecture et Sécurité).
 */
export type GameEventType =
  | 'PIECE_MOVED'
  | 'PIECE_CAPTURED'
  | 'CARD_PLAYED'
  | 'EFFECT_ACTIVATED'
  | 'PIECE_REVEALED'
  | 'TURN_CHANGED'
  | 'GAME_ENDED';

export type LastMoveKind =
  | 'normal_move'
  | 'capture_move'
  | 'cavalier_leap'
  | 'cavalier_jump'
  | 'berserker_rage'
  | 'piercing_strike'
  | 'crossbow_shot'
  | 'teleportation'
  | 'retreat_move'
  | 'retreat_capture'
  | 'resurrection'
  | 'recrutement'
  | 'promotion'
  | 'attack_blocked';

export interface LastMoveStep {
  readonly from: Coord;
  readonly to: Coord;
  readonly capturedCoord?: Coord | null;
}

/**
 * Informations officielles du dernier coup joué sur le plateau (§1 Affichage du dernier coup).
 * Calculé et validé par le serveur, synchronisé entre les joueurs, et persistant jusqu'au prochain coup.
 * Ne contient jamais l'identité cachée d'une pièce non révélée.
 */
export interface LastMoveInfo {
  readonly seq: number;
  readonly turnNumber: number;
  readonly actor: PlayerColor;
  readonly kind: LastMoveKind;
  readonly from: Coord;
  readonly to: Coord;
  readonly eliminatedCoords: readonly Coord[];
  readonly steps: readonly LastMoveStep[];
  readonly passedThroughCoord?: Coord | null;
  readonly triggeredTrapCoord?: Coord | null;
  readonly promotedAtCoord?: Coord | null;
  readonly blockedAtCoord?: Coord | null;
  readonly timestampMs: number;
}

/**
 * Statistiques détaillées des mécaniques ajoutées (Traqueur, Exécuteur, Arbalétrier, Colosse/Kamikaze).
 * Initialisées à 0 pour les anciens profils/parties afin de ne jamais inventer de stats passées.
 */
export interface NewMechanicsStats {
  readonly traqueurMoves: number;
  readonly traqueurMarks: number;
  readonly traqueurPursuitsSucceeded: number;
  readonly traqueurEliminations: number;
  readonly executeurPiercingStrikes: number;
  readonly executeurEliminations: number;
  readonly arbaletrierShotsTotal: number;
  readonly arbaletrierShotsSucceeded: number;
  readonly arbaletrierShotsBlocked: number;
  readonly colossiEliminatedByKamikaze: number;
}

export function createZeroNewMechanicsStats(): NewMechanicsStats {
  return {
    traqueurMoves: 0,
    traqueurMarks: 0,
    traqueurPursuitsSucceeded: 0,
    traqueurEliminations: 0,
    executeurPiercingStrikes: 0,
    executeurEliminations: 0,
    arbaletrierShotsTotal: 0,
    arbaletrierShotsSucceeded: 0,
    arbaletrierShotsBlocked: 0,
    colossiEliminatedByKamikaze: 0,
  };
}

export type CardNotificationCategory = 'offensive' | 'defensive' | 'recon' | 'tactical';

/**
 * Notification structurée d'une carte jouée (§2 Système de notification des cartes adverses).
 * Filtrée côté serveur selon les droits de visibilité de chaque joueur.
 */
export interface CardNotificationView {
  readonly id: string;
  readonly seq: number;
  readonly turnNumber: number;
  readonly timestampMs: number;
  readonly actor: PlayerColor;
  readonly card: CardType;
  readonly cardName: string;
  readonly badge: string;
  readonly category: CardNotificationCategory;
  readonly shortDescription: string;
  readonly consequenceText: string;
  readonly visibleTargetNotation: string | null;
}

export type CardDrawSource = 'eliminations' | 'sacrifice';

/**
 * Notification privée envoyée uniquement au joueur qui vient de piocher une carte.
 */
export interface CardDrawNotificationView {
  readonly id: string;
  readonly seq: number;
  readonly turnNumber: number;
  readonly timestampMs: number;
  readonly card: CardType;
  readonly cardName: string;
  readonly badge: string;
  readonly category: CardNotificationCategory;
  readonly shortDescription: string;
  readonly source: CardDrawSource;
  readonly handCountAfter: number;
  readonly maxHandSize: number;
}

/**
 * Statut public de validation du placement des deux camps (sans révéler les positions).
 */
export interface PlacementStatusView {
  readonly redConfirmed: boolean;
  readonly blackConfirmed: boolean;
  readonly ownConfirmed: boolean;
  readonly opponentConfirmed: boolean;
}

export type AnnotationColor = 'red' | 'green' | 'blue' | 'yellow';
export type AnnotationTool = 'arrow' | 'square' | 'erase';

export interface BoardSquareMark {
  readonly coord: Coord;
  readonly color: AnnotationColor;
}

export interface BoardArrowAnnotation {
  readonly id: string;
  readonly from: Coord;
  readonly to: Coord;
  readonly color: AnnotationColor;
}

export interface PersonalBoardAnnotations {
  readonly arrows: readonly BoardArrowAnnotation[];
  readonly marks: readonly BoardSquareMark[];
}
