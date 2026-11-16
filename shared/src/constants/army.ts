import type { CharacterType } from '../types/core.js';
import { TOTAL_PIECES_PER_PLAYER } from './board.js';

export interface CharacterConfig {
  readonly id: CharacterType;
  readonly name: string;
  readonly roleSummary: string;
  readonly initialCount: number;
  /**
   * Absolute cap on board at any time:
   * - 1 for Roi, Reine, Colosse, Traqueur, Exécuteur, Arbalétrier
   * - null (may exceed initial count via promotion/resurrection) for others
   */
  readonly absoluteMaxCount: number | null;
  readonly maxRange: number;
  readonly rangedShotRange?: number;
  readonly canKillColossus: boolean;
}

/**
 * Official centralized starting army composition (§2, §5, §24).
 * Total must strictly equal 27 pieces per player at start of match.
 */
export const ARMY_TOTAL_PIECES = TOTAL_PIECES_PER_PLAYER;

export const ARMY_COMPOSITION: Readonly<Record<CharacterType, number>> = {
  guetteur_h: 3,
  guetteur_d: 3,
  assassin: 3,
  roi: 1,
  cavalier: 2,
  colosse: 1,
  reine: 1,
  berserker: 1,
  traqueur: 1,
  executeur: 1,
  arbaletrier: 1,
  soldat: 9,
} as const;

/**
 * Absolute maximum concurrent pieces per character:
 * Roi (1), Reine (1), Colosse (1), Traqueur (1), Exécuteur (1), Arbalétrier (1)
 * never exceed 1 active instance on the board (including via Résurrection or Promotion).
 */
export const ABSOLUTE_MAX_BY_CHARACTER: Readonly<Record<CharacterType, number | null>> = {
  guetteur_h: null,
  guetteur_d: null,
  assassin: null,
  roi: 1,
  cavalier: null,
  colosse: 1,
  reine: 1,
  berserker: null,
  traqueur: 1,
  executeur: 1,
  arbaletrier: 1,
  soldat: null,
} as const;

