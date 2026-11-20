import React from 'react';
import {
  CARD_TYPES,
  type CardArtworkPalette,
  type CardType,
  type VisualStyleMode,
} from '../../../../../shared/src/index.js';

export type CardAssetStyleVariant =
  | 'red-black'
  | 'classic'
  | 'chesscom'
  | 'monochrome'
  | 'blue';

export const ALL_CARD_ART_KINDS: readonly CardType[] = CARD_TYPES;

export interface CardSilhouetteStyleContext {
  readonly styleVariant: CardAssetStyleVariant;
  readonly bodyGradId: string;
  readonly outlineWidth: number;
  readonly visualStyle?: VisualStyleMode;
}

interface PixelCardSpriteSpec {
  readonly geometryId: string;
  /** 16 rows of 16 characters: '.' transparent, '#' stroke, 'B' body gradient, 'A' accent, 'S' secondary */
  readonly grid: readonly string[];
}

const PIXEL_CARD_SPRITES: Readonly<Record<CardType, PixelCardSpriteSpec>> = {
  kamikaze: {
    geometryId: 'radial-detonation',
    grid: [
      '.......##.......',
      '..##..#BB#..##..',
      '.#BB#.#BB#.#BB#.',
      '..#BB##AA##BB#..',
      '...#BBAAAA#B#...',
      '.###BASSAAAB###.',
      '#BBBBASAAASBBBB#',
      '#BBBAAASSAAABBB#',
      '#BBBAAASSAAABBB#',
      '#BBBBASAAASBBBB#',
      '.###BASSAAAB###.',
      '...#B#AAAABB#...',
      '..#BB##AA##BB#..',
      '.#BB#.#BB#.#BB#.',
      '..##..#BB#..##..',
      '.......##.......',
    ],
  },
  invincibilite: {
    geometryId: 'diamond-aegis',
    grid: [
      '......####......',
      '....##BBBB##....',
      '..##BBBBBBBB##..',
      '.#BBBBBBBBBBBB#.',
      '.#BBBB####BBBB#.',
      '.#BBB#AAAA#BBB#.',
      '.#BB#AA##AA#BB#.',
      '.#B#AAA##AAA#B#.',
      '.#B#AAA##AAA#B#.',
      '..#BB#AAAA#BB#..',
      '..#BBB#AA#BBB#..',
      '...#BBB##BBB#...',
      '....#BBBBBB#....',
      '.....#BBBB#.....',
      '......####......',
      '................',
    ],
  },
  block: {
    geometryId: 'lock-barricade',
    grid: [
      '................',
      '.....######.....',
      '....#AAAAAA#....',
      '...#AA####AA#...',
      '...#AA#..#AA#...',
      '...#AA#..#AA#...',
      '..############..',
      '.#BBBBBBBBBBBB#.',
      '.#BBBB####BBBB#.',
      '.#BBB#AAAA#BBB#.',
      '.#BBB#AAAA#BBB#.',
      '.#BBBB#AA#BBBB#.',
      '.#BBBB#AA#BBBB#.',
      '.#BBBBBBBBBBBB#.',
      '..############..',
      '................',
    ],
  },
  retreat: {
    geometryId: 'stepped-retreat',
    grid: [
      '................',
      '..###...........',
      '..#A#...###.....',
      '..#A#..#BB#.....',
      '..#A#.#BBB#.....',
      '..#A##BBBB#####.',
      '..#A#BBBBBBBBBB#',
      '..#A#BBBBAAAABB#',
      '..#A#BBBBAAAABB#',
      '..#A#BBBBBBBBBB#',
      '..#A##BBBB#####.',
      '..#A#.#BBB#.....',
      '..#A#..#BB#.....',
      '..#A#...###.....',
      '..###...........',
      '................',
    ],
  },
  revelation_temporaire: {
    geometryId: 'timed-eye',
    grid: [
      '..........#####.',
      '..........#AAA#.',
      '...........#A#..',
      '..........#AAA#.',
      '....######.####.',
      '..##BBBBBB##....',
      '.#BBB####BBB#...',
      '#BBB#SSSS#BBB#..',
      '#BBB#SAAAS#BBB#.',
      '#BBB#SAAAS#BBB#.',
      '.#BBB####BBB#...',
      '..##BBBBBB##....',
      '....######......',
      '................',
      '................',
      '................',
    ],
  },
  revelation_permanente: {
    geometryId: 'permanent-lens-eye',
    grid: [
      '.......##.......',
      '.......##.......',
      '....########....',
      '..##AAAAAAAA##..',
      '.#AA########AA#.',
      '.#A#BBBBBBBB#A#.',
      '#AA#BB####BB#AA#',
      '###BBA#AA#ABB###',
      '###BBA#AA#ABB###',
      '#AA#BB####BB#AA#',
      '.#A#BBBBBBBB#A#.',
      '.#AA########AA#.',
      '..##AAAAAAAA##..',
      '....########....',
      '.......##.......',
      '.......##.......',
    ],
  },
  resurrection: {
    geometryId: 'ascending-rebirth',
    grid: [
      '.......##.......',
      '......#BB#......',
      '.....#BAAB#.....',
      '....#BBAAABB#...',
      '...#BB#AA#BBB#..',
      '..#BB#AAAA#BBB#.',
      '.#BBB#AAAA#BBBB#',
      '..###.#AA#.####.',
      '......#AA#......',
      '.....#BBBB#.....',
      '....########....',
      '...##########...',
      '..#SSSSSSSSSS#..',
      '.#SSSSSSSSSSSS#.',
      '.##############.',
      '................',
    ],
  },
  brouillard: {
    geometryId: 'obscuring-mist',
    grid: [
      '................',
      '.....######.....',
      '....#SSSSSS#....',
      '...#SSSSSSSS#...',
      '..############..',
      '.#BBBBBBBBBBBB#.',
      '.#BBBBBBBBBBBB#.',
      '..############..',
      '...##########...',
      '..#AAAAAAAAAA#..',
      '..#AAAAAAAAAA#..',
      '.##############.',
      '#BBBBBBBBBBBBBB#',
      '#BBBBBBBBBBBBBB#',
      '.##############.',
      '................',
    ],
  },
  espionnage: {
    geometryId: 'twin-radar-spy',
    grid: [
      '................',
      '......####......',
      '.....#AAAA#.....',
      '......#AA#......',
      '...##..##..##...',
      '..#AA#.##.#AA#..',
      '.#A##..##..##A#.',
      '#BB#...##...#BB#',
      '#BB#.#.##.#.#BB#',
      '#BB#..####..#BB#',
      '.#A##..##..##A#.',
      '..#AA#.##.#AA#..',
      '...##..##..##...',
      '......####......',
      '.....#BBBB#.....',
      '................',
    ],
  },
  teleportation: {
    geometryId: 'warp-portal-arc',
    grid: [
      '................',
      '.........#####..',
      '.....##.#AAAAA#.',
      '...##AA##A###A#.',
      '..#AA##.#AAAAA#.',
      '.#AA#....#####..',
      '.#A#.....#BBB#..',
      '..##......###...',
      '................',
      '..#####.........',
      '.#SSSSS#........',
      '#SS###SS#.......',
      '#SS###SS#.......',
      '.#SSSSS#........',
      '..#####.........',
      '................',
    ],
  },
  protection: {
    geometryId: 'hex-buckler',
    grid: [
      '......####......',
      '....##BBBB##....',
      '..##BBBBBBBB##..',
      '.#BBBB####BBBB#.',
      '.#BB##AAAA##BB#.',
      '.#B#AASSSSAA#B#.',
      '.#B#ASS##SSA#B#.',
      '.#B#ASS##SSA#B#.',
      '.#B#ASS##SSA#B#.',
      '.#B#AASSSSAA#B#.',
      '.#BB##AAAA##BB#.',
      '.#BBBB####BBBB#.',
      '..##BBBBBBBB##..',
      '....##BBBB##....',
      '......####......',
      '................',
    ],
  },
  recrutement: {
    geometryId: 'rally-horn',
    grid: [
      '................',
      '......##....##..',
      '.....#BB#..#AA#.',
      '....#BBB#.#AAAA#',
      '..##BBBB#..#AA#.',
      '.#BBBBBB#.......',
      '#BBBBBBB#...##..',
      '#BBBBBBB#..#AA#.',
      '#BBBBBBB#.#AAAA#',
      '.#BBBBBB#.#AAAA#',
      '..##BBBB#.#AAAA#',
      '....#BBB#.######',
      '.....#BB#.......',
      '......##........',
      '................',
      '................',
    ],
  },
  double_action: {
    geometryId: 'twin-impulse',
    grid: [
      '................',
      '................',
      '.###....###.....',
      '.#AA#...#BB#....',
      '..#AA#...#BB#...',
      '...#AA#...#BB#..',
      '....#AA#...#BB#.',
      '.....#AA#...#BB#',
      '.....#AA#...#BB#',
      '....#AA#...#BB#.',
      '...#AA#...#BB#..',
      '..#AA#...#BB#...',
      '.#AA#...#BB#....',
      '.###....###.....',
      '................',
      '................',
    ],
  },
  piege: {
    geometryId: 'hidden-snare-jaw',
    grid: [
      '................',
      '..##...##...##..',
      '.#BB#.#BB#.#BB#.',
      '.#BBB#BBBB#BBB#.',
      '.#BBBBBBBBBBBB#.',
      '..############..',
      '.....######.....',
      '....#AAAAAA#....',
      '....#AAAAAA#....',
      '.....######.....',
      '..############..',
      '.#BBBBBBBBBBBB#.',
      '.#BBB#BBBB#BBB#.',
      '.#BB#.#BB#.#BB#.',
      '..##...##...##..',
      '................',
    ],
  },
  contre_espionnage: {
    geometryId: 'stealth-visor-shield',
    grid: [
      '......####......',
      '....##BBBB##....',
      '..##BBBBBBBB##..',
      '.#BBBBBBBBAA##..',
      '.#BBBB####AA#B#.',
      '.#BB##SSSSAA##B#',
      '.#B#SSSSSAA#S#B#',
      '.#B#SSSSAA#SS#B#',
      '.#BB##SAA###BB#.',
      '.#BBB#AA##BBBB#.',
      '..#BBAA#BBBBB#..',
      '...#AA#BBBBB#...',
      '....##BBBBBB#...',
      '.....#BBBB#.....',
      '......####......',
      '................',
    ],
  },
  sacrifice: {
    geometryId: 'soldier-exchange-flame',
    grid: [
      '................',
      '........#######.',
      '....##..#BBBBB#.',
      '...#AA#.#B###B#.',
      '..#AA#..#BAAAB#.',
      '..#A#...#BAAAB#.',
      '........#B###B#.',
      '...##...#BBBBB#.',
      '..#SS#..#######.',
      '.#SSSS#.........',
      '.#SSSS#.........',
      '#SSSSSS#........',
      '#SSSSSS#........',
      '########........',
      '................',
      '................',
    ],
  },
};

