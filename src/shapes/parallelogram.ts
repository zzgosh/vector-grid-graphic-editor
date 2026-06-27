import { gapKey, isGapInGrid } from '../domain/grid';
import type { Bounds, CellRef, GapRef, GridSettings, Point, ShapeDefinition } from '../domain/types';

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const parallelogramShape: ShapeDefinition = {
  id: 'parallelogram',
  label: 'Parallelogram',
  description: 'A configurable slanted-grid unit for logo construction.',
  controls: [
    { kind: 'number', key: 'cellWidth', label: 'Cell width', min: 16, max: 160, step: 1, unit: 'px' },
    { kind: 'number', key: 'cellHeight', label: 'Cell height', min: 16, max: 160, step: 1, unit: 'px' },
    {
      kind: 'segmented',
      key: 'slantMode',
      label: 'Slant edges',
      options: [
        { label: 'Left / right', value: 'verticalEdges' },
        { label: 'Top / bottom', value: 'horizontalEdges' },
      ],
    },
    {
      kind: 'segmented',
      key: 'slantDirection',
      label: 'Direction',
      options: [
        { label: 'Forward', value: 'forward' },
        { label: 'Backward', value: 'backward' },
      ],
    },
    { kind: 'number', key: 'slantAngle', label: 'Angle', min: 0, max: 55, step: 1, unit: 'deg' },
    { kind: 'toggle', key: 'gapXEnabled', label: 'Horizontal gap' },
    { kind: 'number', key: 'gapX', label: 'Gap X', min: 0, max: 48, step: 1, unit: 'px' },
    { kind: 'toggle', key: 'gapYEnabled', label: 'Vertical gap' },
    { kind: 'number', key: 'gapY', label: 'Gap Y', min: 0, max: 48, step: 1, unit: 'px' },
  ],
};

export const getActiveGapX = (settings: GridSettings): number =>
  settings.gapXEnabled ? settings.gapX : 0;

export const getActiveGapY = (settings: GridSettings): number =>
  settings.gapYEnabled ? settings.gapY : 0;

export const getSlantOffset = (settings: GridSettings): number => {
  const adjacent = settings.slantMode === 'verticalEdges' ? settings.cellHeight : settings.cellWidth;
  return Math.tan(toRadians(settings.slantAngle)) * adjacent;
};

export const getSignedSlantOffset = (settings: GridSettings): number => {
  const offset = getSlantOffset(settings);
  return settings.slantDirection === 'forward' ? -offset : offset;
};

export const getCellOrigin = (settings: GridSettings, { row, column }: CellRef): Point => {
  const skew = getSignedSlantOffset(settings);
  const gapX = getActiveGapX(settings);
  const gapY = getActiveGapY(settings);

  if (settings.slantMode === 'verticalEdges') {
    return {
      x: column * (settings.cellWidth + gapX) + row * skew,
      y: row * (settings.cellHeight + gapY),
    };
  }

  return {
    x: column * (settings.cellWidth + gapX),
    y: column * skew + row * (settings.cellHeight + gapY),
  };
};

export const getCellPolygon = (settings: GridSettings, cell: CellRef): Point[] => {
  const origin = getCellOrigin(settings, cell);
  const skew = getSignedSlantOffset(settings);
  const width = settings.cellWidth;
  const height = settings.cellHeight;

  if (settings.slantMode === 'verticalEdges') {
    return [
      { x: origin.x, y: origin.y },
      { x: origin.x + width, y: origin.y },
      { x: origin.x + width + skew, y: origin.y + height },
      { x: origin.x + skew, y: origin.y + height },
    ];
  }

  return [
    { x: origin.x, y: origin.y },
    { x: origin.x + width, y: origin.y + skew },
    { x: origin.x + width, y: origin.y + height + skew },
    { x: origin.x, y: origin.y + height },
  ];
};

