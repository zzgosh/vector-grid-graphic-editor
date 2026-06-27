import type { CellRef, GapPart, GapRef, GridSettings } from './types';

export const DEFAULT_GRID_SETTINGS: GridSettings = {
  rows: 16,
  columns: 16,
  cellWidth: 40,
  cellHeight: 40,
  slantMode: 'verticalEdges',
  slantDirection: 'forward',
  slantAngle: 18,
  gapXEnabled: true,
  gapYEnabled: true,
  gapX: 8,
  gapY: 8,
  fillColor: '#050505',
};

export const cellKey = ({ row, column }: CellRef): string => `${row}:${column}`;

export const parseCellKey = (key: string): CellRef => {
  const [row, column] = key.split(':').map(Number);
  return { row, column };
};

export const gapKey = ({ part, row, column }: GapRef): string => `${part}:${row}:${column}`;

export const parseGapKey = (key: string): GapRef => {
  const [part, row, column] = key.split(':');
  return {
    part: part as GapPart,
    row: Number(row),
    column: Number(column),
  };
};

export const isCellInGrid = ({ row, column }: CellRef, settings: GridSettings): boolean =>
  row >= 0 && row < settings.rows && column >= 0 && column < settings.columns;

export const isGapInGrid = ({ part, row, column }: GapRef, settings: GridSettings): boolean => {
  if (part !== 'x' && part !== 'y' && part !== 'xy') {
    return false;
  }

  if (part === 'x') {
    return (
      settings.gapXEnabled &&
      settings.gapX > 0 &&
      row >= 0 &&
      row < settings.rows &&
      column >= 0 &&
      column < settings.columns - 1
    );
  }

  if (part === 'y') {
    return (
      settings.gapYEnabled &&
      settings.gapY > 0 &&
      row >= 0 &&
      row < settings.rows - 1 &&
      column >= 0 &&
      column < settings.columns
    );
  }

  return (
    settings.gapXEnabled &&
    settings.gapYEnabled &&
    settings.gapX > 0 &&
    settings.gapY > 0 &&
    row >= 0 &&
    row < settings.rows - 1 &&
    column >= 0 &&
    column < settings.columns - 1
  );
};

export const filterCellsForGrid = (cells: Set<string>, settings: GridSettings): Set<string> => {
  const next = new Set<string>();
  cells.forEach((key) => {
    const ref = parseCellKey(key);
    if (isCellInGrid(ref, settings)) {
      next.add(key);
    }
  });
  return next;
};

export const filterGapsForGrid = (gaps: Set<string>, settings: GridSettings): Set<string> => {
  const next = new Set<string>();
  gaps.forEach((key) => {
    const ref = parseGapKey(key);
    if (isGapInGrid(ref, settings)) {
      next.add(key);
    }
  });
  return next;
};

export const areKeySetsEqual = (first: Set<string>, second: Set<string>): boolean => {
  if (first.size !== second.size) {
    return false;
  }
  for (const key of first) {
    if (!second.has(key)) {
      return false;
    }
  }
  return true;
};

export const areCellSetsEqual = areKeySetsEqual;