/**
 * Classic minimalist geometric vector illustrations for all 16 official BLIND WAR cards.
 * Rendered on a 100% transparent 64x64 viewBox (no baked opaque frame or background).
 */
export function renderClassicCardSilhouette(
  card: CardType,
  p: CardArtworkPalette,
  ctx: CardSilhouetteStyleContext,
): React.ReactNode {
  const { bodyGradId, outlineWidth } = ctx;
  const fillBody = `url(#${bodyGradId})`;
  const sw = Math.max(2.15, outlineWidth);
  const innerSw = Number(Math.max(1.75, outlineWidth * 0.86).toFixed(2));
  const stroke = p.stroke;
  const accent = p.accent;
  const secondary = p.secondary;

  switch (card) {
    case 'kamikaze':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-card-geometry="radial-detonation">
          <polygon
            points="32,6 38,18 51,12 45,25 58,32 45,39 51,52 38,46 32,58 26,46 13,52 19,39 6,32 19,25 13,12 26,18"
            fill={fillBody}
            stroke={stroke}
            strokeWidth={sw}
          />
          <circle cx="32" cy="32" r="9.5" fill={secondary} stroke={stroke} strokeWidth={innerSw} />
          <polygon points="32,24.5 38.5,32 32,39.5 25.5,32" fill={accent} />
        </g>
      );

    case 'invincibilite':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-card-geometry="diamond-aegis">
          <path
            d="M32 7 L54 15 V33 C54 45 43.5 53.5 32 58 C20.5 53.5 10 45 10 33 V15 Z"
            fill={fillBody}
            stroke={stroke}
            strokeWidth={sw}
          />
          <polygon
            points="32,16 44,30 32,48 20,30"
            fill={accent}
            stroke={stroke}
            strokeWidth={innerSw}
          />
          <path d="M25 30 H39 M32 23 V37" stroke={stroke} strokeWidth={innerSw + 0.5} />
        </g>
      );

    case 'block':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-card-geometry="lock-barricade">
          <path
            d="M21 27 V18 C21 11 43 11 43 18 V27"
            fill="none"
            stroke={stroke}
            strokeWidth={sw + 2.4}
          />
          <path
            d="M21 27 V18 C21 11 43 11 43 18 V27"
            fill="none"
            stroke={accent}
            strokeWidth={innerSw + 0.4}
          />
          <rect
            x="13"
            y="26"
            width="38"
            height="30"
            rx="6"
            fill={fillBody}
            stroke={stroke}
            strokeWidth={sw}
          />
          <circle cx="32" cy="38" r="4.3" fill={accent} stroke={stroke} strokeWidth={1.5} />
          <path d="M32 42.5 V49" stroke={accent} strokeWidth={innerSw + 0.8} />
        </g>
      );

    case 'retreat':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-card-geometry="stepped-retreat">
          <path d="M12 14 V50" stroke={accent} strokeWidth={sw + 1.4} />
          <path
            d="M54 38 H34 V49 L17 32 L34 15 V26 H54 Z"
            fill={fillBody}
            stroke={stroke}
            strokeWidth={sw}
          />
          <rect x="40" y="29" width="8" height="6" rx="1.5" fill={accent} />
        </g>
      );

    case 'revelation_temporaire':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-card-geometry="timed-eye">
          <path
            d="M7 35 C15 21 49 21 57 35 C49 49 15 49 7 35 Z"
            fill={fillBody}
            stroke={stroke}
            strokeWidth={sw}
          />
          <circle cx="32" cy="35" r="9" fill={secondary} stroke={stroke} strokeWidth={innerSw} />
          <circle cx="32" cy="35" r="4.2" fill={accent} />
          <path
            d="M42 9 H56 L49 17 L56 25 H42 L49 17 Z"
            fill={accent}
            stroke={stroke}
            strokeWidth={1.7}
          />
        </g>
      );

    case 'revelation_permanente':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-card-geometry="permanent-lens-eye">
          <circle cx="32" cy="32" r="24" fill="none" stroke={accent} strokeWidth={sw} />
          <path
            d="M11 32 C18 20 46 20 53 32 C46 44 18 44 11 32 Z"
            fill={fillBody}
            stroke={stroke}
            strokeWidth={sw}
          />
          <polygon points="32,23 39,32 32,41 25,32" fill={accent} stroke={stroke} strokeWidth={1.6} />
          <path d="M32 6 V14 M32 50 V58 M6 32 H13 M51 32 H58" stroke={stroke} strokeWidth={sw} />
        </g>
      );

    case 'resurrection':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-card-geometry="ascending-rebirth">
          <path
            d="M16 55 H48 L43 46 H21 Z"
            fill={secondary}
            stroke={stroke}
            strokeWidth={sw}
          />
          <path
            d="M32 8 L45 27 L38 27 L52 42 L32 36 L12 42 L26 27 L19 27 Z"
            fill={fillBody}
            stroke={stroke}
            strokeWidth={sw}
          />
          <polygon points="32,16 37,26 32,33 27,26" fill={accent} />
        </g>
      );

    case 'brouillard':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-card-geometry="obscuring-mist">
          <path
            d="M20 26 C20 15 44 15 44 26 Z"
            fill={secondary}
            stroke={stroke}
            strokeWidth={sw}
          />
          <rect x="8" y="25" width="48" height="8" rx="4" fill={fillBody} stroke={stroke} strokeWidth={sw} />
          <rect x="12" y="37" width="40" height="8" rx="4" fill={accent} stroke={stroke} strokeWidth={innerSw} />
          <rect x="7" y="49" width="50" height="8" rx="4" fill={fillBody} stroke={stroke} strokeWidth={sw} />
        </g>
      );

    case 'espionnage':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-card-geometry="twin-radar-spy">
          <path d="M32 14 V52" stroke={stroke} strokeWidth={sw + 0.5} />
          <circle cx="32" cy="14" r="4.5" fill={accent} stroke={stroke} strokeWidth={1.6} />
          <path d="M22 22 C15 28 15 40 22 46" fill="none" stroke={accent} strokeWidth={sw} />
          <path d="M42 22 C49 28 49 40 42 46" fill="none" stroke={accent} strokeWidth={sw} />
          <polygon points="14,25 22,34 14,43 7,34" fill={fillBody} stroke={stroke} strokeWidth={sw} />
          <polygon points="50,25 57,34 50,43 42,34" fill={fillBody} stroke={stroke} strokeWidth={sw} />
        </g>
      );

    case 'teleportation':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-card-geometry="warp-portal-arc">
          <polygon
            points="15,35 23,44 15,53 7,44"
            fill={secondary}
            stroke={stroke}
            strokeWidth={sw}
          />
          <polygon
            points="49,13 57,22 49,31 41,22"
            fill={accent}
            stroke={stroke}
            strokeWidth={sw}
          />
          <path
            d="M15 35 C17 17 33 13 42 19"
            fill="none"
            stroke={stroke}
            strokeWidth={sw + 1.4}
            strokeDasharray="4 4"
          />
          <path
            d="M15 35 C17 17 33 13 42 19"
            fill="none"
            stroke={accent}
            strokeWidth={innerSw}
            strokeDasharray="4 4"
          />
          <polygon points="48,22 39,14 40,26" fill={fillBody} stroke={stroke} strokeWidth={1.6} />
        </g>
      );

    case 'protection':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-card-geometry="hex-buckler">
          <polygon
            points="32,7 53,19 53,45 32,57 11,45 11,19"
            fill={fillBody}
            stroke={stroke}
            strokeWidth={sw}
          />
          <polygon
            points="32,16 44,23 44,41 32,48 20,41 20,23"
            fill={secondary}
            stroke={accent}
            strokeWidth={innerSw + 0.4}
          />
          <path d="M32 16 V48" stroke={accent} strokeWidth={innerSw} />
        </g>
      );

    case 'recrutement':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-card-geometry="rally-horn">
          <path
            d="M9 36 L26 28 L35 16 V48 L26 36 L9 36 Z"
            fill={fillBody}
            stroke={stroke}
            strokeWidth={sw}
          />
          <path d="M40 23 C45 27 45 37 40 41" fill="none" stroke={accent} strokeWidth={sw} />
          <polygon
            points="51,17 58,47 44,47"
            fill={accent}
            stroke={stroke}
            strokeWidth={sw}
          />
        </g>
      );

    case 'double_action':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-card-geometry="twin-impulse">
          <polygon
            points="8,13 28,32 8,51 17,51 37,32 17,13"
            fill={accent}
            stroke={stroke}
            strokeWidth={sw}
          />
          <polygon
            points="27,13 47,32 27,51 36,51 56,32 36,13"
            fill={fillBody}
            stroke={stroke}
            strokeWidth={sw}
          />
        </g>
      );

    case 'piege':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-card-geometry="hidden-snare-jaw">
          <path
            d="M8 18 L18 10 L26 22 L32 12 L38 22 L46 10 L56 18 L52 30 H12 Z"
            fill={fillBody}
            stroke={stroke}
            strokeWidth={sw}
          />
          <path
            d="M8 46 L18 54 L26 42 L32 52 L38 42 L46 54 L56 46 L52 34 H12 Z"
            fill={fillBody}
            stroke={stroke}
            strokeWidth={sw}
          />
          <polygon points="32,26 38,32 32,38 26,32" fill={accent} stroke={stroke} strokeWidth={1.6} />
        </g>
      );

    case 'contre_espionnage':
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-card-geometry="stealth-visor-shield">
          <path
            d="M32 8 L53 16 V33 C53 45 43 53 32 57 C21 53 11 45 11 33 V16 Z"
            fill={fillBody}
            stroke={stroke}
            strokeWidth={sw}
          />
          <path
            d="M19 32 C24 25 40 25 45 32 C40 39 24 39 19 32 Z"
            fill={secondary}
            stroke={stroke}
            strokeWidth={innerSw}
          />
          <path d="M16 46 L48 18" stroke={stroke} strokeWidth={sw + 2.2} />
          <path d="M16 46 L48 18" stroke={accent} strokeWidth={innerSw + 0.5} />
        </g>
      );

    case 'sacrifice':
    default:
      return (
        <g strokeLinejoin="round" strokeLinecap="round" data-card-geometry="soldier-exchange-flame">
          <polygon
            points="21,28 35,55 7,55"
            fill={secondary}
            stroke={stroke}
            strokeWidth={sw}
          />
          <path
            d="M19 22 C21 12 31 10 38 14"
            fill="none"
            stroke={accent}
            strokeWidth={sw}
          />
          <polygon points="41,16 33,10 35,19" fill={accent} stroke={stroke} strokeWidth={1.3} />
          <rect
            x="37"
            y="10"
            width="19"
            height="27"
            rx="3.5"
            fill={fillBody}
            stroke={stroke}
            strokeWidth={sw}
          />
          <polygon points="46.5,17 51,23.5 46.5,30 42,23.5" fill={accent} />
        </g>
      );
  }
}