export const getGapPolygon = (settings: GridSettings, gap: GapRef): Point[] | null => {
  if (!isGapInGrid(gap, settings)) {
    return null;
  }

  if (gap.part === 'x') {
    const leftCell = getCellPolygon(settings, { row: gap.row, column: gap.column });
    const rightCell = getCellPolygon(settings, { row: gap.row, column: gap.column + 1 });
    return [leftCell[1], rightCell[0], rightCell[3], leftCell[2]];
  }

  if (gap.part === 'y') {
    const topCell = getCellPolygon(settings, { row: gap.row, column: gap.column });
    const bottomCell = getCellPolygon(settings, { row: gap.row + 1, column: gap.column });
    return [topCell[3], topCell[2], bottomCell[1], bottomCell[0]];
  }

  const topLeftCell = getCellPolygon(settings, { row: gap.row, column: gap.column });
  const topRightCell = getCellPolygon(settings, { row: gap.row, column: gap.column + 1 });
  const bottomRightCell = getCellPolygon(settings, { row: gap.row + 1, column: gap.column + 1 });
  const bottomLeftCell = getCellPolygon(settings, { row: gap.row + 1, column: gap.column });
  return [topLeftCell[2], topRightCell[3], bottomRightCell[0], bottomLeftCell[1]];
};

export const getGridBounds = (settings: GridSettings): Bounds => {
  const points: Point[] = [];

  for (let row = 0; row < settings.rows; row += 1) {
    for (let column = 0; column < settings.columns; column += 1) {
      points.push(...getCellPolygon(settings, { row, column }));
    }
  }

  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

const isPointOnSegment = (point: Point, start: Point, end: Point, epsilon = 0.001): boolean => {
  const cross =
    (point.y - start.y) * (end.x - start.x) - (point.x - start.x) * (end.y - start.y);
  if (Math.abs(cross) > epsilon) {
    return false;
  }

  const dot =
    (point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y);
  if (dot < -epsilon) {
    return false;
  }

  const squaredLength =
    (end.x - start.x) * (end.x - start.x) + (end.y - start.y) * (end.y - start.y);
  return dot <= squaredLength + epsilon;
};

export const pointInPolygon = (point: Point, polygon: Point[]): boolean => {
  for (let index = 0; index < polygon.length; index += 1) {
    const nextIndex = (index + 1) % polygon.length;
    if (isPointOnSegment(point, polygon[index], polygon[nextIndex])) {
      return true;
    }
  }

  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index++) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) +
          current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
};

const getCandidateCellsAtPoint = (settings: GridSettings, point: Point): CellRef[] => {
  const skew = getSignedSlantOffset(settings);
  const gapX = getActiveGapX(settings);
  const gapY = getActiveGapY(settings);
  const strideX = settings.cellWidth + gapX;
  const strideY = settings.cellHeight + gapY;
  const candidates: CellRef[] = [];
  const seen = new Set<string>();

  const pushCandidate = (row: number, column: number) => {
    if (row < 0 || row >= settings.rows || column < 0 || column >= settings.columns) {
      return;
    }
    const key = `${row}:${column}`;
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push({ row, column });
    }
  };

  if (settings.slantMode === 'verticalEdges') {
    const columnRadius = Math.ceil(Math.abs(skew) / strideX) + 1;
    const estimatedRow = Math.floor(point.y / strideY);
    for (let row = estimatedRow - 1; row <= estimatedRow + 1; row += 1) {
      const estimatedColumn = Math.floor((point.x - row * skew) / strideX);
      for (
        let column = estimatedColumn - columnRadius;
        column <= estimatedColumn + columnRadius;
        column += 1
      ) {
        pushCandidate(row, column);
      }
    }
  } else {
    const rowRadius = Math.ceil(Math.abs(skew) / strideY) + 1;
    const estimatedColumn = Math.floor(point.x / strideX);
    for (let column = estimatedColumn - 1; column <= estimatedColumn + 1; column += 1) {
      const estimatedRow = Math.floor((point.y - column * skew) / strideY);
      for (let row = estimatedRow - rowRadius; row <= estimatedRow + rowRadius; row += 1) {
        pushCandidate(row, column);
      }
    }
  }

  return candidates;
};

