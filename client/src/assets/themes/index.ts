import {
  BLIND_WAR_THEMES,
  THEME_LIST,
  getThemeDefinition,
  type PieceMedallionPalette,
  type ThemeId,
} from '../../../../shared/src/index.js';
import {
  ALL_PIECE_ART_KINDS,
  type PieceArtKind,
  type PieceAssetStyleVariant,
} from '../pieces/silhouettes.js';
import { BLUE_ASSET_PACK_STYLE } from './blue.js';
import { CHESSCOM_ASSET_PACK_STYLE } from './chesscom.js';
import { CLASSIC_ASSET_PACK_STYLE, type PieceAssetPackStyleMeta } from './classic.js';
import { MONOCHROME_ASSET_PACK_STYLE } from './monochrome.js';

export type PieceAssetContrastVariant = 'light' | 'dark' | 'neutral';

export interface PieceThemeAssetDescriptor {
  readonly themeId: ThemeId;
  readonly pieceKind: PieceArtKind;
  readonly assetId: string;
  readonly styleVariant: PieceAssetStyleVariant;
  readonly outlineWidth: number;
  readonly transparentBackground: true;
  readonly palettes: {
    readonly light: PieceMedallionPalette;
    readonly dark: PieceMedallionPalette;
    readonly neutral: PieceMedallionPalette;
  };
}

export interface ThemeAssetPack {
  readonly themeId: ThemeId;
  readonly styleMeta: PieceAssetPackStyleMeta;
  readonly pieces: Readonly<Record<PieceArtKind, PieceThemeAssetDescriptor>>;
}

const STYLE_META_BY_THEME_ID: Readonly<Record<ThemeId, PieceAssetPackStyleMeta>> = {
  rouge_et_noir: CLASSIC_ASSET_PACK_STYLE,
  classique: CLASSIC_ASSET_PACK_STYLE,
  vert_et_beige: CHESSCOM_ASSET_PACK_STYLE,
  noir_et_blanc: MONOCHROME_ASSET_PACK_STYLE,
  bleu_et_argent: BLUE_ASSET_PACK_STYLE,
  ambre_et_ebene: CLASSIC_ASSET_PACK_STYLE,
};

function buildThemeAssetPack(themeId: ThemeId): ThemeAssetPack {
  const theme = BLIND_WAR_THEMES[themeId];
  const styleMeta = STYLE_META_BY_THEME_ID[themeId];
  const pieces = {} as Record<PieceArtKind, PieceThemeAssetDescriptor>;

  for (const pieceKind of ALL_PIECE_ART_KINDS) {
    pieces[pieceKind] = {
      themeId,
      pieceKind,
      assetId: `${themeId}/${styleMeta.styleVariant}/${pieceKind}`,
      styleVariant: styleMeta.styleVariant,
      outlineWidth: styleMeta.outlineWidth,
      transparentBackground: true,
      palettes: {
        light: theme.board.pieceOnB,
        dark: theme.board.pieceOnA,
        neutral: theme.board.pieceNeutral,
      },
    };
  }

  return { themeId, styleMeta, pieces };
}

export const THEME_ASSET_PACKS: Readonly<Record<ThemeId, ThemeAssetPack>> = Object.fromEntries(
  THEME_LIST.map((t) => [t.id, buildThemeAssetPack(t.id)]),
) as Readonly<Record<ThemeId, ThemeAssetPack>>;

/** Resolve the full transparent-background theme asset descriptor for any piece and theme. */
export function resolvePieceThemeAsset(
  themeId: ThemeId | string | null | undefined,
  pieceKind: PieceArtKind,
): PieceThemeAssetDescriptor {
  const safeTheme = getThemeDefinition(themeId);
  const pack = THEME_ASSET_PACKS[safeTheme.id] ?? THEME_ASSET_PACKS.rouge_et_noir;
  return pack.pieces[pieceKind] ?? pack.pieces.secret;
}
