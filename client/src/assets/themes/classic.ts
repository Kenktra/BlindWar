import type { PieceAssetStyleVariant } from '../pieces/silhouettes.js';

export interface PieceAssetPackStyleMeta {
  readonly styleVariant: PieceAssetStyleVariant;
  readonly packName: string;
  readonly frameDecoration: 'ornate_double' | 'clean_modern' | 'monochrome_crisp' | 'tactical_bevel';
  readonly outerStrokeWidth: number;
  readonly innerRingRadius: number;
  readonly innerRingOpacity: number;
}

export const CLASSIC_ASSET_PACK_STYLE: PieceAssetPackStyleMeta = {
  styleVariant: 'classic',
  packName: 'Style Héraldique Classique',
  frameDecoration: 'ornate_double',
  outerStrokeWidth: 3,
  innerRingRadius: 25,
  innerRingOpacity: 0.58,
};
