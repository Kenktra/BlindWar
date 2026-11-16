import React, { useId } from 'react';
import {
  DEFAULT_THEME_ID,
  getBoardSquareSlot,
  getThemeDefinition,
  getThemedPiecePaletteAtCoord,
  getThemedPiecePaletteForOwner,
  isDarkBoardColor,
  type BlindWarThemeDefinition,
  type CharacterType,
  type Coord,
  type PieceMedallionPalette,
  type PlayerColor,
} from '../../../shared/src/index.js';
import { useOptionalBlindWarTheme } from '../themes/themeManager.js';
import {
  ALL_PIECE_ART_KINDS,
  renderPieceSilhouette,
  type PieceArtKind,
} from '../assets/pieces/silhouettes.js';
import { resolvePieceThemeAsset } from '../assets/themes/index.js';

export type { PieceArtKind };
export type PieceArtOwner = PlayerColor | 'neutral';
export type PieceArtSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export const AVATAR_CHARACTER_OPTIONS: readonly CharacterType[] = [
  'roi',
  'reine',
  'colosse',
  'cavalier',
  'berserker',
  'assassin',
  'traqueur',
  'executeur',
  'arbaletrier',
  'soldat',
];

const PIECE_ART_KIND_SET: ReadonlySet<string> = new Set<string>(ALL_PIECE_ART_KINDS);

const LEGACY_BADGE_MAP: Readonly<Record<string, CharacterType>> = {
  '♔': 'roi',
  '♕': 'reine',
  '♜': 'colosse',
  '♞': 'cavalier',
  '⚔': 'berserker',
  '⚔️': 'berserker',
  '🗡': 'assassin',
  '🗡️': 'assassin',
  '◈': 'guetteur_h',
  '◇': 'guetteur_d',
  '🎯': 'traqueur',
  '🪓': 'executeur',
  '🏹': 'arbaletrier',
  '▲': 'soldat',
  roi: 'roi',
  reine: 'reine',
  colosse: 'colosse',
  cavalier: 'cavalier',
  berserker: 'berserker',
  assassin: 'assassin',
  guetteur_h: 'guetteur_h',
  guetteur_d: 'guetteur_d',
  traqueur: 'traqueur',
  executeur: 'executeur',
  arbaletrier: 'arbaletrier',
  soldat: 'soldat',
};

export function resolveCharacterFromLegacyBadge(badge: string): CharacterType | null {
  const key = badge.trim();
  return LEGACY_BADGE_MAP[key] ?? null;
}

const SIZE_PX: Readonly<Record<PieceArtSize, number>> = {
  xs: 18,
  sm: 24,
  md: 32,
  lg: 44,
  xl: 56,
};

export interface PieceArtworkProps {
  readonly character: PieceArtKind | string;
  readonly owner?: PieceArtOwner;
  readonly size?: PieceArtSize;
  readonly coord?: Coord;
  readonly squareSlot?: 'a' | 'b';
  readonly contrastVariant?: 'light' | 'dark' | 'neutral';
  readonly theme?: BlindWarThemeDefinition;
  readonly palette?: PieceMedallionPalette;
  readonly className?: string;
  readonly title?: string;
}

function normalizePieceArtKind(input: PieceArtKind | string): PieceArtKind {
  return PIECE_ART_KIND_SET.has(input) ? (input as PieceArtKind) : 'secret';
}

function resolveMedallionPalette(
  owner: PieceArtOwner,
  activeBoardTheme: BlindWarThemeDefinition,
  coord?: Coord,
  squareSlot?: 'a' | 'b',
  contrastVariant?: 'light' | 'dark' | 'neutral',
  explicitPalette?: PieceMedallionPalette,
): PieceMedallionPalette {
  if (explicitPalette) return explicitPalette;

  if (squareSlot) {
    return squareSlot === 'a'
      ? activeBoardTheme.board.pieceOnA
      : activeBoardTheme.board.pieceOnB;
  }
  if (contrastVariant) {
    const asset = resolvePieceThemeAsset(activeBoardTheme.id, 'roi');
    return asset.palettes[contrastVariant];
  }
  if (owner === 'red' || owner === 'black') {
    return getThemedPiecePaletteForOwner(activeBoardTheme, owner);
  }
  if (coord) {
    return getThemedPiecePaletteAtCoord(activeBoardTheme, coord).palette;
  }

  return activeBoardTheme.board.pieceNeutral;
}