/**
 * Renders an authentic 16×16 Pixel Art sprite for each of the 16 official BLIND WAR cards
 * on a 100% transparent 64×64 viewBox (1 pixel = 4×4 units) with `shapeRendering="crispEdges"`.
 */
export function renderPixelCardSilhouette(
  card: CardType,
  p: CardArtworkPalette,
  ctx: CardSilhouetteStyleContext,
): React.ReactNode {
  const { bodyGradId } = ctx;
  const fillBody = `url(#${bodyGradId})`;
  const spec = PIXEL_CARD_SPRITES[card] ?? PIXEL_CARD_SPRITES.sacrifice;

  const resolvePixelFill = (ch: string): string | null => {
    switch (ch) {
      case '#':
        return p.stroke;
      case 'B':
        return fillBody;
      case 'A':
        return p.accent;
      case 'S':
        return p.secondary;
      default:
        return null;
    }
  };

  const rects: React.ReactNode[] = [];
  for (let row = 0; row < 16; row += 1) {
    const line = spec.grid[row] ?? '';
    let col = 0;
    while (col < 16) {
      const ch = line[col] ?? '.';
      const fill = resolvePixelFill(ch);
      if (!fill) {
        col += 1;
        continue;
      }
      let run = 1;
      while (col + run < 16 && line[col + run] === ch) {
        run += 1;
      }
      rects.push(
        <rect
          key={`${row}-${col}`}
          x={col * 4}
          y={row * 4}
          width={run * 4}
          height={4}
          fill={fill}
          shapeRendering="crispEdges"
        />,
      );
      col += run;
    }
  }

  return (
    <g
      shapeRendering="crispEdges"
      data-card-geometry={spec.geometryId}
      data-pixel-grid="16x16"
    >
      {rects}
    </g>
  );
}

/**
 * Renders the card illustration matching the active visual style:
 * - `'classic'` (default): smooth geometric vector card silhouette
 * - `'pixel_art'`: 16×16 crisp 8-bit pixel art sprite
 */
export function renderCardSilhouette(
  card: CardType,
  p: CardArtworkPalette,
  ctx: CardSilhouetteStyleContext,
): React.ReactNode {
  if (ctx.visualStyle === 'pixel_art') {
    return renderPixelCardSilhouette(card, p, ctx);
  }
  return renderClassicCardSilhouette(card, p, ctx);
}
