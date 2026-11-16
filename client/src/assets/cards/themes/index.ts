import {
  DEFAULT_THEME_ID,
  THEME_LIST,
  getCardPaletteRole,
  getThemeDefinition,
  getThemedCardPalette,
  type BlindWarThemeDefinition,
  type CardArtworkPalette,
  type CardPaletteRole,
  type CardType,
  type ThemeId,
} from '../../../../../shared/src/index.js';
import {
  ALL_CARD_ART_KINDS,
  type CardAssetStyleVariant,
} from '../base/silhouettes.js';
import { BLUE_CARD_ASSET_STYLE } from './blue.js';
import { CHESSCOM_CARD_ASSET_STYLE } from './chesscom.js';
import { CLASSIC_CARD_ASSET_STYLE, type CardAssetPackStyleMeta } from './classic.js';
import { MONOCHROME_CARD_ASSET_STYLE } from './monochrome.js';
import { RED_BLACK_CARD_ASSET_STYLE } from './red-black.js';

export interface CardThemeAssetDescriptor {
  readonly themeId: ThemeId;
  readonly card: CardType;
  readonly role: CardPaletteRole;
  readonly assetId: string;
  readonly styleVariant: CardAssetStyleVariant;
  readonly outlineWidth: number;
  readonly transparentBackground: true;
  readonly palette: CardArtworkPalette;
}

export interface CardThemeAssetPack {
  readonly themeId: ThemeId;
  readonly styleMeta: CardAssetPackStyleMeta;
  readonly cards: Readonly<Record<CardType, CardThemeAssetDescriptor>>;
}

const STYLE_META_BY_THEME_ID: Readonly<Record<ThemeId, CardAssetPackStyleMeta>> = {
  rouge_et_noir: RED_BLACK_CARD_ASSET_STYLE,
  classique: CLASSIC_CARD_ASSET_STYLE,
  vert_et_beige: CHESSCOM_CARD_ASSET_STYLE,
  noir_et_blanc: MONOCHROME_CARD_ASSET_STYLE,
  bleu_et_argent: BLUE_CARD_ASSET_STYLE,
  ambre_et_ebene: CLASSIC_CARD_ASSET_STYLE,
};

function buildCardThemeAssetPack(
  themeId: ThemeId,
  colorMode: 'dark' | 'light' = 'dark',
): CardThemeAssetPack {
  const styleMeta = STYLE_META_BY_THEME_ID[themeId];
  const cards = {} as Record<CardType, CardThemeAssetDescriptor>;

  for (const card of ALL_CARD_ART_KINDS) {
    const role = getCardPaletteRole(card);
    cards[card] = {
      themeId,
      card,
      role,
      assetId: `cards/${themeId}/${styleMeta.styleVariant}/${card}`,
      styleVariant: styleMeta.styleVariant,
      outlineWidth: styleMeta.outlineWidth,
      transparentBackground: true,
      palette: getThemedCardPalette(themeId, card, colorMode),
    };
  }

  return { themeId, styleMeta, cards };
}

export const CARD_THEME_ASSET_PACKS: Readonly<Record<ThemeId, CardThemeAssetPack>> =
  Object.fromEntries(
    THEME_LIST.map((t) => [t.id, buildCardThemeAssetPack(t.id, 'dark')]),
  ) as Readonly<Record<ThemeId, CardThemeAssetPack>>;

/**
 * Automatically resolve the transparent vector card asset & theme-adapted palette
 * for any built-in or future custom `BlindWarThemeDefinition`.
 */
export function resolveCardThemeAsset(
  themeOrId: BlindWarThemeDefinition | ThemeId | string | null | undefined,
  card: CardType,
  colorMode: 'dark' | 'light' = 'dark',
): CardThemeAssetDescriptor {
  if (typeof themeOrId === 'object' && themeOrId !== null && 'ui' in themeOrId) {
    const customTheme = themeOrId;
    const styleMeta = STYLE_META_BY_THEME_ID[customTheme.id] ?? RED_BLACK_CARD_ASSET_STYLE;
    const role = getCardPaletteRole(card);
    return {
      themeId: customTheme.id,
      card,
      role,
      assetId: `cards/${customTheme.id}/${styleMeta.styleVariant}/${card}`,
      styleVariant: styleMeta.styleVariant,
      outlineWidth: styleMeta.outlineWidth,
      transparentBackground: true,
      palette: getThemedCardPalette(customTheme, card, colorMode),
    };
  }

  const safeTheme = getThemeDefinition(themeOrId ?? DEFAULT_THEME_ID);
  const styleMeta = STYLE_META_BY_THEME_ID[safeTheme.id] ?? RED_BLACK_CARD_ASSET_STYLE;
  const role = getCardPaletteRole(card);
  return {
    themeId: safeTheme.id,
    card,
    role,
    assetId: `cards/${safeTheme.id}/${styleMeta.styleVariant}/${card}`,
    styleVariant: styleMeta.styleVariant,
    outlineWidth: styleMeta.outlineWidth,
    transparentBackground: true,
    palette: getThemedCardPalette(safeTheme.id, card, colorMode),
  };
}
