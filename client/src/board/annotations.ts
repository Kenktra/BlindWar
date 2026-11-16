import type {
  AnnotationColor,
  BoardArrowAnnotation,
  BoardSquareMark,
  Coord,
  PersonalBoardAnnotations,
  PlayerColor,
} from '../../../shared/src/types/core.js';

export const EMPTY_PERSONAL_ANNOTATIONS: PersonalBoardAnnotations = {
  arrows: [],
  marks: [],
};

export function createInitialAnnotationsByPlayer(): Record<
  PlayerColor,
  PersonalBoardAnnotations
> {
  return {
    red: EMPTY_PERSONAL_ANNOTATIONS,
    black: EMPTY_PERSONAL_ANNOTATIONS,
  };
}

export function coordsEqual(a: Coord, b: Coord): boolean {
  return a.row === b.row && a.col === b.col;
}

export function makeArrowAnnotationId(from: Coord, to: Coord): string {
  return `arrow-${from.row},${from.col}->${to.row},${to.col}`;
}

/**
 * Adds a tactical arrow between two squares, recolors an existing arrow on the same
 * endpoints if the color changed, or removes it if redrawn with the identical color.
 */
export function toggleOrUpsertArrow(
  current: PersonalBoardAnnotations,
  from: Coord,
  to: Coord,
  color: AnnotationColor,
): PersonalBoardAnnotations {
  if (coordsEqual(from, to)) {
    return toggleOrReplaceSquareMark(current, from, color);
  }

  const arrowId = makeArrowAnnotationId(from, to);
  const existing = current.arrows.find((a) => a.id === arrowId);

  if (!existing) {
    const created: BoardArrowAnnotation = { id: arrowId, from, to, color };
    return {
      ...current,
      arrows: [...current.arrows, created],
    };
  }

  if (existing.color === color) {
    return {
      ...current,
      arrows: current.arrows.filter((a) => a.id !== arrowId),
    };
  }

  return {
    ...current,
    arrows: current.arrows.map((a) => (a.id === arrowId ? { ...a, color } : a)),
  };
}

/**
 * Highlights a single square with the chosen tactical color, replaces its color if a
 * different color is applied, or removes the mark if toggled with the same color.
 */
export function toggleOrReplaceSquareMark(
  current: PersonalBoardAnnotations,
  coord: Coord,
  color: AnnotationColor,
): PersonalBoardAnnotations {
  const existing = current.marks.find((m) => coordsEqual(m.coord, coord));

  if (!existing) {
    const created: BoardSquareMark = { coord, color };
    return {
      ...current,
      marks: [...current.marks, created],
    };
  }

  if (existing.color === color) {
    return {
      ...current,
      marks: current.marks.filter((m) => !coordsEqual(m.coord, coord)),
    };
  }

  return {
    ...current,
    marks: current.marks.map((m) =>
      coordsEqual(m.coord, coord) ? { ...m, color } : m,
    ),
  };
}

/**
 * Deletes one specific tactical arrow by ID.
 */
export function removeArrowById(
  current: PersonalBoardAnnotations,
  arrowId: string,
): PersonalBoardAnnotations {
  const nextArrows = current.arrows.filter((a) => a.id !== arrowId);
  if (nextArrows.length === current.arrows.length) {
    return current;
  }
  return {
    ...current,
    arrows: nextArrows,
  };
}

/**
 * Erases any square mark and arrows starting/ending at the clicked coordinate.
 */
export function eraseAnnotationsAtSquare(
  current: PersonalBoardAnnotations,
  coord: Coord,
): PersonalBoardAnnotations {
  const nextMarks = current.marks.filter((m) => !coordsEqual(m.coord, coord));
  const nextArrows = current.arrows.filter(
    (a) => !coordsEqual(a.from, coord) && !coordsEqual(a.to, coord),
  );
  if (
    nextMarks.length === current.marks.length &&
    nextArrows.length === current.arrows.length
  ) {
    return current;
  }
  return {
    arrows: nextArrows,
    marks: nextMarks,
  };
}

export function clearAllPersonalAnnotations(): PersonalBoardAnnotations {
  return EMPTY_PERSONAL_ANNOTATIONS;
}

export function countPersonalAnnotations(
  annotations: PersonalBoardAnnotations,
): number {
  return annotations.arrows.length + annotations.marks.length;
}
