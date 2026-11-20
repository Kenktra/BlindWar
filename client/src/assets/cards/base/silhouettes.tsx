import React from 'react';
import {
  CARD_TYPES,
  type CardArtworkPalette,
  type CardType,
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
 * Renders an authentic 16×16 Pixel Art sprite for each of the 16 official BLIND WAR cards
 * on a 100% transparent 64×64 viewBox (1 pixel = 4×4 units) with `shapeRendering="crispEdges"`.
 */
export function renderCardSilhouette(
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
