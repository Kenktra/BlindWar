import type {
  CharacterType,
  Coord,
  PlacementEntry,
  PlacementValidationResult,
  PlayerColor,
} from '../types/core.js';
import {
  ARMY_COMPOSITION,
  CHARACTER_TYPES,
  countCharacters,
} from '../constants/army.js';
import {
  BOARD_COLS,
  PLACEMENT_ROWS_BY_COLOR,
  TOTAL_PIECES_PER_PLAYER,
  coordKey,
  isInPlacementZone,
} from '../constants/board.js';

/**
 * Validate a partial (in-progress) placement list for a given player.
 * Ensures no out-of-zone coordinates, no overlapping squares, and no character quota overflow.
 */
export function validatePartialPlacement(
  color: PlayerColor,
  entries: readonly PlacementEntry[],
): PlacementValidationResult {
  const errors: string[] = [];
  const seenCoords = new Set<string>();
  const counts = countCharacters([]);

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (!(entry.character in ARMY_COMPOSITION)) {
      errors.push(`Entrée #${i}: personnage inconnu "${String(entry.character)}".`);
      continue;
    }

    if (!isInPlacementZone(color, entry.coord)) {
      errors.push(
        `Entrée #${i} (${entry.character}): case (${entry.coord.row}, ${entry.coord.col}) hors zone de placement pour ${color}.`,
      );
    }

    const key = coordKey(entry.coord);
    if (seenCoords.has(key)) {
      errors.push(`Entrée #${i}: case (${entry.coord.row}, ${entry.coord.col}) déjà occupée.`);
    } else {
      seenCoords.add(key);
    }

    counts[entry.character] += 1;
    if (counts[entry.character] > ARMY_COMPOSITION[entry.character]) {
      errors.push(
        `Quota dépassé pour ${entry.character}: maximum ${ARMY_COMPOSITION[entry.character]}, reçu ${counts[entry.character]}.`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a complete 27-piece placement for a player (§3.2, §5, §20).
 */
export function validateCompletePlacement(
  color: PlayerColor,
  entries: readonly PlacementEntry[],
): PlacementValidationResult {
  const partial = validatePartialPlacement(color, entries);
  const errors = [...partial.errors];

  if (entries.length !== TOTAL_PIECES_PER_PLAYER) {
    errors.push(
      `Nombre total de pièces invalide: attendu ${TOTAL_PIECES_PER_PLAYER}, reçu ${entries.length}.`,
    );
  }

  const counts = countCharacters(entries.map((e) => e.character));
  for (const ch of CHARACTER_TYPES) {
    if (counts[ch] !== ARMY_COMPOSITION[ch]) {
      errors.push(
        `Quantité invalide pour ${ch}: attendu ${ARMY_COMPOSITION[ch]}, reçu ${counts[ch]}.`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/** Enumerate all 27 coordinates in a player's placement zone. */
export function getPlacementZoneCoords(color: PlayerColor): Coord[] {
  const coords: Coord[] = [];
  for (const row of PLACEMENT_ROWS_BY_COLOR[color]) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      coords.push({ row, col });
    }
  }
  return coords;
}

/**
 * Automatically complete remaining unplaced pieces into free squares of the player's
 * placement zone when the preparation timer expires (§3.2).
 */
export function autoCompletePlacement(
  color: PlayerColor,
  partialEntries: readonly PlacementEntry[],
  randomFn: () => number = Math.random,
): PlacementEntry[] {
  const check = validatePartialPlacement(color, partialEntries);
  if (!check.valid) {
    throw new Error(`Placement partiel invalide: ${check.errors.join(' | ')}`);
  }

  const occupied = new Set(partialEntries.map((e) => coordKey(e.coord)));
  const freeCoords = getPlacementZoneCoords(color).filter((c) => !occupied.has(coordKey(c)));

  const placedCounts = countCharacters(partialEntries.map((e) => e.character));
  const remainingCharacters: CharacterType[] = [];

  for (const ch of CHARACTER_TYPES) {
    const missing = ARMY_COMPOSITION[ch] - placedCounts[ch];
    for (let i = 0; i < missing; i += 1) {
      remainingCharacters.push(ch);
    }
  }

  if (remainingCharacters.length !== freeCoords.length) {
    throw new Error(
      `Incohérence interne placement auto: ${remainingCharacters.length} pièces restantes pour ${freeCoords.length} cases libres.`,
    );
  }

  // Fisher-Yates shuffle on remaining characters so auto-placement is unpredictable
  for (let i = remainingCharacters.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFn() * (i + 1));
    const tmp = remainingCharacters[i];
    remainingCharacters[i] = remainingCharacters[j];
    remainingCharacters[j] = tmp;
  }

  const completed: PlacementEntry[] = [...partialEntries];
  for (let i = 0; i < freeCoords.length; i += 1) {
    completed.push({
      character: remainingCharacters[i],
      coord: freeCoords[i],
    });
  }

  return completed;
}
