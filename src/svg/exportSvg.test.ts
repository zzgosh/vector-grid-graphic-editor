import { describe, expect, it } from 'vitest';
import { DEFAULT_GRID_SETTINGS, cellKey } from '../domain/grid';
import { cleanRing, exportGridSvg } from './exportSvg';

describe('SVG export', () => {
  it('exports separated cells as separate paths', () => {
    const cells = new Set([
      cellKey({ row: 0, column: 0 }),
      cellKey({ row: 0, column: 1 }),
    ]);
    const result = exportGridSvg(DEFAULT_GRID_SETTINGS, cells, 'separated');

    expect(result.stats.selectedCells).toBe(2);
    expect(result.stats.pathCount).toBe(2);
    expect(result.svg).toContain('viewBox=');
    expect(result.svg.match(/<path/g)?.length).toBe(2);
  });

  it('unions adjacent no-gap cells into one continuous path', () => {
    const cells = new Set([
      cellKey({ row: 0, column: 0 }),
      cellKey({ row: 0, column: 1 }),
    ]);
    const result = exportGridSvg(
      {
        ...DEFAULT_GRID_SETTINGS,
        gapXEnabled: false,
        gapYEnabled: false,
        gapX: 0,
        gapY: 0,
      },
      cells,
      'merged',
    );

    expect(result.stats.pathCount).toBe(1);
    expect(result.stats.pointCount).toBeLessThan(8);
    expect(result.svg.match(/<path/g)?.length).toBe(1);
  });

  it('keeps separated islands when gaps are enabled in merged mode', () => {
    const cells = new Set([
      cellKey({ row: 0, column: 0 }),
      cellKey({ row: 0, column: 1 }),
    ]);
    const result = exportGridSvg(DEFAULT_GRID_SETTINGS, cells, 'merged');

    expect(result.stats.pathCount).toBe(2);
  });

  it('cleans duplicate and collinear points', () => {
    const cleaned = cleanRing([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
      { x: 0, y: 0 },
    ]);

    expect(cleaned).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ]);
  });
});
