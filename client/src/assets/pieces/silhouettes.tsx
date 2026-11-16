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

export interface PieceSilhouetteStyleContext {
  readonly styleVariant: PieceAssetStyleVariant;
  readonly bodyGradId: string;
  readonly outlineWidth: number;
}

/**
 * Minimalist geometric silhouettes for all 13 BLIND WAR pieces on a 100% transparent 64×64 canvas.
 * - Occupies ~80% of the 64×64 viewBox (x: 6..58, y: 6..58) with clean outer breathing room.
 * - Bold, distinct geometric contours readable at small sizes and in grayscale.
 * - Dynamically colored from active theme palettes (`url(#bodyGradId)`, `glyphStroke`, `glyphAccent`).
 */
export function renderPieceSilhouette(
  kind: PieceArtKind,
  p: PieceMedallionPalette,
  ctx: PieceSilhouetteStyleContext,
): React.ReactNode {
  const { bodyGradId, outlineWidth } = ctx;
  const fillBody = `url(#${bodyGradId})`;
  const sw = Math.max(2.1, outlineWidth);
  const innerSw = Number(Math.max(1.8, outlineWidth * 0.9).toFixed(2));
  const detailColor = p.glyphAccent;
  const edgeStroke = p.glyphStroke;

  switch (kind) {
    case 'roi':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-geometry="royal-crown-cross">
          {/* Bold Royal Cross */}
          <path
            d="M32 6 V19 M25.5 11.5 H38.5"
            stroke={edgeStroke}
            strokeWidth={sw + 2.2}
          />
          <path
            d="M32 6 V19 M25.5 11.5 H38.5"
            stroke={detailColor}
            strokeWidth={innerSw + 0.6}
          />
          {/* Wide 3-Point Sovereign Crown */}
          <path
            d="M11 54 L8 21 L22 33 L32 18 L42 33 L56 21 L53 54 Z"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          <circle cx="32" cy="40" r="4.2" fill={detailColor} stroke={edgeStroke} strokeWidth={1.6} />
        </g>
      );

    case 'reine':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-geometry="radiant-tiara">
          {/* 5-Spire Radiant Tiara Fan (sharper & taller profile vs King) */}
          <path
            d="M14 54 L7 23 L19.5 34 L25 14 L32 30 L39 14 L44.5 34 L57 23 L50 54 Z"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          <circle cx="7.5" cy="18.5" r="3" fill={detailColor} stroke={edgeStroke} strokeWidth={1.5} />
          <circle cx="25" cy="10.5" r="3.2" fill={detailColor} stroke={edgeStroke} strokeWidth={1.5} />
          <circle cx="39" cy="10.5" r="3.2" fill={detailColor} stroke={edgeStroke} strokeWidth={1.5} />
          <circle cx="56.5" cy="18.5" r="3" fill={detailColor} stroke={edgeStroke} strokeWidth={1.5} />
          <polygon points="32,35 36.5,42 32,49 27.5,42" fill={detailColor} stroke={edgeStroke} strokeWidth={1.3} />
        </g>
      );

    case 'colosse':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-geometry="heavy-fortress">
          {/* Massive Armored Bastion Block */}
          <path
            d="M11 10 H21 V18 H27 V10 H37 V18 H43 V10 H53 V26 L56 32 V56 H8 V32 L11 26 Z"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          {/* Solid Reinforced Gate Arch */}
          <path
            d="M23 56 V39 C23 32 41 32 41 39 V56 Z"
            fill={detailColor}
            stroke={edgeStroke}
            strokeWidth={innerSw}
          />
        </g>
      );

    case 'cavalier':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-geometry="angular-horse">
          {/* Sharp Geometric Knight Head Profile */}
          <path
            d="M16 56 L19 42 L29 33 L15 31 L10 24 L25 13 L31 7 L39 13 C49 17 55 28 53 46 L50 56 Z"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          <path d="M36 19 C43 23 46 31 44 45" fill="none" stroke={detailColor} strokeWidth={3.2} />
          <circle cx="23.5" cy="21" r="2.5" fill={detailColor} stroke={edgeStroke} strokeWidth={1.2} />
        </g>
      );

    case 'berserker':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-geometry="twin-battle-axe">
          {/* Heavy Crossed Haubes */}
          <path d="M13 55 L51 11 M51 55 L13 11" stroke={edgeStroke} strokeWidth={sw + 2.8} />
          <path d="M13 55 L51 11 M51 55 L13 11" stroke={detailColor} strokeWidth={2.8} />
          {/* Broad Twin Crescent Axe Heads */}
          <path
            d="M8 31 C7 16 15 9 26 12 L23 32 Z M56 31 C57 16 49 9 38 12 L41 32 Z"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          <circle cx="32" cy="36" r="8.5" fill={fillBody} stroke={edgeStroke} strokeWidth={sw} />
          <circle cx="32" cy="36" r="3.6" fill={detailColor} />
        </g>
      );

    case 'assassin':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-geometry="piercing-dagger">
          {/* Tall Vertical Stiletto Diamond Blade */}
          <path
            d="M32 6 L43 35 L32 57 L21 35 Z"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          {/* Sharp Swept Crossguard */}
          <path
            d="M11 33 L32 41 L53 33 L32 35 Z"
            fill={detailColor}
            stroke={edgeStroke}
            strokeWidth={innerSw}
          />
          <line x1="32" y1="14" x2="32" y2="33" stroke={detailColor} strokeWidth={2.6} />
        </g>
      );

    case 'guetteur_h':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-geometry="orthogonal-eye-plus">
          {/* Strong Cardinal N/S/E/W Beacons (+) */}
          <path
            d="M32 6 V58 M6 32 H58"
            stroke={edgeStroke}
            strokeWidth={6.5}
          />
          <path
            d="M32 6 V58 M6 32 H58"
            stroke={detailColor}
            strokeWidth={3.2}
          />
          {/* Wide Horizontal Vigilant Eye */}
          <path
            d="M14 32 C22 19 42 19 50 32 C42 45 22 45 14 32 Z"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          <circle cx="32" cy="32" r="6" fill={detailColor} stroke={edgeStroke} strokeWidth={1.7} />
          <circle cx="32" cy="32" r="2.4" fill={edgeStroke} />
        </g>
      );

    case 'guetteur_d':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-geometry="diagonal-prism-cross">
          {/* Bold Diagonal Rays (×) */}
          <path
            d="M9 9 L55 55 M55 9 L9 55"
            stroke={edgeStroke}
            strokeWidth={6.5}
          />
          <path
            d="M9 9 L55 55 M55 9 L9 55"
            stroke={detailColor}
            strokeWidth={3.2}
          />
          {/* Centered Recon Diamond */}
          <polygon
            points="32,12 52,32 32,52 12,32"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          <circle cx="32" cy="32" r="6" fill={detailColor} stroke={edgeStroke} strokeWidth={1.7} />
          <circle cx="32" cy="32" r="2.4" fill={edgeStroke} />
        </g>
      );

    case 'traqueur':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-geometry="hunter-reticle-arrow">
          {/* Forward Pursuit Spear Crest */}
          <polygon
            points="32,6 44,21 20,21"
            fill={detailColor}
            stroke={edgeStroke}
            strokeWidth={innerSw}
          />
          {/* Hunter Sight Ring */}
          <circle
            cx="32"
            cy="37"
            r="17"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          <circle cx="32" cy="37" r="9.5" fill="none" stroke={detailColor} strokeWidth={3} />
          <path
            d="M32 22 V52 M17 37 H47"
            stroke={edgeStroke}
            strokeWidth={2.5}
          />
          <circle cx="32" cy="37" r="3.4" fill={detailColor} stroke={edgeStroke} strokeWidth={1.3} />
        </g>
      );

    case 'executeur':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-geometry="asymmetric-halberd">
          {/* Vertical Pole & Spear Tip */}
          <rect
            x="20"
            y="14"
            width="6.5"
            height="43"
            rx="2.5"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          <polygon
            points="23.25,6 30.5,16.5 16,16.5"
            fill={detailColor}
            stroke={edgeStroke}
            strokeWidth={1.8}
          />
          {/* Sweeping Crescent Executioner Blade */}
          <path
            d="M26.5 17 C47 16 56 27 53 43 C44 37 36 37 26.5 40 Z"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          {/* Counter-Hook */}
          <path
            d="M20 24 L9 29 L16 35 L20 33 Z"
            fill={detailColor}
            stroke={edgeStroke}
            strokeWidth={1.7}
          />
        </g>
      );

    case 'arbaletrier':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-geometry="crossbow-bolt">
          {/* Broad Horizontal Steel Limbs */}
          <path
            d="M8 29 C18 15 46 15 56 29"
            fill="none"
            stroke={edgeStroke}
            strokeWidth={sw + 4}
          />
          <path
            d="M8 29 C18 15 46 15 56 29"
            fill="none"
            stroke={fillBody}
            strokeWidth={4.2}
          />
          {/* Taut Bowstring */}
          <path d="M9.5 29.5 L32 45 L54.5 29.5" fill="none" stroke={detailColor} strokeWidth={2.6} />
          {/* Central Stock & Broadhead Quarrel */}
          <rect
            x="28.5"
            y="18"
            width="7"
            height="38"
            rx="3"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          <polygon
            points="32,7 41,20 23,20"
            fill={detailColor}
            stroke={edgeStroke}
            strokeWidth={1.8}
          />
        </g>
      );

    case 'soldat':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-geometry="vanguard-shield">
          {/* Clean Iconic Shield */}
          <path
            d="M15 9 H49 V31 C49 44.5 32 56 32 56 C32 56 15 44.5 15 31 Z"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          {/* Bold Vanguard Chevron */}
          <path
            d="M22 33 L32 21 L42 33"
            fill="none"
            stroke={edgeStroke}
            strokeWidth={sw + 2.4}
          />
          <path
            d="M22 33 L32 21 L42 33"
            fill="none"
            stroke={detailColor}
            strokeWidth={3.4}
          />
        </g>
      );

    case 'secret':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-geometry="enigma-question-seal">
          {/* Crisp Octagonal Mystery Seal */}
          <polygon
            points="21,8 43,8 56,21 56,43 43,56 21,56 8,43 8,21"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          {/* High-Contrast Question Mark Emblem */}
          <path
            d="M25.5 24 C25.5 19.5 29 17.5 32.5 17.5 C36.2 17.5 39 19.8 39 23.2 C39 26.8 35.5 28.4 33 30.2 C31.8 31.1 31.8 32.5 31.8 34.5"
            fill="none"
            stroke={edgeStroke}
            strokeWidth={sw + 2.6}
          />
          <path
            d="M25.5 24 C25.5 19.5 29 17.5 32.5 17.5 C36.2 17.5 39 19.8 39 23.2 C39 26.8 35.5 28.4 33 30.2 C31.8 31.1 31.8 32.5 31.8 34.5"
            fill="none"
            stroke={detailColor}
            strokeWidth={3.4}
          />
          <circle cx="32" cy="43.5" r="3" fill={detailColor} stroke={edgeStroke} strokeWidth={1.5} />
        </g>
      );
  }
}
