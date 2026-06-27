import * as polygonClippingNamespace from 'polygon-clipping';
import { isCellInGrid, parseCellKey } from '../domain/grid';
import type { CellRef, ExportMode, GridSettings, Point } from '../domain/types';
import { getCellPolygon, getGridBounds } from '../shapes/parallelogram';

type Pair = [number, number];
type Ring = Pair[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];
type PolygonClippingApi = {
  union: (geom: Polygon | MultiPolygon, ...geoms: Array<Polygon | MultiPolygon>) => MultiPolygon;
};

const polygonClipping = (
  'default' in polygonClippingNamespace
    ? (polygonClippingNamespace as unknown as { default: PolygonClippingApi }).default
    : polygonClippingNamespace
) as PolygonClippingApi;

export type SvgExportResult = {
  svg: string;
  stats: {
    mode: ExportMode;
    selectedCells: number;
    pathCount: number;
    pointCount: number;
    width: number;
    height: number;
  };
};

const EPSILON = 0.0001;

const isSamePoint = (first: Point, second: Point, epsilon = EPSILON): boolean =>
  Math.abs(first.x - second.x) <= epsilon && Math.abs(first.y - second.y) <= epsilon;

const area2 = (previous: Point, current: Point, next: Point): number =>
  (current.x - previous.x) * (next.y - current.y) -
  (current.y - previous.y) * (next.x - current.x);

export const cleanRing = (points: Point[]): Point[] => {
  if (points.length <= 3) {
    return points;
  }

  const withoutClosure = [...points];
  if (isSamePoint(withoutClosure[0], withoutClosure[withoutClosure.length - 1])) {
    withoutClosure.pop();
  }

  const withoutDuplicates = withoutClosure.filter((point, index, allPoints) => {
    if (index === 0) {
      return true;
    }
    return !isSamePoint(point, allPoints[index - 1]);
  });

  if (withoutDuplicates.length <= 3) {
    return withoutDuplicates;
  }

  return withoutDuplicates.filter((point, index, allPoints) => {
    const previous = allPoints[(index - 1 + allPoints.length) % allPoints.length];
    const next = allPoints[(index + 1) % allPoints.length];
    return Math.abs(area2(previous, point, next)) > EPSILON;
  });
};

const ringToPolygonInput = (points: Point[]): Ring => {
  const ring = points.map<Pair>((point) => [point.x, point.y]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }
  return ring;
};

const getSelectedCells = (settings: GridSettings, filledCells: Set<string>): CellRef[] =>
  Array.from(filledCells)
    .map(parseCellKey)
    .filter((cell) => isCellInGrid(cell, settings))
    .sort((first, second) => first.row - second.row || first.column - second.column);

const getSelectedPolygons = (settings: GridSettings, filledCells: Set<string>): Point[][] =>
  getSelectedCells(settings, filledCells).map((cell) => getCellPolygon(settings, cell));

const boundsFromPolygons = (polygons: Point[][]): ReturnType<typeof getGridBounds> => {
  const points = polygons.flat();
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1 };
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

const formatNumber = (value: number): string => {
  const rounded = Number(value.toFixed(3));
  return Object.is(rounded, -0) ? '0' : `${rounded}`;
};

const pointToCommand = (point: Point, bounds: { minX: number; minY: number }): string =>
  `${formatNumber(point.x - bounds.minX)} ${formatNumber(point.y - bounds.minY)}`;

const ringToPath = (ring: Point[], bounds: { minX: number; minY: number }): string => {
  const cleaned = cleanRing(ring);
  if (cleaned.length === 0) {
    return '';
  }
  const [first, ...rest] = cleaned;
  return `M ${pointToCommand(first, bounds)} ${rest
    .map((point) => `L ${pointToCommand(point, bounds)}`)
    .join(' ')} Z`;
};

const multipolygonToPaths = (
  multipolygon: Point[][][],
  bounds: { minX: number; minY: number },
): string[] =>
  multipolygon
    .map((polygon) => polygon.map((ring) => ringToPath(ring, bounds)).filter(Boolean).join(' '))
    .filter(Boolean);

const convertUnionOutput = (output: MultiPolygon): Point[][][] =>
  output.map((polygon) =>
    polygon.map((ring) =>
      ring.map(([x, y]) => ({
        x,
        y,
      })),
    ),
  );

const buildSeparatedPaths = (
  settings: GridSettings,
  selectedCells: CellRef[],
  bounds: { minX: number; minY: number },
): string[] =>
  selectedCells.map((cell) => ringToPath(getCellPolygon(settings, cell), bounds)).filter(Boolean);

const buildMergedPaths = (
  settings: GridSettings,
  selectedCells: CellRef[],
  bounds: { minX: number; minY: number },
): string[] => {
  if (selectedCells.length === 0) {
    return [];
  }

  const polygons = selectedCells.map<Polygon>((cell) => [
    ringToPolygonInput(getCellPolygon(settings, cell)),
  ]);
  const unionOutput = polygonClipping.union(polygons[0], ...polygons.slice(1));
  return multipolygonToPaths(convertUnionOutput(unionOutput), bounds);
};

const countPointsInPaths = (paths: string[]): number =>
  paths.reduce((sum, path) => sum + (path.match(/[ML]/g)?.length ?? 0), 0);

const buildSvgMarkup = (
  paths: string[],
  settings: GridSettings,
  bounds: { width: number; height: number },
): string => {
  const width = Math.max(1, bounds.width);
  const height = Math.max(1, bounds.height);
  const pathMarkup = paths
    .map(
      (path) =>
        `<path d="${path}" fill="${settings.fillColor}" fill-rule="evenodd" clip-rule="evenodd"/>`,
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${formatNumber(width)} ${formatNumber(
    height,
  )}" role="img" aria-label="Exported vector grid graphic">${pathMarkup}</svg>`;
};

export const exportGridSvg = (
  settings: GridSettings,
  filledCells: Set<string>,
  mode: ExportMode,
): SvgExportResult => {
  const selectedCells = getSelectedCells(settings, filledCells);
  const selectedPolygons = getSelectedPolygons(settings, filledCells);
  const bounds = boundsFromPolygons(selectedPolygons);
  const paths =
    mode === 'merged'
      ? buildMergedPaths(settings, selectedCells, bounds)
      : buildSeparatedPaths(settings, selectedCells, bounds);
  const svg = buildSvgMarkup(paths, settings, bounds);

  return {
    svg,
    stats: {
      mode,
      selectedCells: selectedCells.length,
      pathCount: paths.length,
      pointCount: countPointsInPaths(paths),
      width: bounds.width,
      height: bounds.height,
    },
  };
};

export const optimizeSvg = async (svg: string): Promise<string> => {
  const { optimize } = await import('svgo/browser');
  const optimized = optimize(svg, {
    multipass: true,
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            removeViewBox: false,
          },
        },
      } as never,
      'removeDimensions',
      'sortAttrs',
    ],
  });
  return 'data' in optimized ? optimized.data : svg;
};
