import type { CardType, CharacterType, CustomRulesetConfig } from '../types/core.js';
import { DEFAULT_PREP_DURATION_SECONDS, OFFICIAL_PLAYER_CLOCK_SECONDS } from './board.js';

export const MAX_HAND_SIZE = 3;
export const ELIMINATIONS_PER_CARD_DRAW = 3;
export const COLOSSUS_KAMIKAZE_ELIMINATION_THRESHOLD = 2;
export const RECRUITMENT_MAX_USES_PER_GAME = 1;
export const ESPIONNAGE_TARGET_COUNT = 2;

/** Official validated durations and cooldowns (§8, §21, Q3, Q12, Q13, Q15, Q17, Q18). */
export const INVINCIBILITY_DURATION_TURNS = 1;
export const BROUILLARD_DURATION_TURNS = 3;
export const ESPIONNAGE_DURATION_TURNS = 3;
export const CONTRE_ESPIONNAGE_DURATION_TURNS = 3;
export const REVELATION_TEMPORAIRE_DURATION_TURNS = 1;
export const COLOSSUS_REVEAL_DURATION_TURNS = 1;
export const TRAP_IMMOBILIZATION_DURATION_TURNS = 1;
export const BLOCK_COOLDOWN_TURNS = 2;

export type CardTargetKind =
  | 'own_piece'
  | 'enemy_piece'
  | 'two_enemy_pieces'
  | 'own_graveyard_piece'
  | 'empty_square'
  | 'own_soldier'
  | 'none';

export interface CardStaticMetadata {
  readonly id: CardType;
  readonly name: string;
  readonly description: string;
  readonly targetKind: CardTargetKind;
  readonly forbiddenOnCharacters: readonly CharacterType[];
  /**
   * Whether the target piece/square remains secret from the opponent (§9, §21.10, §21.19).
   */
  readonly isTargetSecretToOpponent: boolean;
}

/**
 * Complete catalog of all 16 official cards (§8.1–§8.16, §9, §21, validated Q12–Q22).
 */
export const CARD_CATALOG: Readonly<Record<CardType, CardStaticMetadata>> = {
  kamikaze: {
    id: 'kamikaze',
    name: 'Kamikaze',
    description:
      'Si cette pièce est éliminée, elle élimine aussi son attaquant (interdit sur Roi et Colosse ; 2 déclenchements provoqués par le Colosse requis pour l’éliminer). L’adversaire est averti de la carte utilisée mais ignore sur quel pion.',
    targetKind: 'own_piece',
    forbiddenOnCharacters: ['roi', 'colosse'],
    isTargetSecretToOpponent: true,
  },
  invincibilite: {
    id: 'invincibilite',
    name: 'Invincibilité',
    description:
      'Rend une pièce alliée impossible à éliminer pendant 1 tour complet (interdit sur Roi et Colosse). L’adversaire est averti de la carte utilisée mais ignore sur quel pion.',
    targetKind: 'own_piece',
    forbiddenOnCharacters: ['roi', 'colosse'],
    isTargetSecretToOpponent: true,
  },
  block: {
    id: 'block',
    name: 'Block',
    description:
      'Empêche l’adversaire de jouer pendant un tour complet (temps de recharge : 2 tours).',
    targetKind: 'none',
    forbiddenOnCharacters: [],
    isTargetSecretToOpponent: false,
  },
  retreat: {
    id: 'retreat',
    name: 'Retreat',
    description:
      'Permet à une pièce alliée de reculer d’une case (autorise également une élimination en reculant).',
    targetKind: 'own_piece',
    forbiddenOnCharacters: [],
    isTargetSecretToOpponent: false,
  },
  revelation_temporaire: {
    id: 'revelation_temporaire',
    name: 'Révélation temporaire',
    description:
      'Révèle l’identité d’une pièce ennemie choisie pendant 1 tour complet (l’adversaire est averti de la carte utilisée mais ignore sur quel pion).',
    targetKind: 'enemy_piece',
    forbiddenOnCharacters: [],
    isTargetSecretToOpponent: true,
  },
  revelation_permanente: {
    id: 'revelation_permanente',
    name: 'Révélation permanente',
    description:
      'Révèle définitivement l’identité d’une pièce ennemie jusqu’à la fin de la partie (l’adversaire est averti de la carte utilisée mais ignore sur quel pion).',
    targetKind: 'enemy_piece',
    forbiddenOnCharacters: [],
    isTargetSecretToOpponent: true,
  },
  resurrection: {
    id: 'resurrection',
    name: 'Résurrection',
    description:
      'Ramène une pièce alliée éliminée (hors Roi, Reine, Colosse) sur une case libre de votre première rangée.',
    targetKind: 'own_graveyard_piece',
    forbiddenOnCharacters: ['roi', 'reine', 'colosse'],
    isTargetSecretToOpponent: false,
  },
  brouillard: {
    id: 'brouillard',
    name: 'Brouillard',
    description:
      'Bloque pendant 3 tours toutes les révélations temporaires et les reconnaissances des Guetteurs adverses.',
    targetKind: 'none',
    forbiddenOnCharacters: [],
    isTargetSecretToOpponent: false,
  },
  espionnage: {
    id: 'espionnage',
    name: 'Espionnage',
    description:
      'Révèle pendant 3 tours 2 pièces ennemies au choix (traverse Contre-espionnage ; l’adversaire est averti de la carte utilisée mais ignore sur quels pions).',
    targetKind: 'two_enemy_pieces',
    forbiddenOnCharacters: [],
    isTargetSecretToOpponent: true,
  },
  teleportation: {
    id: 'teleportation',
    name: 'Téléportation',
    description:
      'Déplace une pièce alliée jusqu’à 2 cases sur une case libre sans traverser d’obstacle, en respectant ses directions autorisées.',
    targetKind: 'own_piece',
    forbiddenOnCharacters: [],
    isTargetSecretToOpponent: false,
  },
  protection: {
    id: 'protection',
    name: 'Protection',
    description:
      'Protège secrètement une pièce alliée jusqu’à la première attaque ou explosion Kamikaze subie, puis se brise (interdit sur Roi et Colosse). L’adversaire est averti de la carte utilisée mais ignore sur quel pion.',
    targetKind: 'own_piece',
    forbiddenOnCharacters: ['roi', 'colosse'],
    isTargetSecretToOpponent: true,
  },
  recrutement: {
    id: 'recrutement',
    name: 'Recrutement',
    description:
      'Récupère un Soldat éliminé sur une case libre de votre première rangée (1 seule utilisation par partie).',
    targetKind: 'empty_square',
    forbiddenOnCharacters: [],
    isTargetSecretToOpponent: false,
  },
  double_action: {
    id: 'double_action',
    name: 'Double action',
    description:
      'Donne immédiatement 2 actions de déplacement/combat successives pendant ce même tour (interdit de jouer une 2e carte).',
    targetKind: 'none',
    forbiddenOnCharacters: [],
    isTargetSecretToOpponent: false,
  },
  piege: {
    id: 'piege',
    name: 'Piège',
    description:
      'Pose un piège invisible sur une case libre (actif pour les 2 camps, immobilise 1 tour ; l’adversaire est averti sans voir la case).',
    targetKind: 'empty_square',
    forbiddenOnCharacters: [],
    isTargetSecretToOpponent: true,
  },
  contre_espionnage: {
    id: 'contre_espionnage',
    name: 'Contre-espionnage',
    description:
      'Protège secrètement une pièce alliée contre les révélations temporaires et les Guetteurs (l’adversaire est averti de la carte utilisée mais ignore sur quel pion).',
    targetKind: 'own_piece',
    forbiddenOnCharacters: [],
    isTargetSecretToOpponent: true,
  },
  sacrifice: {
    id: 'sacrifice',
    name: 'Sacrifice',
    description:
      'Sacrifie volontairement un Soldat allié pour piocher 1 carte (ne donne aucune élimination à l’adversaire).',
    targetKind: 'own_soldier',
    forbiddenOnCharacters: [],
    isTargetSecretToOpponent: false,
  },
} as const;

