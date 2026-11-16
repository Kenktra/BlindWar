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

export type PieceArtKind = CharacterType | 'secret';
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

const PIECE_ART_KIND_SET: ReadonlySet<string> = new Set<string>([
  'roi',
  'reine',
  'colosse',
  'cavalier',
  'berserker',
  'assassin',
  'guetteur_h',
  'guetteur_d',
  'traqueur',
  'executeur',
  'arbaletrier',
  'soldat',
  'secret',
]);

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

function renderEmblemPaths(kind: PieceArtKind, p: PieceMedallionPalette): React.ReactNode {
  switch (kind) {
    case 'roi':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Crown + Sovereign Cross */}
          <path d="M32 10 L32 20 M27 14.5 L37 14.5" stroke={p.glyphAccent} strokeWidth="3.2" />
          <path
            d="M15 44 L13 24 L23 30 L32 19 L41 30 L51 24 L49 44 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth="2"
          />
          <rect
            x="16"
            y="45"
            width="32"
            height="6"
            rx="2.5"
            fill={p.glyphAccent}
            stroke={p.glyphStroke}
            strokeWidth="1.6"
          />
          <circle cx="32" cy="34" r="3" fill={p.glyphAccent} />
        </g>
      );

    case 'reine':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Imperial Coronet + Star */}
          <path
            d="M15 43 L12 22 L22 31 L27 17 L32 29 L37 17 L42 31 L52 22 L49 43 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth="2"
          />
          <circle cx="12" cy="19" r="2.6" fill={p.glyphAccent} />
          <circle cx="27" cy="14" r="2.6" fill={p.glyphAccent} />
          <circle cx="37" cy="14" r="2.6" fill={p.glyphAccent} />
          <circle cx="52" cy="19" r="2.6" fill={p.glyphAccent} />
          <rect
            x="16"
            y="45"
            width="32"
            height="5.5"
            rx="2.5"
            fill={p.glyphAccent}
            stroke={p.glyphStroke}
            strokeWidth="1.6"
          />
        </g>
      );

    case 'colosse':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Monolithic Armored Bastion Tower */}
          <path
            d="M17 15 H23 V20 H29 V15 H35 V20 H41 V15 H47 V27 L44 31 V45 L48 50 H16 L20 45 V31 L17 27 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth="2.2"
          />
          <path
            d="M24 31 H40 L37 44 H27 Z"
            fill={p.glyphAccent}
            stroke={p.glyphStroke}
            strokeWidth="1.5"
          />
          <path d="M32 33 V42" stroke={p.glyphStroke} strokeWidth="2.2" />
        </g>
      );

    case 'cavalier':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Warhorse Crest + L-Leap Arc */}
          <path
            d="M20 50 L22 41 L27 33 C23 32 19 32 17 28 C16 24 22 18 28 15 L31 11 L35 16 C43 17 48 25 47 36 C46 42 44 46 45 50 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth="2.2"
          />
          <path d="M33 21 C38 23 41 29 40 38" stroke={p.glyphAccent} strokeWidth="2.6" fill="none" />
          <circle cx="26" cy="22" r="2" fill={p.glyphStroke} />
        </g>
      );

    case 'berserker':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Double Heavy Cleaver Twin-Blades */}
          <path
            d="M18 48 L45 21 M46 48 L19 21"
            stroke={p.glyphAccent}
            strokeWidth="4.2"
          />
          <path
            d="M23 13 C31 12 36 17 34 25 L21 23 Z M41 13 C33 12 28 17 30 25 L43 23 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth="1.8"
          />
          <path
            d="M14 29 C14 21 20 15 27 17 L24 28 Z M50 29 C50 21 44 15 37 17 L40 28 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth="1.8"
          />
          <circle cx="32" cy="34" r="5" fill={p.glyphAccent} stroke={p.glyphStroke} strokeWidth="1.8" />
        </g>
      );

    case 'assassin':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Hidden Shadow Hood & Twin Curved Daggers */}
          <path
            d="M32 11 L47 28 L42 48 L32 42 L22 48 L17 28 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth="2"
            opacity="0.26"
          />
          <path
            d="M32 11 L38 37 L32 52 L26 37 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth="2"
          />
          <path d="M21 37 H43" stroke={p.glyphAccent} strokeWidth="3.5" />
          <path d="M16 20 L25 29 M48 20 L39 29" stroke={p.glyphAccent} strokeWidth="2.8" />
        </g>
      );

    case 'guetteur_h':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Horizontal / Vertical Vigilant Eye Beacon */}
          <path d="M11 32 H20 M44 32 H53 M32 11 V20 M32 44 V53" stroke={p.glyphAccent} strokeWidth="3.4" />
          <path
            d="M16 32 C22 23 42 23 48 32 C42 41 22 41 16 32 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth="2"
          />
          <circle cx="32" cy="32" r="4.5" fill={p.glyphAccent} stroke={p.glyphStroke} strokeWidth="1.5" />
          <circle cx="32" cy="32" r="1.8" fill={p.glyphStroke} />
        </g>
      );

    case 'guetteur_d':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Diagonal Reconnaissance Sight */}
          <path d="M14 14 L22 22 M50 14 L42 22 M14 50 L22 42 M50 50 L42 42" stroke={p.glyphAccent} strokeWidth="3.4" />
          <polygon
            points="32,16 48,32 32,48 16,32"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth="2"
          />
          <circle cx="32" cy="32" r="5" fill={p.glyphAccent} stroke={p.glyphStroke} strokeWidth="1.5" />
          <circle cx="32" cy="32" r="2" fill={p.glyphStroke} />
        </g>
      );

    case 'traqueur':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Wolf-Hound Predator Reticle + Pursuit Fang */}
          <circle
            cx="32"
            cy="32"
            r="16"
            fill="none"
            stroke={p.glyphAccent}
            strokeWidth="3"
          />
          <circle
            cx="32"
            cy="32"
            r="8.5"
            fill="none"
            stroke={p.glyphMain}
            strokeWidth="2.4"
          />
          <path d="M32 10 V22 M32 42 V54 M10 32 H22 M42 32 H54" stroke={p.glyphMain} strokeWidth="3" />
          <polygon
            points="32,25 38,32 32,39 26,32"
            fill={p.glyphAccent}
            stroke={p.glyphStroke}
            strokeWidth="1.4"
          />
        </g>
      );

    case 'executeur':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Heavy Executioner Halberd / Piercing Crescent */}
          <rect
            x="29.5"
            y="12"
            width="5"
            height="40"
            rx="2"
            fill={p.glyphAccent}
            stroke={p.glyphStroke}
            strokeWidth="1.6"
          />
          <path
            d="M34 15 C46 15 51 23 50 32 C44 29 39 29 34 31 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth="2"
          />
          <path
            d="M30 20 L16 24 L25 30 L30 28 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth="1.8"
          />
          <polygon points="32,9 36,15 28,15" fill={p.glyphMain} />
        </g>
      );

    case 'arbaletrier':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Steel Crossbow Arc + Drawn Quarrel */}
          <path
            d="M15 25 C22 15 42 15 49 25"
            fill="none"
            stroke={p.glyphMain}
            strokeWidth="4.2"
          />
          <path d="M16 26 L32 38 L48 26" fill="none" stroke={p.glyphAccent} strokeWidth="2.2" />
          <path d="M32 12 V50" stroke={p.glyphAccent} strokeWidth="3.8" />
          <polygon
            points="32,9 38,18 26,18"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth="1.4"
          />
          <path d="M27 46 L32 42 L37 46" fill="none" stroke={p.glyphMain} strokeWidth="2.4" />
        </g>
      );

    case 'soldat':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Vanguard Shield + Upward Promotion Chevron */}
          <path
            d="M20 17 H44 V32 C44 41 38 47 32 51 C26 47 20 41 20 32 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth="2.2"
          />
          <path d="M24 33 L32 23 L40 33" fill="none" stroke={p.glyphAccent} strokeWidth="4.2" />
          <path d="M26 40 L32 33 L38 40" fill="none" stroke={p.glyphStroke} strokeWidth="2.6" />
        </g>
      );

    case 'secret':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Veiled Tactical Seal (Hidden Enemy) */}
          <polygon
            points="32,12 49,22 49,42 32,52 15,42 15,22"
            fill="none"
            stroke={p.glyphAccent}
            strokeWidth="2.4"
            strokeDasharray="4 2.5"
            opacity="0.85"
          />
          <path
            d="M22 25 L32 18 L42 25 L38 43 H26 Z"
            fill={p.glyphMain}
            opacity="0.22"
          />
          <circle cx="32" cy="29" r="5" fill={p.glyphAccent} />
          <path d="M27 41 C27 36 37 36 37 41" fill="none" stroke={p.glyphMain} strokeWidth="3" />
        </g>
      );
  }
}

export interface PieceArtworkProps {
  readonly character: PieceArtKind | string;
  readonly owner?: PieceArtOwner;
  readonly size?: PieceArtSize;
  readonly coord?: Coord;
  readonly squareSlot?: 'a' | 'b';
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
  const resolvedPalette = resolveMedallionPalette(
    owner,
    effectiveTheme,
    coord,
    squareSlot,
    explicitPalette,
  );
  const resolvedSlot = coord ? getBoardSquareSlot(coord) : squareSlot;

  return (
    <span
      className={`bw-piece-artwork-wrap bw-art-owner-${owner} bw-art-size-${size}${
        resolvedSlot ? ` bw-art-slot-${resolvedSlot}` : ''
      } ${className}`.trim()}
      data-piece-kind={safeKind}
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
          strokeWidth="3"
        />
        <circle
          cx="32"
          cy="32"
          r="25"
          fill="none"
          stroke={resolvedPalette.rimInner}
          strokeWidth="1.1"
          strokeOpacity="0.55"
        />
        {renderEmblemPaths(safeKind, resolvedPalette)}
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
