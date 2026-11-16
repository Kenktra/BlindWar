import type { CharacterType, Coord } from '../types/core.js';
import { getBoardSquareSlot } from './themes.js';

/**
 * Pure checkerboard & square-inverted piece visual color polarity helpers.
 * Independent of piece camp ownership (`piece.owner`) and hidden identity rules.
 */

export type BoardVisualColor = 'red' | 'black';
export type PieceVisualVariant = 'red' | 'black';
export type PieceAssetKind = CharacterType | 'secret';

export const PIECE_ASSET_KINDS: readonly PieceAssetKind[] = [
  'guetteur_h',
  'guetteur_d',
  'assassin',
  'roi',
  'cavalier',
  'colosse',
  'reine',
  'berserker',
  'traqueur',
  'executeur',
  'arbaletrier',
  'soldat',
  'secret',
] as const;

const PIECE_ASSET_KIND_SET: ReadonlySet<string> = new Set<string>(PIECE_ASSET_KINDS);

export function isPieceAssetKind(value: string | null | undefined): value is PieceAssetKind {
  return typeof value === 'string' && PIECE_ASSET_KIND_SET.has(value);
}

export function normalizePieceAssetKind(kind: string | null | undefined): PieceAssetKind {
  return isPieceAssetKind(kind) ? kind : 'secret';
}

/** `(row + col)` even -> square slot `'red'` (A); odd -> `'black'` (B). */
export function getBoardSquareColor(coord: Coord): BoardVisualColor {
  return getBoardSquareSlot(coord) === 'a' ? 'red' : 'black';
}

export function getInvertedPieceVariantForSquareColor(
  squareColor: BoardVisualColor
): PieceVisualVariant {
  return squareColor === 'red' ? 'black' : 'red';
}

export function getPieceVisualVariantAtCoord(coord: Coord): PieceVisualVariant {
  return getInvertedPieceVariantForSquareColor(getBoardSquareColor(coord));
}
