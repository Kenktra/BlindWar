import React, { useId } from 'react';
import {
  DEFAULT_THEME_ID,
  getBoardSquareSlot,
  getThemeDefinition,
  getThemedPiecePaletteAtCoord,
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

/**
 * Exact original circular medallion palettes from pre-rework BLIND WAR artwork.
 * Kept for the default Rouge et noir theme when rendered off-board (`red`, `black`, `neutral`),
 * while themed games dynamically feed `PieceMedallionPalette` from the active theme.
 */
const ORIGINAL_PALETTES: Readonly<Record<PieceArtOwner, PieceMedallionPalette>> = {
  red: {
    bgTop: '#991b1b',
    bgBottom: '#450a0a',
    rimOuter: '#f59e0b',
    rimInner: '#fde68a',
    glyphMain: '#fffbeb',
    glyphAccent: '#fbbf24',
    glyphStroke: '#450a0a',
  },
  black: {
    bgTop: '#334155',
    bgBottom: '#020617',
    rimOuter: '#94a3b8',
    rimInner: '#e2e8f0',
    glyphMain: '#f8fafc',
    glyphAccent: '#38bdf8',
    glyphStroke: '#020617',
  },
  neutral: {
    bgTop: '#3f3f46',
    bgBottom: '#18181b',
    rimOuter: '#d97706',
    rimInner: '#fcd34d',
    glyphMain: '#fef3c7',
    glyphAccent: '#f59e0b',
    glyphStroke: '#18181b',
  },
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

  if (coord) {
    return getThemedPiecePaletteAtCoord(activeBoardTheme, coord).palette;
  }
  if (squareSlot) {
    return squareSlot === 'a'
      ? activeBoardTheme.board.pieceOnA
      : activeBoardTheme.board.pieceOnB;
  }
  if (contrastVariant) {
    const asset = resolvePieceThemeAsset(activeBoardTheme.id, 'roi');
    return asset.palettes[contrastVariant];
  }

  // Off-board icons (rules, collection, placement reserve, profile):
  // Default Rouge & Noir keeps the exact original palettes verbatim;
  // other themes harmoniously tint the medallion to match their palette.
  if (activeBoardTheme.id === DEFAULT_THEME_ID) {
    return ORIGINAL_PALETTES[owner];
  }
  if (owner === 'red') return activeBoardTheme.board.pieceOnB;
  if (owner === 'black') return activeBoardTheme.board.pieceOnA;
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
  const assetDescriptor = resolvePieceThemeAsset(effectiveTheme.id, safeKind);
  const resolvedPalette = resolveMedallionPalette(
    owner,
    effectiveTheme,
    coord,
    squareSlot,
    contrastVariant,
    explicitPalette,
  );
  const resolvedSlot = coord ? getBoardSquareSlot(coord) : squareSlot;

  return (
    <span
      className={`bw-piece-artwork-wrap bw-art-owner-${owner} bw-art-size-${size} bw-art-style-${assetDescriptor.styleVariant}${
        resolvedSlot ? ` bw-art-slot-${resolvedSlot}` : ''
      } ${className}`.trim()}
      data-piece-kind={safeKind}
      data-piece-theme={effectiveTheme.id}
      data-asset-style={assetDescriptor.styleVariant}
      data-asset-id={assetDescriptor.assetId}
      title={title}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 64 64"
        className="bw-piece-artwork-svg"
        focusable="false"
      >
        <defs>
          <radialGradient id={gradId} cx="35%" cy="28%" r="75%">
            <stop offset="0%" stopColor={resolvedPalette.bgTop} />
            <stop offset="100%" stopColor={resolvedPalette.bgBottom} />
          </radialGradient>
        </defs>
        <circle
          cx="32"
          cy="32"
          r="29"
          fill={`url(#${gradId})`}
          stroke={resolvedPalette.rimOuter}
          strokeWidth={assetDescriptor.outerStrokeWidth}
        />
        <circle
          cx="32"
          cy="32"
          r={assetDescriptor.innerRingRadius}
          fill="none"
          stroke={resolvedPalette.rimInner}
          strokeWidth="1.1"
          strokeOpacity={assetDescriptor.innerRingOpacity}
        />
        {assetDescriptor.frameDecoration === 'tactical_bevel' && (
          <polygon
            points="32,6 50,14 58,32 50,50 32,58 14,50 6,32 14,14"
            fill="none"
            stroke={resolvedPalette.rimInner}
            strokeWidth="0.8"
            strokeOpacity="0.32"
          />
        )}
        {renderPieceSilhouette(safeKind, resolvedPalette, assetDescriptor.styleVariant)}
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
          className="bw-dual-variant-chip"
          style={{ backgroundColor: effectiveTheme.board.squareB }}
          title={`Pion affiché sur case ${effectiveTheme.board.squareBLabel}`}
        >
          <PieceArtwork
            character={safeKind}
            squareSlot="b"
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
          className="bw-dual-variant-chip"
          style={{ backgroundColor: effectiveTheme.board.squareA }}
          title={`Pion affiché sur case ${effectiveTheme.board.squareALabel}`}
        >
          <PieceArtwork
            character={safeKind}
            squareSlot="a"
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