export const CARD_TYPES = Object.keys(CARD_CATALOG) as readonly CardType[];

export const OFFICIAL_RULESET_CONFIG: CustomRulesetConfig = {
  prepDurationSeconds: DEFAULT_PREP_DURATION_SECONDS,
  clockDurationSeconds: OFFICIAL_PLAYER_CLOCK_SECONDS,
  maxHandSize: MAX_HAND_SIZE,
  enabledCards: CARD_TYPES,
  blockCooldownTurns: BLOCK_COOLDOWN_TURNS,
  counterEspionageDurationTurns: CONTRE_ESPIONNAGE_DURATION_TURNS,
};

/** Check whether a card is explicitly permitted on a given character type. */
export function isCardAllowedOnCharacter(card: CardType, character: CharacterType): boolean {
  return !CARD_CATALOG[card].forbiddenOnCharacters.includes(character);
}

/**
 * Draw a random card from the infinite random pool of enabled cards (Q16).
 */
export function drawRandomCardFromPool(
  enabledCards: readonly CardType[] = CARD_TYPES,
  randomFn: () => number = Math.random,
): CardType | null {
  if (enabledCards.length === 0) {
    return null;
  }
  const index = Math.floor(randomFn() * enabledCards.length);
  return enabledCards[Math.min(index, enabledCards.length - 1)];
}

/**
 * Advance a player's card draw elimination counter (§8, §21.18, §21.22, §21.23, §24).
 * - If the player already holds `maxHandSize` cards, the counter does NOT progress.
 * - Voluntary Sacrifice does NOT call this function for the opponent (§8.16, §21.22).
 */
export function advanceDrawCounterOnElimination(
  currentHandSize: number,
  currentKillCounter: number,
  maxHandSize: number = MAX_HAND_SIZE,
): { readonly nextKillCounter: number; readonly shouldDrawCard: boolean } {
  if (currentHandSize >= maxHandSize) {
    return {
      nextKillCounter: currentKillCounter,
      shouldDrawCard: false,
    };
  }

  const incremented = currentKillCounter + 1;
  if (incremented >= ELIMINATIONS_PER_CARD_DRAW) {
    return {
      nextKillCounter: 0,
      shouldDrawCard: true,
    };
  }

  return {
    nextKillCounter: incremented,
    shouldDrawCard: false,
  };
}