const getCandidateGapsAtPoint = (settings: GridSettings, point: Point): GapRef[] => {
  const skew = getSignedSlantOffset(settings);
  const gapX = getActiveGapX(settings);
  const gapY = getActiveGapY(settings);
  const strideX = settings.cellWidth + gapX;
  const strideY = settings.cellHeight + gapY;
  const candidates: GapRef[] = [];
  const seen = new Set<string>();

  const pushCandidate = (gap: GapRef) => {
    if (!isGapInGrid(gap, settings)) {
      return;
    }
    const key = gapKey(gap);
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push(gap);
    }
  };

  const pushNeighborhood = (row: number, column: number) => {
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
        const candidateRow = row + rowOffset;
        const candidateColumn = column + columnOffset;
        pushCandidate({ part: 'x', row: candidateRow, column: candidateColumn });
        pushCandidate({ part: 'y', row: candidateRow, column: candidateColumn });
        pushCandidate({ part: 'xy', row: candidateRow, column: candidateColumn });
      }
    }
  };

  if (settings.slantMode === 'verticalEdges') {
    const columnRadius = Math.ceil(Math.abs(skew) / strideX) + 1;
    const estimatedRow = Math.floor(point.y / strideY);
    for (let row = estimatedRow - 1; row <= estimatedRow + 1; row += 1) {
      const estimatedColumn = Math.floor((point.x - row * skew) / strideX);
      for (
        let column = estimatedColumn - columnRadius;
        column <= estimatedColumn + columnRadius;
        column += 1
      ) {
        pushNeighborhood(row, column);
      }
    }
  } else {
    const rowRadius = Math.ceil(Math.abs(skew) / strideY) + 1;
    const estimatedColumn = Math.floor(point.x / strideX);
    for (let column = estimatedColumn - 1; column <= estimatedColumn + 1; column += 1) {
      const estimatedRow = Math.floor((point.y - column * skew) / strideY);
      for (let row = estimatedRow - rowRadius; row <= estimatedRow + rowRadius; row += 1) {
        pushNeighborhood(row, column);
      }
    }
  }

  return candidates;
};

export const findCellAtPoint = (settings: GridSettings, point: Point): CellRef | null => {
  for (const cell of getCandidateCellsAtPoint(settings, point)) {
    if (pointInPolygon(point, getCellPolygon(settings, cell))) {
      return cell;
    }
  }

  return null;
};

export const findGapAtPoint = (settings: GridSettings, point: Point): GapRef | null => {
  for (const gap of getCandidateGapsAtPoint(settings, point)) {
    const polygon = getGapPolygon(settings, gap);
    if (polygon && pointInPolygon(point, polygon)) {
      return gap;
    }
  }

  return null;
};

export const getCellsAlongSegment = (
  settings: GridSettings,
  start: Point,
  end: Point,
): CellRef[] => {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const sampleStep = Math.max(4, Math.min(settings.cellWidth, settings.cellHeight) / 4);
  const steps = Math.max(1, Math.ceil(distance / sampleStep));
  const seen = new Set<string>();
  const cells: CellRef[] = [];

  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const point = {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
    };
    const cell = findCellAtPoint(settings, point);
    if (!cell) {
      continue;
    }
    const key = `${cell.row}:${cell.column}`;
    if (!seen.has(key)) {
      seen.add(key);
      cells.push(cell);
    }
  }

  return cells;
};

export const getGapsAlongSegment = (
  settings: GridSettings,
  start: Point,
  end: Point,
): GapRef[] => {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const sampleStep = Math.max(4, Math.min(settings.cellWidth, settings.cellHeight) / 4);
  const steps = Math.max(1, Math.ceil(distance / sampleStep));
  const seen = new Set<string>();
  const gaps: GapRef[] = [];

  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const point = {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
    };
    const gap = findGapAtPoint(settings, point);
    if (!gap) {
      continue;
    }
    const key = gapKey(gap);
    if (!seen.has(key)) {
      seen.add(key);
      gaps.push(gap);
    }
  }

  return gaps;
};
