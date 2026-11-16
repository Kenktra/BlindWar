import type { CardAssetStyleVariant } from '../base/silhouettes.js';

export interface CardAssetPackStyleMeta {
  readonly styleVariant: CardAssetStyleVariant;
  readonly packName: string;
  readonly outlineWidth: number;
  readonly transparentBackground: true;
}

export const CLASSIC_CARD_ASSET_STYLE: CardAssetPackStyleMeta = {
  styleVariant: 'classic',
  packName: 'Style Héraldique Classique (Cartes transparentes)',
  outlineWidth: 2.35,
  transparentBackground: true,
};
