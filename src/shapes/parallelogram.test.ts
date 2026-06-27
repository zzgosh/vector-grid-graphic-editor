import { describe, expect, it } from 'vitest';
import { DEFAULT_GRID_SETTINGS } from '../domain/grid';
import {
  findCellAtPoint,
  findGapAtPoint,
  getCellPolygon,
  getCellsAlongSegment,
  getGapPolygon,
  getGapsAlongSegment,
  getGridBounds,
  getSignedSlantOffset,
  pointInPolygon,
} from './parallelogram';

const centerOf = (polygon: Array<{ x: number; y: number }>) => ({
  x: polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length,
  y: polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length,
});

const cross = (
  firstStart: { x: number; y: number },
  firstEnd: { x: number; y: number },
  secondStart: { x: number; y: number },
  secondEnd: { x: number; y: number },
) =>
  (firstEnd.x - firstStart.x) * (secondEnd.y - secondStart.y) -
  (firstEnd.y - firstStart.y) * (secondEnd.x - secondStart.x);

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
    const center = centerOf(polygon);

    expect(pointInPolygon(polygon[0], polygon)).toBe(true);
    expect(findCellAtPoint(DEFAULT_GRID_SETTINGS, center)).toEqual({ row: 2, column: 3 });
  });

  it('builds and finds horizontal, vertical, and intersection gap regions', () => {
    const xGap = { part: 'x' as const, row: 2, column: 3 };
    const yGap = { part: 'y' as const, row: 2, column: 3 };
    const intersectionGap = { part: 'xy' as const, row: 2, column: 3 };

    const xPolygon = getGapPolygon(DEFAULT_GRID_SETTINGS, xGap);
    const yPolygon = getGapPolygon(DEFAULT_GRID_SETTINGS, yGap);
    const intersectionPolygon = getGapPolygon(DEFAULT_GRID_SETTINGS, intersectionGap);

    expect(xPolygon).not.toBeNull();
    expect(yPolygon).not.toBeNull();
    expect(intersectionPolygon).not.toBeNull();
    expect(findGapAtPoint(DEFAULT_GRID_SETTINGS, centerOf(xPolygon!))).toEqual(xGap);
    expect(findGapAtPoint(DEFAULT_GRID_SETTINGS, centerOf(yPolygon!))).toEqual(yGap);
    expect(findGapAtPoint(DEFAULT_GRID_SETTINGS, centerOf(intersectionPolygon!))).toEqual(
      intersectionGap,
    );
  });

  it('finds gap regions when top and bottom edges are slanted', () => {
    const settings = {
      ...DEFAULT_GRID_SETTINGS,
      slantMode: 'horizontalEdges' as const,
      slantDirection: 'backward' as const,
    };
    const gap = { part: 'y' as const, row: 2, column: 3 };
    const polygon = getGapPolygon(settings, gap);

    expect(polygon).not.toBeNull();
    expect(findGapAtPoint(settings, centerOf(polygon!))).toEqual(gap);
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

  it('samples every crossed gap during a fast drag segment', () => {
    const startPolygon = getGapPolygon(DEFAULT_GRID_SETTINGS, { part: 'x', row: 4, column: 2 });
    const endPolygon = getGapPolygon(DEFAULT_GRID_SETTINGS, { part: 'x', row: 4, column: 8 });

    expect(startPolygon).not.toBeNull();
    expect(endPolygon).not.toBeNull();

    const gaps = getGapsAlongSegment(
      DEFAULT_GRID_SETTINGS,
      centerOf(startPolygon!),
      centerOf(endPolygon!),
    );

    expect(gaps.map((gap) => gap.column)).toContain(2);
    expect(gaps.map((gap) => gap.column)).toContain(8);
    expect(gaps.length).toBeGreaterThan(4);
  });

  it('samples narrow slanted gaps and their intersections as a continuous strip', () => {
    const settings = {
      ...DEFAULT_GRID_SETTINGS,
      gapX: 4,
      gapY: 4,
    };
    const startPolygon = getGapPolygon(settings, { part: 'x', row: 2, column: 3 });
    const endPolygon = getGapPolygon(settings, { part: 'x', row: 6, column: 3 });

    expect(startPolygon).not.toBeNull();
    expect(endPolygon).not.toBeNull();

    const gaps = getGapsAlongSegment(settings, centerOf(startPolygon!), centerOf(endPolygon!));

    expect(gaps.some((gap) => gap.part === 'x' && gap.row === 2 && gap.column === 3)).toBe(true);
    expect(gaps.some((gap) => gap.part === 'x' && gap.row === 6 && gap.column === 3)).toBe(true);
    expect(gaps.some((gap) => gap.part === 'xy' && gap.column === 3)).toBe(true);
  });

  it('keeps slanted gap edges collinear through row gaps', () => {
    const settings = {
      ...DEFAULT_GRID_SETTINGS,
      gapX: 4,
      gapY: 4,
    };
    const xGap = getGapPolygon(settings, { part: 'x', row: 2, column: 3 });
    const intersectionGap = getGapPolygon(settings, { part: 'xy', row: 2, column: 3 });

    expect(xGap).not.toBeNull();
    expect(intersectionGap).not.toBeNull();
    expect(xGap![3]).toEqual(intersectionGap![0]);
    expect(Math.abs(cross(xGap![0], xGap![3], intersectionGap![0], intersectionGap![3]))).toBeLessThan(
      0.001,
    );
  });
});