export const PieceArtwork: React.FC<PieceArtworkProps> = ({
  character,
  owner = 'neutral',
  size = 'md',
  coord,
  squareSlot,
  contrastVariant,
  theme,
  palette: explicitPalette,
  className = '',
  title,
}) => {
  const uid = useId().replace(/:/g, '');
  const gradId = `bw-piece-grad-${uid}`;
  const px = SIZE_PX[size];
  const themeCtx = useOptionalBlindWarTheme();
  const effectiveTheme =
    theme ?? themeCtx?.boardTheme ?? getThemeDefinition(DEFAULT_THEME_ID);

  const safeKind = normalizePieceArtKind(character);
  const assetDescriptor = resolvePieceThemeAsset(effectiveTheme, safeKind);
  const resolvedPalette = resolveMedallionPalette(
    owner,
    effectiveTheme,
    coord,
    squareSlot,
    contrastVariant,
    explicitPalette,
  );
  const resolvedSlot = coord ? getBoardSquareSlot(coord) : squareSlot;
  const resolvedSquareHex =
    resolvedSlot === 'a'
      ? effectiveTheme.board.squareA
      : resolvedSlot === 'b'
        ? effectiveTheme.board.squareB
        : null;
  const onDarkSquare = resolvedSquareHex ? isDarkBoardColor(resolvedSquareHex) : false;

  return (
    <span
      className={`bw-piece-artwork-wrap bw-art-owner-${owner} bw-art-size-${size} bw-art-style-${assetDescriptor.styleVariant}${
        resolvedSlot ? ` bw-art-slot-${resolvedSlot}` : ''
      }${
        resolvedSquareHex
          ? onDarkSquare
            ? ' bw-art-on-dark-square'
            : ' bw-art-on-light-square'
          : ''
      } ${className}`.trim()}
      data-piece-kind={safeKind}
      data-piece-camp={owner}
      data-piece-theme={effectiveTheme.id}
      data-asset-style={assetDescriptor.styleVariant}
      data-asset-id={assetDescriptor.assetId}
      data-transparent-bg={assetDescriptor.transparentBackground ? 'true' : undefined}
      title={title}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        preserveAspectRatio="xMidYMid meet"
        className="bw-piece-artwork-svg"
        style={{ background: 'transparent' }}
        data-transparent-bg="true"
        focusable="false"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={resolvedPalette.bgTop} />
            <stop offset="100%" stopColor={resolvedPalette.bgBottom} />
          </linearGradient>
        </defs>
        {renderPieceSilhouette(safeKind, resolvedPalette, {
          styleVariant: assetDescriptor.styleVariant,
          bodyGradId: gradId,
          outlineWidth: assetDescriptor.outlineWidth,
        })}
      </svg>
    </span>
  );
};

export const PieceDualVariantPreview: React.FC<{
  readonly character: PieceArtKind | string;
  readonly size?: PieceArtSize;
  readonly theme?: BlindWarThemeDefinition;
  readonly showLabels?: boolean;
}> = ({ character, size = 'sm', theme, showLabels = false }) => {
  const themeCtx = useOptionalBlindWarTheme();
  const effectiveTheme =
    theme ?? themeCtx?.boardTheme ?? getThemeDefinition(DEFAULT_THEME_ID);
  const safeKind = normalizePieceArtKind(character);

  return (
    <div
      className="bw-dual-variant-preview"
      aria-label={`Aperçu sur cases ${effectiveTheme.board.squareALabel} et ${effectiveTheme.board.squareBLabel}`}
    >
      <div className="bw-dual-variant-item">
        <span
          className="bw-dual-variant-chip bw-dual-variant-pair"
          style={{ backgroundColor: effectiveTheme.board.squareB }}
          title={`Camps Rouge & Noir sur case ${effectiveTheme.board.squareBLabel}`}
        >
          <PieceArtwork
            character={safeKind}
            owner="red"
            squareSlot="b"
            palette={effectiveTheme.board.campRed}
            theme={effectiveTheme}
            size={size}
          />
          <PieceArtwork
            character={safeKind}
            owner="black"
            squareSlot="b"
            palette={effectiveTheme.board.campBlack}
            theme={effectiveTheme}
            size={size}
          />
        </span>
        {showLabels && (
          <span className="bw-dual-variant-caption">
            Sur case {effectiveTheme.board.squareBLabel}
          </span>
        )}
      </div>
      <div className="bw-dual-variant-item">
        <span
          className="bw-dual-variant-chip bw-dual-variant-pair"
          style={{ backgroundColor: effectiveTheme.board.squareA }}
          title={`Camps Rouge & Noir sur case ${effectiveTheme.board.squareALabel}`}
        >
          <PieceArtwork
            character={safeKind}
            owner="red"
            squareSlot="a"
            palette={effectiveTheme.board.campRed}
            theme={effectiveTheme}
            size={size}
          />
          <PieceArtwork
            character={safeKind}
            owner="black"
            squareSlot="a"
            palette={effectiveTheme.board.campBlack}
            theme={effectiveTheme}
            size={size}
          />
        </span>
        {showLabels && (
          <span className="bw-dual-variant-caption">
            Sur case {effectiveTheme.board.squareALabel}
          </span>
        )}
      </div>
    </div>
  );
};

const SAFE_AVATAR_IMAGE_PREFIX = /^data:image\/(?:png|jpeg|jpg|webp);base64,/i;

export const PieceAvatar: React.FC<{
  readonly badge: string;
  readonly avatarImage?: string | null;
  readonly alt?: string;
  readonly owner?: PieceArtOwner;
  readonly size?: PieceArtSize;
  readonly className?: string;
}> = ({ badge, avatarImage, alt, owner = 'neutral', size = 'sm', className = '' }) => {
  if (typeof avatarImage === 'string' && SAFE_AVATAR_IMAGE_PREFIX.test(avatarImage.trim())) {
    const px = SIZE_PX[size];
    return (
      <span
        className={`bw-piece-artwork-wrap bw-avatar-photo-wrap bw-art-size-${size} ${className}`.trim()}
        style={{ width: `${px}px`, height: `${px}px` }}
      >
        <img
          src={avatarImage}
          alt={alt ?? 'Avatar'}
          width={px}
          height={px}
          className="bw-avatar-photo-img"
        />
      </span>
    );
  }

  const mapped = resolveCharacterFromLegacyBadge(badge) ?? 'roi';
  return (
    <PieceArtwork
      character={mapped}
      owner={owner}
      size={size}
      className={className}
      title={alt}
    />
  );
};
