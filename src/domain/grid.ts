import type { CellRef, GridSettings } from './types';

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

export const isCellInGrid = ({ row, column }: CellRef, settings: GridSettings): boolean =>
  row >= 0 && row < settings.rows && column >= 0 && column < settings.columns;

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

export const areCellSetsEqual = (first: Set<string>, second: Set<string>): boolean => {
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
