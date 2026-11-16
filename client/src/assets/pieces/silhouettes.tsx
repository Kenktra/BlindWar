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
 * Shared sculpted vector silhouettes for all 13 BLIND WAR pieces on a 100% transparent 64×64 canvas.
 * Every piece uses the exact same proportions (central hitbox x=12..52, y=8..55 with balanced margins),
 * uniform outer contour thickness, and cohesive two-tone gradient shading across every theme.
 */
export function renderPieceSilhouette(
  kind: PieceArtKind,
  p: PieceMedallionPalette,
  ctx: PieceSilhouetteStyleContext,
): React.ReactNode {
  const { bodyGradId, outlineWidth, styleVariant } = ctx;
  const fillBody = `url(#${bodyGradId})`;
  const sw = outlineWidth;
  const thinSw = Number((outlineWidth * 0.72).toFixed(2));
  const detailColor = p.glyphAccent;
  const edgeStroke = p.glyphStroke;
  const highlightOpacity = styleVariant === 'monochrome' ? 0.35 : 0.45;

  switch (kind) {
    case 'roi':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Sovereign Cross */}
          <path
            d="M32 8 V19 M27.5 12.5 H36.5"
            stroke={edgeStroke}
            strokeWidth={sw + 1.2}
          />
          <path
            d="M32 8 V19 M27.5 12.5 H36.5"
            stroke={detailColor}
            strokeWidth={thinSw}
          />
          {/* Sculpted Royal Crown */}
          <path
            d="M16 44 L13.5 22 L23.5 30 L32 18.5 L40.5 30 L50.5 22 L48 44 Z"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          <circle cx="32" cy="33.5" r="3" fill={detailColor} stroke={edgeStroke} strokeWidth={1.3} />
          {/* Pedestal Collar */}
          <rect
            x="15"
            y="45.5"
            width="34"
            height="7"
            rx="3"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          <line
            x1="19"
            y1="49"
            x2="45"
            y2="49"
            stroke={detailColor}
            strokeWidth={1.6}
            strokeOpacity={0.9}
          />
        </g>
      );

    case 'reine':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Coronet Points */}
          <path
            d="M16 44 L13 21 L22.5 31 L27.5 16.5 L32 28.5 L36.5 16.5 L41.5 31 L51 21 L48 44 Z"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          <circle cx="13" cy="18" r="2.7" fill={detailColor} stroke={edgeStroke} strokeWidth={1.3} />
          <circle cx="27.5" cy="13.5" r="2.7" fill={detailColor} stroke={edgeStroke} strokeWidth={1.3} />
          <circle cx="36.5" cy="13.5" r="2.7" fill={detailColor} stroke={edgeStroke} strokeWidth={1.3} />
          <circle cx="51" cy="18" r="2.7" fill={detailColor} stroke={edgeStroke} strokeWidth={1.3} />
          <polygon points="32,31 35,35.5 32,40 29,35.5" fill={detailColor} opacity={0.95} />
          <rect
            x="15.5"
            y="45.5"
            width="33"
            height="7"
            rx="3"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
        </g>
      );

    case 'colosse':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Heavy Battlement Monolith */}
          <path
            d="M16 12 H22.5 V18 H28.5 V12 H35.5 V18 H41.5 V12 H48 V25 L44.5 29.5 V45 L49 52.5 H15 L19.5 45 V29.5 L16 25 Z"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          {/* Reinforced Gate Arch */}
          <path
            d="M25.5 45.5 V34 C25.5 29.5 38.5 29.5 38.5 34 V45.5 Z"
            fill={detailColor}
            stroke={edgeStroke}
            strokeWidth={thinSw}
          />
          <line x1="32" y1="31.5" x2="32" y2="45" stroke={edgeStroke} strokeWidth={thinSw} />
          <line x1="21" y1="25" x2="43" y2="25" stroke={p.rimInner} strokeWidth={1.4} strokeOpacity={highlightOpacity} />
        </g>
      );

    case 'cavalier':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Sculpted Warhorse Profile */}
          <path
            d="M19 45.5 L21.5 37.5 L27.5 30.5 C23.5 30 18.5 29.5 16.5 25 C15.2 21 21 15.5 27.5 13 L30.5 8.5 L35 13.5 C43.5 15 48.5 23.5 47 35.5 L45 45.5 Z"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          <path
            d="M33.5 19 C39 21.5 42 27.5 41 37.5"
            fill="none"
            stroke={detailColor}
            strokeWidth={2.4}
          />
          <circle cx="25" cy="20.5" r="1.9" fill={edgeStroke} />
          <rect
            x="15.5"
            y="46"
            width="33"
            height="6.5"
            rx="3"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
        </g>
      );

    case 'berserker':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Twin War-Axes Crossed */}
          <path
            d="M18 48 L46 16 M46 48 L18 16"
            stroke={edgeStroke}
            strokeWidth={sw + 2.2}
          />
          <path
            d="M18 48 L46 16 M46 48 L18 16"
            stroke={detailColor}
            strokeWidth={2.4}
          />
          <path
            d="M14 25 C14 16 20 11 28 13 L25 26 Z M50 25 C50 16 44 11 36 13 L39 26 Z"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          <circle
            cx="32"
            cy="33"
            r="6.5"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          <circle cx="32" cy="33" r="2.7" fill={detailColor} />
          <rect
            x="17"
            y="47"
            width="30"
            height="5.5"
            rx="2.5"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
        </g>
      );

    case 'assassin':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Twin Flank Sabers */}
          <path
            d="M15 22 L26 34 M49 22 L38 34"
            stroke={edgeStroke}
            strokeWidth={sw + 1.4}
          />
          <path
            d="M15 22 L26 34 M49 22 L38 34"
            stroke={detailColor}
            strokeWidth={thinSw}
          />
          {/* Piercing Center Stiletto Blade */}
          <path
            d="M32 8.5 L39 36 L32 46 L25 36 Z"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          <line x1="32" y1="15" x2="32" y2="39" stroke={detailColor} strokeWidth={2} />
          {/* Guard & Pommel Base */}
          <path
            d="M19 36 Q32 41.5 45 36"
            fill="none"
            stroke={edgeStroke}
            strokeWidth={sw + 1.4}
          />
          <path
            d="M19 36 Q32 41.5 45 36"
            fill="none"
            stroke={detailColor}
            strokeWidth={thinSw}
          />
          <rect
            x="19"
            y="47"
            width="26"
            height="5.5"
            rx="2.5"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
        </g>
      );

    case 'guetteur_h':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Orthogonal Cardinal Beacons */}
          <path
            d="M32 9 V17 M32 41 V47 M10 29 H17 M47 29 H54"
            stroke={edgeStroke}
            strokeWidth={sw + 1.2}
          />
          <path
            d="M32 9 V17 M32 41 V47 M10 29 H17 M47 29 H54"
            stroke={detailColor}
            strokeWidth={2.2}
          />
          {/* Vigilant Eye Body */}
          <path
            d="M14 29 C21.5 18 42.5 18 50 29 C42.5 40 21.5 40 14 29 Z"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          <circle cx="32" cy="29" r="5.5" fill={detailColor} stroke={edgeStroke} strokeWidth={thinSw} />
          <circle cx="32" cy="29" r="2.2" fill={edgeStroke} />
          <rect
            x="17"
            y="47"
            width="30"
            height="5.5"
            rx="2.5"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
        </g>
      );

    case 'guetteur_d':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Diagonal Sight Rays */}
          <path
            d="M13 13 L21 21 M51 13 L43 21 M13 45 L21 37 M51 45 L43 37"
            stroke={edgeStroke}
            strokeWidth={sw + 1.2}
          />
          <path
            d="M13 13 L21 21 M51 13 L43 21 M13 45 L21 37 M51 45 L43 37"
            stroke={detailColor}
            strokeWidth={2.2}
          />
          {/* Diamond Recon Prism */}
          <polygon
            points="32,12 49,29 32,46 15,29"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          <circle cx="32" cy="29" r="5.5" fill={detailColor} stroke={edgeStroke} strokeWidth={thinSw} />
          <circle cx="32" cy="29" r="2.2" fill={edgeStroke} />
          <rect
            x="17"
            y="47"
            width="30"
            height="5.5"
            rx="2.5"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
        </g>
      );

    case 'traqueur':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Predator Crosshair Crest */}
          <circle
            cx="32"
            cy="28"
            r="14.5"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          <circle cx="32" cy="28" r="7.5" fill="none" stroke={detailColor} strokeWidth={2.2} />
          <path
            d="M32 9 V19 M32 37 V47 M13 28 H23 M41 28 H51"
            stroke={edgeStroke}
            strokeWidth={sw + 0.8}
          />
          <path
            d="M32 9 V19 M32 37 V47 M13 28 H23 M41 28 H51"
            stroke={detailColor}
            strokeWidth={1.9}
          />
          <polygon
            points="32,22.5 36.5,28 32,33.5 27.5,28"
            fill={detailColor}
            stroke={edgeStroke}
            strokeWidth={1.3}
          />
          <rect
            x="17"
            y="47"
            width="30"
            height="5.5"
            rx="2.5"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
        </g>
      );

    case 'executeur':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Halberd Spearhead & Shaft */}
          <rect
            x="29.5"
            y="11"
            width="5"
            height="36"
            rx="2"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          <polygon points="32,8 36.5,14.5 27.5,14.5" fill={detailColor} stroke={edgeStroke} strokeWidth={1.4} />
          {/* Heavy Executioner Crescent Blade */}
          <path
            d="M34.5 15.5 C46.5 15.5 52 24 50 33 C44.5 29.5 39.5 29.5 34.5 31.5 Z"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          <path
            d="M29.5 20 L16 24 L25 30 L29.5 28.5 Z"
            fill={detailColor}
            stroke={edgeStroke}
            strokeWidth={thinSw}
          />
          <rect
            x="17"
            y="47"
            width="30"
            height="5.5"
            rx="2.5"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
        </g>
      );

    case 'arbaletrier':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Steel Crossbow Arc */}
          <path
            d="M14 25 C22 14.5 42 14.5 50 25"
            fill="none"
            stroke={edgeStroke}
            strokeWidth={sw + 2}
          />
          <path
            d="M14 25 C22 14.5 42 14.5 50 25"
            fill="none"
            stroke={fillBody}
            strokeWidth={3.2}
          />
          {/* Bowstring */}
          <path d="M15 25.5 L32 37.5 L49 25.5" fill="none" stroke={detailColor} strokeWidth={2.2} />
          {/* Stock & Quarrel Bolt */}
          <rect
            x="29.5"
            y="17"
            width="5"
            height="30"
            rx="2"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          <polygon
            points="32,8.5 38,18.5 26,18.5"
            fill={detailColor}
            stroke={edgeStroke}
            strokeWidth={thinSw}
          />
          <rect
            x="17"
            y="47"
            width="30"
            height="5.5"
            rx="2.5"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
        </g>
      );

    case 'soldat':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Vanguard Shield */}
          <path
            d="M18.5 13 H45.5 V29.5 C45.5 39 39 45.5 32 49 C25 45.5 18.5 39 18.5 29.5 Z"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          {/* Promotion Chevron */}
          <path
            d="M24 31 L32 21.5 L40 31"
            fill="none"
            stroke={edgeStroke}
            strokeWidth={sw + 1.5}
          />
          <path
            d="M24 31 L32 21.5 L40 31"
            fill="none"
            stroke={detailColor}
            strokeWidth={2.6}
          />
          <path
            d="M26 38.5 L32 31.5 L38 38.5"
            fill="none"
            stroke={edgeStroke}
            strokeWidth={2}
          />
          <rect
            x="18.5"
            y="47.5"
            width="27"
            height="5"
            rx="2.5"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
        </g>
      );

    case 'secret':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Veiled Enigma Seal — purely sculpted token on transparent background */}
          <polygon
            points="32,10 49.5,20 49.5,39.5 32,49.5 14.5,39.5 14.5,20"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
          <polygon
            points="32,14.5 45.5,22.2 45.5,37.3 32,45 18.5,37.3 18.5,22.2"
            fill="none"
            stroke={detailColor}
            strokeWidth={1.6}
            strokeDasharray="3.5 2"
          />
          {/* Masked Hood Crest */}
          <circle cx="32" cy="26" r="4.8" fill={detailColor} stroke={edgeStroke} strokeWidth={1.4} />
          <path
            d="M23.5 38 C24 32.5 40 32.5 40.5 38"
            fill="none"
            stroke={detailColor}
            strokeWidth={2.6}
          />
          <rect
            x="18"
            y="47.5"
            width="28"
            height="5"
            rx="2.5"
            fill={fillBody}
            stroke={edgeStroke}
            strokeWidth={sw}
          />
        </g>
      );
  }
}
