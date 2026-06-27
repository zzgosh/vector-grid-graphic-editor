import { describe, expect, it } from 'vitest';
import { DEFAULT_GRID_SETTINGS } from '../domain/grid';
import {
  findCellAtPoint,
  getCellPolygon,
  getCellsAlongSegment,
  getGridBounds,
  getSignedSlantOffset,
  pointInPolygon,
} from './parallelogram';

describe('parallelogram geometry', () => {
  it('builds a default 16 x 16 bounded grid', () => {
    const bounds = getGridBounds(DEFAULT_GRID_SETTINGS);

    expect(bounds.width).toBeGreaterThan(600);
    expect(bounds.height).toBeGreaterThan(700);
    expect(bounds.minX).toBeLessThan(0);
  });

  it('supports forward and backward vertical-edge slants', () => {
    const forwardOffset = getSignedSlantOffset({
      ...DEFAULT_GRID_SETTINGS,
      slantMode: 'verticalEdges',
      slantDirection: 'forward',
    });
    const backwardOffset = getSignedSlantOffset({
      ...DEFAULT_GRID_SETTINGS,
      slantMode: 'verticalEdges',
      slantDirection: 'backward',
    });

    expect(forwardOffset).toBeLessThan(0);
    expect(backwardOffset).toBeGreaterThan(0);
    expect(Math.abs(forwardOffset)).toBeCloseTo(Math.abs(backwardOffset), 3);
  });

  it('supports horizontal-edge slants', () => {
    const polygon = getCellPolygon(
      { ...DEFAULT_GRID_SETTINGS, slantMode: 'horizontalEdges', slantDirection: 'backward' },
      { row: 0, column: 0 },
    );

    expect(polygon[1].y).toBeGreaterThan(polygon[0].y);
    expect(polygon[2].y).toBeGreaterThan(polygon[3].y);
  });

  it('finds the cell under a point and treats polygon edges as inside', () => {
    const polygon = getCellPolygon(DEFAULT_GRID_SETTINGS, { row: 2, column: 3 });
    const center = {
      x: polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length,
      y: polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length,
    };

    expect(pointInPolygon(polygon[0], polygon)).toBe(true);
    expect(findCellAtPoint(DEFAULT_GRID_SETTINGS, center)).toEqual({ row: 2, column: 3 });
  });

  it('finds cells under extreme slant settings without scanning the whole grid', () => {
    const settings = {
      ...DEFAULT_GRID_SETTINGS,
      rows: 24,
      columns: 24,
      cellWidth: 16,
      cellHeight: 160,
      slantAngle: 55,
      gapXEnabled: false,
      gapYEnabled: false,
      gapX: 0,
      gapY: 0,
    };
    const polygon = getCellPolygon(settings, { row: 5, column: 20 });
    const bottomEdgeCenter = {
      x: (polygon[2].x + polygon[3].x) / 2,
      y: (polygon[2].y + polygon[3].y) / 2,
    };

    expect(findCellAtPoint(settings, bottomEdgeCenter)).toEqual({ row: 5, column: 20 });
  });

  it('samples every crossed cell during a fast drag segment', () => {
    const startPolygon = getCellPolygon(DEFAULT_GRID_SETTINGS, { row: 4, column: 2 });
    const endPolygon = getCellPolygon(DEFAULT_GRID_SETTINGS, { row: 4, column: 8 });
    const center = (polygon: typeof startPolygon) => ({
      x: polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length,
      y: polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length,
    });

    const cells = getCellsAlongSegment(DEFAULT_GRID_SETTINGS, center(startPolygon), center(endPolygon));

    expect(cells.map((cell) => cell.column)).toContain(2);
    expect(cells.map((cell) => cell.column)).toContain(8);
    expect(cells.length).toBeGreaterThan(4);
  });
});