export const CHARACTER_CATALOG: Readonly<Record<CharacterType, CharacterConfig>> = {
  guetteur_h: {
    id: 'guetteur_h',
    name: 'Guetteur H',
    roleSummary: 'Reconnaissance orthogonale',
    initialCount: ARMY_COMPOSITION.guetteur_h,
    absoluteMaxCount: ABSOLUTE_MAX_BY_CHARACTER.guetteur_h,
    maxRange: 1,
    canKillColossus: false,
  },
  guetteur_d: {
    id: 'guetteur_d',
    name: 'Guetteur D',
    roleSummary: 'Reconnaissance diagonale',
    initialCount: ARMY_COMPOSITION.guetteur_d,
    absoluteMaxCount: ABSOLUTE_MAX_BY_CHARACTER.guetteur_d,
    maxRange: 1,
    canKillColossus: false,
  },
  assassin: {
    id: 'assassin',
    name: 'Assassin',
    roleSummary: 'Infiltration & révélation définitive',
    initialCount: ARMY_COMPOSITION.assassin,
    absoluteMaxCount: ABSOLUTE_MAX_BY_CHARACTER.assassin,
    maxRange: 1,
    canKillColossus: false,
  },
  roi: {
    id: 'roi',
    name: 'Roi',
    roleSummary: 'Chef suprême & objectif de victoire',
    initialCount: ARMY_COMPOSITION.roi,
    absoluteMaxCount: ABSOLUTE_MAX_BY_CHARACTER.roi,
    maxRange: 1,
    canKillColossus: true,
  },
  cavalier: {
    id: 'cavalier',
    name: 'Cavalier',
    roleSummary: 'Bond en « L » & Percée en chaîne',
    initialCount: ARMY_COMPOSITION.cavalier,
    absoluteMaxCount: ABSOLUTE_MAX_BY_CHARACTER.cavalier,
    maxRange: 2,
    canKillColossus: false,
  },
  colosse: {
    id: 'colosse',
    name: 'Colosse',
    roleSummary: 'Forteresse blindée & progression irrésistible',
    initialCount: ARMY_COMPOSITION.colosse,
    absoluteMaxCount: ABSOLUTE_MAX_BY_CHARACTER.colosse,
    maxRange: 1,
    canKillColossus: true,
  },
  reine: {
    id: 'reine',
    name: 'Reine',
    roleSummary: 'Mobilité polyvalente & chasseuse de Colosse',
    initialCount: ARMY_COMPOSITION.reine,
    absoluteMaxCount: ABSOLUTE_MAX_BY_CHARACTER.reine,
    maxRange: 2,
    canKillColossus: true,
  },
  berserker: {
    id: 'berserker',
    name: 'Berserker',
    roleSummary: 'Assaut lourd & repositionnement Rage',
    initialCount: ARMY_COMPOSITION.berserker,
    absoluteMaxCount: ABSOLUTE_MAX_BY_CHARACTER.berserker,
    maxRange: 2,
    canKillColossus: false,
  },
  traqueur: {
    id: 'traqueur',
    name: 'Traqueur',
    roleSummary: 'Portée 2 H/V (3 avec Marquage)',
    initialCount: ARMY_COMPOSITION.traqueur,
    absoluteMaxCount: ABSOLUTE_MAX_BY_CHARACTER.traqueur,
    maxRange: 2,
    canKillColossus: false,
  },
  executeur: {
    id: 'executeur',
    name: 'Exécuteur',
    roleSummary: 'Attaque lourde & Frappe traversante',
    initialCount: ARMY_COMPOSITION.executeur,
    absoluteMaxCount: ABSOLUTE_MAX_BY_CHARACTER.executeur,
    maxRange: 2,
    canKillColossus: false,
  },
  arbaletrier: {
    id: 'arbaletrier',
    name: 'Arbalétrier',
    roleSummary: 'Tir à distance 1–3 cases (1 tir / 3 tours)',
    initialCount: ARMY_COMPOSITION.arbaletrier,
    absoluteMaxCount: ABSOLUTE_MAX_BY_CHARACTER.arbaletrier,
    maxRange: 1,
    rangedShotRange: 3,
    canKillColossus: false,
  },
  soldat: {
    id: 'soldat',
    name: 'Soldat',
    roleSummary: 'Infanterie de ligne & promotion',
    initialCount: ARMY_COMPOSITION.soldat,
    absoluteMaxCount: ABSOLUTE_MAX_BY_CHARACTER.soldat,
    maxRange: 1,
    canKillColossus: false,
  },
} as const;

export const CHARACTER_TYPES = Object.keys(ARMY_COMPOSITION) as readonly CharacterType[];

const COMPUTED_ARMY_TOTAL = CHARACTER_TYPES.reduce((sum, key) => sum + ARMY_COMPOSITION[key], 0);
if (COMPUTED_ARMY_TOTAL !== TOTAL_PIECES_PER_PLAYER) {
  throw new Error(
    `Invalid army composition total: expected ${TOTAL_PIECES_PER_PLAYER}, got ${COMPUTED_ARMY_TOTAL}`,
  );
}

/** Return a flat list of the 27 character tokens belonging to one player. */
export function createInitialArmyRoster(): CharacterType[] {
  const roster: CharacterType[] = [];
  for (const character of CHARACTER_TYPES) {
    const qty = ARMY_COMPOSITION[character];
    for (let i = 0; i < qty; i += 1) {
      roster.push(character);
    }
  }
  return roster;
}

/** Count how many pieces of each character type are present in a list. */
export function countCharacters(characters: readonly CharacterType[]): Record<CharacterType, number> {
  const counts: Record<CharacterType, number> = {
    guetteur_h: 0,
    guetteur_d: 0,
    assassin: 0,
    roi: 0,
    cavalier: 0,
    colosse: 0,
    reine: 0,
    berserker: 0,
    traqueur: 0,
    executeur: 0,
    arbaletrier: 0,
    soldat: 0,
  };
  for (const ch of characters) {
    if (ch in counts) {
      counts[ch] += 1;
    }
  }
  return counts;
}

/**
 * Check whether adding one piece of `character` respects the absolute cap (§5, §21.7, §21.8).
 */
export function canAddCharacterInstance(
  character: CharacterType,
  currentAliveCountOfType: number,
): boolean {
  const max = ABSOLUTE_MAX_BY_CHARACTER[character];
  return max === null || currentAliveCountOfType < max;
}
