import React from 'react';
import type { CharacterType, PieceMedallionPalette } from '../../../../shared/src/index.js';

export type PieceArtKind = CharacterType | 'secret';
export type PieceAssetStyleVariant =
  | 'classic'
  | 'chesscom'
  | 'monochrome'
  | 'blue';

export const ALL_PIECE_ART_KINDS: readonly PieceArtKind[] = [
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
];

/**
 * Shared recognizable vector silhouettes for every BLIND WAR piece.
 * Centralizing the 13 silhouettes avoids duplicating geometry across theme packs,
 * while stroke weights and style accents adapt automatically per theme pack.
 */
export function renderPieceSilhouette(
  kind: PieceArtKind,
  p: PieceMedallionPalette,
  styleVariant: PieceAssetStyleVariant = 'classic',
): React.ReactNode {
  const strokeBoost = styleVariant === 'monochrome' ? 0.35 : styleVariant === 'chesscom' ? -0.15 : 0;
  const sw = (base: number) => Number((base + strokeBoost).toFixed(2));

  switch (kind) {
    case 'roi':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path d="M32 10 L32 20 M27 14.5 L37 14.5" stroke={p.glyphAccent} strokeWidth={sw(3.2)} />
          <path
            d="M15 44 L13 24 L23 30 L32 19 L41 30 L51 24 L49 44 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth={sw(2)}
          />
          <rect
            x="16"
            y="45"
            width="32"
            height="6"
            rx="2.5"
            fill={p.glyphAccent}
            stroke={p.glyphStroke}
            strokeWidth={sw(1.6)}
          />
          <circle cx="32" cy="34" r="3" fill={p.glyphAccent} />
        </g>
      );

    case 'reine':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path
            d="M15 43 L12 22 L22 31 L27 17 L32 29 L37 17 L42 31 L52 22 L49 43 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth={sw(2)}
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
            strokeWidth={sw(1.6)}
          />
        </g>
      );

    case 'colosse':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path
            d="M17 15 H23 V20 H29 V15 H35 V20 H41 V15 H47 V27 L44 31 V45 L48 50 H16 L20 45 V31 L17 27 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth={sw(2.2)}
          />
          <path
            d="M24 31 H40 L37 44 H27 Z"
            fill={p.glyphAccent}
            stroke={p.glyphStroke}
            strokeWidth={sw(1.5)}
          />
          <path d="M32 33 V42" stroke={p.glyphStroke} strokeWidth={sw(2.2)} />
        </g>
      );

    case 'cavalier':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path
            d="M20 50 L22 41 L27 33 C23 32 19 32 17 28 C16 24 22 18 28 15 L31 11 L35 16 C43 17 48 25 47 36 C46 42 44 46 45 50 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth={sw(2.2)}
          />
          <path d="M33 21 C38 23 41 29 40 38" stroke={p.glyphAccent} strokeWidth={sw(2.6)} fill="none" />
          <circle cx="26" cy="22" r="2" fill={p.glyphStroke} />
        </g>
      );

    case 'berserker':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path
            d="M18 48 L45 21 M46 48 L19 21"
            stroke={p.glyphAccent}
            strokeWidth={sw(4.2)}
          />
          <path
            d="M23 13 C31 12 36 17 34 25 L21 23 Z M41 13 C33 12 28 17 30 25 L43 23 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth={sw(1.8)}
          />
          <path
            d="M14 29 C14 21 20 15 27 17 L24 28 Z M50 29 C50 21 44 15 37 17 L40 28 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth={sw(1.8)}
          />
          <circle cx="32" cy="34" r="5" fill={p.glyphAccent} stroke={p.glyphStroke} strokeWidth={sw(1.8)} />
        </g>
      );

    case 'assassin':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path
            d="M32 11 L47 28 L42 48 L32 42 L22 48 L17 28 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth={sw(2)}
            opacity="0.26"
          />
          <path
            d="M32 11 L38 37 L32 52 L26 37 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth={sw(2)}
          />
          <path d="M21 37 H43" stroke={p.glyphAccent} strokeWidth={sw(3.5)} />
          <path d="M16 20 L25 29 M48 20 L39 29" stroke={p.glyphAccent} strokeWidth={sw(2.8)} />
        </g>
      );

    case 'guetteur_h':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path d="M11 32 H20 M44 32 H53 M32 11 V20 M32 44 V53" stroke={p.glyphAccent} strokeWidth={sw(3.4)} />
          <path
            d="M16 32 C22 23 42 23 48 32 C42 41 22 41 16 32 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth={sw(2)}
          />
          <circle cx="32" cy="32" r="4.5" fill={p.glyphAccent} stroke={p.glyphStroke} strokeWidth={sw(1.5)} />
          <circle cx="32" cy="32" r="1.8" fill={p.glyphStroke} />
        </g>
      );

    case 'guetteur_d':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path d="M14 14 L22 22 M50 14 L42 22 M14 50 L22 42 M50 50 L42 42" stroke={p.glyphAccent} strokeWidth={sw(3.4)} />
          <polygon
            points="32,16 48,32 32,48 16,32"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth={sw(2)}
          />
          <circle cx="32" cy="32" r="5" fill={p.glyphAccent} stroke={p.glyphStroke} strokeWidth={sw(1.5)} />
          <circle cx="32" cy="32" r="2" fill={p.glyphStroke} />
        </g>
      );

    case 'traqueur':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <circle
            cx="32"
            cy="32"
            r="16"
            fill="none"
            stroke={p.glyphAccent}
            strokeWidth={sw(3)}
          />
          <circle
            cx="32"
            cy="32"
            r="8.5"
            fill="none"
            stroke={p.glyphMain}
            strokeWidth={sw(2.4)}
          />
          <path d="M32 10 V22 M32 42 V54 M10 32 H22 M42 32 H54" stroke={p.glyphMain} strokeWidth={sw(3)} />
          <polygon
            points="32,25 38,32 32,39 26,32"
            fill={p.glyphAccent}
            stroke={p.glyphStroke}
            strokeWidth={sw(1.4)}
          />
        </g>
      );

    case 'executeur':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <rect
            x="29.5"
            y="12"
            width="5"
            height="40"
            rx="2"
            fill={p.glyphAccent}
            stroke={p.glyphStroke}
            strokeWidth={sw(1.6)}
          />
          <path
            d="M34 15 C46 15 51 23 50 32 C44 29 39 29 34 31 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth={sw(2)}
          />
          <path
            d="M30 20 L16 24 L25 30 L30 28 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth={sw(1.8)}
          />
          <polygon points="32,9 36,15 28,15" fill={p.glyphMain} />
        </g>
      );

    case 'arbaletrier':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path
            d="M15 25 C22 15 42 15 49 25"
            fill="none"
            stroke={p.glyphMain}
            strokeWidth={sw(4.2)}
          />
          <path d="M16 26 L32 38 L48 26" fill="none" stroke={p.glyphAccent} strokeWidth={sw(2.2)} />
          <path d="M32 12 V50" stroke={p.glyphAccent} strokeWidth={sw(3.8)} />
          <polygon
            points="32,9 38,18 26,18"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth={sw(1.4)}
          />
          <path d="M27 46 L32 42 L37 46" fill="none" stroke={p.glyphMain} strokeWidth={sw(2.4)} />
        </g>
      );

    case 'soldat':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path
            d="M20 17 H44 V32 C44 41 38 47 32 51 C26 47 20 41 20 32 Z"
            fill={p.glyphMain}
            stroke={p.glyphStroke}
            strokeWidth={sw(2.2)}
          />
          <path d="M24 33 L32 23 L40 33" fill="none" stroke={p.glyphAccent} strokeWidth={sw(4.2)} />
          <path d="M26 40 L32 33 L38 40" fill="none" stroke={p.glyphStroke} strokeWidth={sw(2.6)} />
        </g>
      );

    case 'secret':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <polygon
            points="32,12 49,22 49,42 32,52 15,42 15,22"
            fill="none"
            stroke={p.glyphAccent}
            strokeWidth={sw(2.4)}
            strokeDasharray="4 2.5"
            opacity="0.85"
          />
          <path
            d="M22 25 L32 18 L42 25 L38 43 H26 Z"
            fill={p.glyphMain}
            opacity="0.22"
          />
          <circle cx="32" cy="29" r="5" fill={p.glyphAccent} />
          <path d="M27 41 C27 36 37 36 37 41" fill="none" stroke={p.glyphMain} strokeWidth={sw(3)} />
        </g>
      );
  }
}
