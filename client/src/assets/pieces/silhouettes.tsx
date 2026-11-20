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

interface PixelPieceSpriteSpec {
  readonly geometryId: string;
  /** 16 rows of 16 characters: '.' transparent, '#' outline, 'B' body gradient, 'A' accent, 'H' highlight */
  readonly grid: readonly string[];
}

const PIXEL_PIECE_SPRITES: Readonly<Record<PieceArtKind, PixelPieceSpriteSpec>> = {
  roi: {
    geometryId: 'royal-crown-cross',
    grid: [
      '.......##.......',
      '......#AA#......',
      '.....#AAAA#.....',
      '......#AA#......',
      '.##...#BB#...##.',
      '#AA#.#BBBB#.#AA#',
      '#BB##BBBBBB##BB#',
      '#BBBBBBBBBBBBBB#',
      '.#BB#ABBBBA#BB#.',
      '.#BBBBBBBBBBBB#.',
      '.#BHHHHHHHHHHB#.',
      '..#AAAAAAAAAA#..',
      '..#BBBBBBBBBB#..',
      '.#HHHHHHHHHHHH#.',
      '.##############.',
      '................',
    ],
  },
  reine: {
    geometryId: 'radiant-tiara',
    grid: [
      '....##....##....',
      '.##.#A#..#A#.##.',
      '#AA#.#B##B#.#AA#',
      '#BB#.#BBBB#.#BB#',
      '.#BB##BBBB##BB#.',
      '.#BBBBBBBBBBBB#.',
      '..#BBBBAAABBB#..',
      '..#BBBAHHABBB#..',
      '..#BBBBAAABBB#..',
      '...#BBBBBBBB#...',
      '...#HHHHHHHH#...',
      '..#AAAAAAAAAA#..',
      '..#BBBBBBBBBB#..',
      '.#HHHHHHHHHHHH#.',
      '.##############.',
      '................',
    ],
  },
  colosse: {
    geometryId: 'heavy-fortress',
    grid: [
      '................',
      '.####.####.####.',
      '.#BB#.#BB#.#BB#.',
      '.#BB###BB###BB#.',
      '.#BBBBBBBBBBBB#.',
      '##HHHHHHHHHHHH##',
      '#BBBBBBBBBBBBBB#',
      '#BB##########BB#',
      '#BB#AAAAAAAA#BB#',
      '#BB#AA####AA#BB#',
      '#BB#AA#BB#AA#BB#',
      '#BB#AA#BB#AA#BB#',
      '#BBBBBBBBBBBBBB#',
      '#HHHHHHHHHHHHHH#',
      '################',
      '................',
    ],
  },
  cavalier: {
    geometryId: 'angular-horse',
    grid: [
      '......###.##....',
      '.....#BBB#AA#...',
      '....#BBBB#AA#...',
      '...#BB##BBBBAA#.',
      '..#BBBBBBBBBBAA#',
      '.#BBBBBBBBBBBAA#',
      '.#BBB###BBBBAAA#',
      '..###..#BBBBAAA#',
      '......#BBBBBBAA#',
      '.....#BBBBBBBAA#',
      '....#BBBBBBBB#..',
      '...#BBBBBBBBBB#.',
      '..#AAAAAAAAAAAA#',
      '.#HHHHHHHHHHHHHH',
      '.###############',
      '................',
    ],
  },
  berserker: {
    geometryId: 'twin-battle-axe',
    grid: [
      '................',
      '..####....####..',
      '.#BBBB#..#BBBB#.',
      '#BBBBB#..#BBBBB#',
      '#BBBB##AA##BBBB#',
      '#BBB##AAAA##BBB#',
      '#BBBB##AA##BBBB#',
      '.#BBBB#BB#BBBB#.',
      '..####AAAA####..',
      '.....#AAAA#.....',
      '....#AA##AA#....',
      '...#AA#..#AA#...',
      '..#AA#....#AA#..',
      '.#AA#......#AA#.',
      '..##........##..',
      '................',
    ],
  },
  assassin: {
    geometryId: 'piercing-dagger',
    grid: [
      '.......##.......',
      '......#HH#......',
      '......#BB#......',
      '.....#BHAB#.....',
      '.....#BHAB#.....',
      '....#BBHABB#....',
      '....#BBHABB#....',
      '....#BBHABB#....',
      '.####BBHABB####.',
      '#AAAAAAAAAAAAAA#',
      '.####BBBBBB####.',
      '......#AA#......',
      '......#AA#......',
      '.....#HHHH#.....',
      '......####......',
      '................',
    ],
  },
  guetteur_h: {
    geometryId: 'orthogonal-eye-plus',
    grid: [
      '.......##.......',
      '......#AA#......',
      '......#AA#......',
      '.....######.....',
      '....#BBBBBB#....',
      '...#BB####BB#...',
      '.##BB#AAAA#BB##.',
      '#AABB#A##A#BBAA#',
      '#AABB#A##A#BBAA#',
      '.##BB#AAAA#BB##.',
      '...#BB####BB#...',
      '....#BBBBBB#....',
      '.....######.....',
      '......#AA#......',
      '......#AA#......',
      '.......##.......',
    ],
  },
  guetteur_d: {
    geometryId: 'diagonal-prism-cross',
    grid: [
      '................',
      '.###........###.',
      '.#AA#..##..#AA#.',
      '..#AA##BB##AA#..',
      '...#BBBBBBBB#...',
      '...#BB####BB#...',
      '..#BB#AAAA#BB#..',
      '..#BB#A##A#BB#..',
      '..#BB#A##A#BB#..',
      '..#BB#AAAA#BB#..',
      '...#BB####BB#...',
      '...#BBBBBBBB#...',
      '..#AA##BB##AA#..',
      '.#AA#..##..#AA#.',
      '.###........###.',
      '................',
    ],
  },
  traqueur: {
    geometryId: 'hunter-reticle-arrow',
    grid: [
      '.......##.......',
      '......#AA#......',
      '.....#AAAA#.....',
      '....########....',
      '...#BBBBBBBB#...',
      '..#BB######BB#..',
      '.#BB#..##..#BB#.',
      '.#BB#.####.#BB#.',
      '.#BB###AA###BB#.',
      '.#BB###AA###BB#.',
      '.#BB#.####.#BB#.',
      '.#BB#..##..#BB#.',
      '..#BB######BB#..',
      '...#BBBBBBBB#...',
      '....########....',
      '................',
    ],
  },
  executeur: {
    geometryId: 'asymmetric-halberd',
    grid: [
      '.....##.........',
      '....#AA#........',
      '...#AAAA#.......',
      '....#BB#####....',
      '..###BB#BBBB##..',
      '.#AA#BB#BBBBBB#.',
      '#AAA#BB#BBBBHHH#',
      '.#AA#BB#BBBBHHH#',
      '..###BB#BBBBBB#.',
      '....#BB#BBBB##..',
      '....#BB#####....',
      '....#BB#........',
      '....#BB#........',
      '...#AAAA#.......',
      '...######.......',
      '................',
    ],
  },
  arbaletrier: {
    geometryId: 'crossbow-bolt',
    grid: [
      '.......##.......',
      '......#AA#......',
      '.....#AAAA#.....',
      '...###BBBB###...',
      '.##BBBB##BBBB##.',
      '#BBB###AA###BBB#',
      '#BB#..#BB#..#BB#',
      '.##..#AAAA#..##.',
      '....#AA##AA#....',
      '...#AA#BB#AA#...',
      '..#####BB#####..',
      '......#BB#......',
      '......#BB#......',
      '.....#AAAA#.....',
      '.....######.....',
      '................',
    ],
  },
  soldat: {
    geometryId: 'vanguard-shield',
    grid: [
      '................',
      '..############..',
      '.#HHHHHHHHHHHH#.',
      '.#BBBBBBBBBBBB#.',
      '.#BBBB#AA#BBBB#.',
      '.#BBB#AAAA#BBB#.',
      '.#BB#AA##AA#BB#.',
      '.#B#AA#BB#AA#B#.',
      '.#BBBBBBBBBBBB#.',
      '..#BBBBBBBBBB#..',
      '..#BBBBBBBBBB#..',
      '...#BBBBBBBB#...',
      '....#BBBBBB#....',
      '.....#BBBB#.....',
      '......####......',
      '................',
    ],
  },
  secret: {
    geometryId: 'enigma-question-seal',
    grid: [
      '................',
      '....########....',
      '..##HHHHHHHH##..',
      '.#HBBBBBBBBBBH#.',
      '.#BBB######BBB#.',
      '#BBB#AAAAAA#BBB#',
      '#BBB#AA##AA#BBB#',
      '#BBB###..#AA#BB#',
      '#BBBBBB##AA#BBB#',
      '#BBBBBB#AA#BBBB#',
      '#BBBBBB###BBBBB#',
      '.#BBBBB##BBBBB#.',
      '.#BBBB#AA#BBBB#.',
      '..##BBB##BBB##..',
      '....########....',
      '................',
    ],
  },
};

/**
 * Renders an authentic 16×16 Pixel Art sprite on the 64×64 viewBox (1 pixel = 4×4 units)
 * with `shapeRendering="crispEdges"` and 100% transparent background, dynamically colored
 * by the active theme's medallion palette.
 */
export function renderPieceSilhouette(
  kind: PieceArtKind,
  p: PieceMedallionPalette,
  ctx: PieceSilhouetteStyleContext,
): React.ReactNode {
  const { bodyGradId } = ctx;
  const fillBody = `url(#${bodyGradId})`;
  const spec = PIXEL_PIECE_SPRITES[kind] ?? PIXEL_PIECE_SPRITES.secret;

  const resolvePixelFill = (ch: string): string | null => {
    switch (ch) {
      case '#':
        return p.glyphStroke;
      case 'B':
        return fillBody;
      case 'A':
        return p.glyphAccent;
      case 'H':
        return p.rimInner;
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
      data-geometry={spec.geometryId}
      data-pixel-grid="16x16"
    >
      {rects}
    </g>
  );
}
