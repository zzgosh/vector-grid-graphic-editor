import type { Bounds, CellRef, GridSettings, Point, ShapeDefinition } from '../domain/types';

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

export const findCellAtPoint = (settings: GridSettings, point: Point): CellRef | null => {
  for (let row = 0; row < settings.rows; row += 1) {
    for (let column = 0; column < settings.columns; column += 1) {
      const cell = { row, column };
      if (pointInPolygon(point, getCellPolygon(settings, cell))) {
        return cell;
      }
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
