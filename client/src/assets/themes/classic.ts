import type { PieceAssetStyleVariant } from '../pieces/silhouettes.js';

export interface PieceAssetPackStyleMeta {
  readonly styleVariant: PieceAssetStyleVariant;
  readonly packName: string;
  readonly outlineWidth: number;
  readonly transparentBackground: true;
}

export const CLASSIC_ASSET_PACK_STYLE: PieceAssetPackStyleMeta = {
  styleVariant: 'classic',
  packName: 'Style Héraldique Sculpté (Fond transparent)',
  outlineWidth: 2.35,
  transparentBackground: true,
};
