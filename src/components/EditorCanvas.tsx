import { useEffect, useMemo, useRef, useState } from 'react';
import { cellKey, gapKey, isGapInGrid, parseCellKey, parseGapKey } from '../domain/grid';
import type { FillSelection, GapRef, GridSettings, PaintTargets, Point, ToolMode } from '../domain/types';
import {
  findCellAtPoint,
  findGapAtPoint,
  getCellPolygon,
  getCellsAlongSegment,
  getGapPolygon,
  getGapsAlongSegment,
  getGridBounds,
} from '../shapes/parallelogram';

type EditorCanvasProps = {
  settings: GridSettings;
  filledCells: Set<string>;
  filledGaps: Set<string>;
  toolMode: ToolMode;
  paintTargets: PaintTargets;
  onStrokeStart: () => void;
  onStrokeChange: (selection: FillSelection) => void;
  onStrokeEnd: (selection: FillSelection) => void;
};

type Viewport = {
  scale: number;
  offsetX: number;
  offsetY: number;
  worldMinX: number;
  worldMinY: number;
};

const PADDING = 44;

const getPointerPoint = (
  canvas: HTMLCanvasElement,
  event: React.PointerEvent<HTMLCanvasElement>,
  viewport: Viewport,
): Point => {
  const rect = canvas.getBoundingClientRect();
  const canvasX = event.clientX - rect.left;
  const canvasY = event.clientY - rect.top;
  return {
    x: (canvasX - viewport.offsetX) / viewport.scale + viewport.worldMinX,
    y: (canvasY - viewport.offsetY) / viewport.scale + viewport.worldMinY,
  };
};

const paintCells = (
  settings: GridSettings,
  sourceCells: Set<string>,
  cells: Array<{ row: number; column: number }>,
  toolMode: ToolMode,
): Set<string> => {
  const nextCells = new Set(sourceCells);
  cells.forEach((cell) => {
    if (cell.row < 0 || cell.row >= settings.rows || cell.column < 0 || cell.column >= settings.columns) {
      return;
    }
    const key = cellKey(cell);
    if (toolMode === 'paint') {
      nextCells.add(key);
    } else {
      nextCells.delete(key);
    }
  });
  return nextCells;
};

const paintGaps = (
  settings: GridSettings,
  sourceGaps: Set<string>,
  gaps: GapRef[],
  toolMode: ToolMode,
): Set<string> => {
  const nextGaps = new Set(sourceGaps);
  gaps.forEach((gap) => {
    if (!isGapInGrid(gap, settings)) {
      return;
    }
    const key = gapKey(gap);
    if (toolMode === 'paint') {
      nextGaps.add(key);
    } else {
      nextGaps.delete(key);
    }
  });
  return nextGaps;
};

export const EditorCanvas = ({
  settings,
  filledCells,
  filledGaps,
  toolMode,
  paintTargets,
  onStrokeStart,
  onStrokeChange,
  onStrokeEnd,
}: EditorCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const pointerFocusRef = useRef(false);
  const workingSelectionRef = useRef<FillSelection>({
    cells: filledCells,
    gaps: filledGaps,
  });
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 620 });
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const [keyboardCell, setKeyboardCell] = useState({ row: 0, column: 0 });

  const bounds = useMemo(() => getGridBounds(settings), [settings]);
  const viewport = useMemo<Viewport>(() => {
    const availableWidth = Math.max(1, canvasSize.width - PADDING * 2);
    const availableHeight = Math.max(1, canvasSize.height - PADDING * 2);
    const scale = Math.min(availableWidth / Math.max(1, bounds.width), availableHeight / Math.max(1, bounds.height));
    return {
      scale,
      offsetX: (canvasSize.width - bounds.width * scale) / 2,
      offsetY: (canvasSize.height - bounds.height * scale) / 2,
      worldMinX: bounds.minX,
      worldMinY: bounds.minY,
    };
  }, [bounds, canvasSize]);

  useEffect(() => {
    workingSelectionRef.current = {
      cells: filledCells,
      gaps: filledGaps,
    };
  }, [filledCells, filledGaps]);

  useEffect(() => {
    setKeyboardCell((cell) => ({
      row: Math.min(settings.rows - 1, Math.max(0, cell.row)),
      column: Math.min(settings.columns - 1, Math.max(0, cell.column)),
    }));
  }, [settings.columns, settings.rows]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setCanvasSize({
        width: Math.max(360, Math.round(entry.contentRect.width)),
        height: Math.max(420, Math.round(entry.contentRect.height)),
      });
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(canvasSize.width * dpr);
    canvas.height = Math.floor(canvasSize.height * dpr);
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, canvasSize.width, canvasSize.height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvasSize.width, canvasSize.height);

    context.save();
    context.translate(
      viewport.offsetX - viewport.worldMinX * viewport.scale,
      viewport.offsetY - viewport.worldMinY * viewport.scale,
    );
    context.scale(viewport.scale, viewport.scale);

    const tracePolygon = (polygon: Point[]) => {
      context.beginPath();
      polygon.forEach((point, index) => {
        if (index === 0) {
          context.moveTo(point.x, point.y);
        } else {
          context.lineTo(point.x, point.y);
        }
      });
      context.closePath();
    };

    const strokePolygon = (polygon: Point[], color: string, lineWidth: number) => {
      tracePolygon(polygon);
      context.strokeStyle = color;
      context.lineWidth = lineWidth;
      context.stroke();
    };

    const fillPolygon = (polygon: Point[], color: string) => {
      tracePolygon(polygon);
      context.fillStyle = color;
      context.fill();
    };

    context.lineCap = 'butt';
    context.lineJoin = 'miter';

    for (let row = 0; row < settings.rows; row += 1) {
      for (let column = 0; column < settings.columns; column += 1) {
        const polygon = getCellPolygon(settings, { row, column });
        strokePolygon(polygon, '#a7adb4', 1.2 / viewport.scale);
      }
    }

    filledGaps.forEach((key) => {
      const polygon = getGapPolygon(settings, parseGapKey(key));
      if (!polygon) {
        return;
      }
      fillPolygon(polygon, settings.fillColor);
      strokePolygon(polygon, settings.fillColor, 1.2 / viewport.scale);
    });

    filledCells.forEach((key) => {
      const cell = parseCellKey(key);
      if (cell.row < 0 || cell.row >= settings.rows || cell.column < 0 || cell.column >= settings.columns) {
        return;
      }
      const polygon = getCellPolygon(settings, cell);
      fillPolygon(polygon, settings.fillColor);
      strokePolygon(polygon, settings.fillColor, 1.2 / viewport.scale);
    });

    if (isKeyboardFocused) {
      const polygon = getCellPolygon(settings, keyboardCell);
      strokePolygon(polygon, '#2f6fed', 3 / viewport.scale);
    }
    context.restore();
  }, [bounds, canvasSize, filledCells, filledGaps, isKeyboardFocused, keyboardCell, settings, viewport]);

  const applyPoint = (point: Point, previousPoint?: Point | null) => {
    let nextSelection = workingSelectionRef.current;
    let changed = false;

    if (paintTargets.cells) {
      const hitCell = findCellAtPoint(settings, point);
      const cells = previousPoint ? getCellsAlongSegment(settings, previousPoint, point) : hitCell ? [hitCell] : [];
      if (cells.length > 0) {
        nextSelection = {
          ...nextSelection,
          cells: paintCells(settings, nextSelection.cells, cells, toolMode),
        };
        changed = true;
      }
    }

    if (paintTargets.gaps) {
      const hitGap = findGapAtPoint(settings, point);
      const gaps = previousPoint ? getGapsAlongSegment(settings, previousPoint, point) : hitGap ? [hitGap] : [];
      if (gaps.length > 0) {
        nextSelection = {
          ...nextSelection,
          gaps: paintGaps(settings, nextSelection.gaps, gaps, toolMode),
        };
        changed = true;
      }
    }

    if (!changed) {
      return;
    }

    workingSelectionRef.current = nextSelection;
    onStrokeChange(nextSelection);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    pointerFocusRef.current = true;
    setIsKeyboardFocused(false);
    drawingRef.current = true;
    workingSelectionRef.current = {
      cells: new Set(filledCells),
      gaps: new Set(filledGaps),
    };
    onStrokeStart();
    const point = getPointerPoint(canvas, event, viewport);
    lastPointRef.current = point;
    applyPoint(point);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !drawingRef.current) {
      return;
    }
    const point = getPointerPoint(canvas, event, viewport);
    applyPoint(point, lastPointRef.current);
    lastPointRef.current = point;
  };

  const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !drawingRef.current) {
      return;
    }
    drawingRef.current = false;
    lastPointRef.current = null;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    pointerFocusRef.current = false;
    onStrokeEnd(workingSelectionRef.current);
  };

  const getKeyboardGap = (): GapRef | null => {
    const candidates: GapRef[] = [
      { part: 'x', row: keyboardCell.row, column: keyboardCell.column },
      { part: 'x', row: keyboardCell.row, column: keyboardCell.column - 1 },
      { part: 'y', row: keyboardCell.row, column: keyboardCell.column },
      { part: 'y', row: keyboardCell.row - 1, column: keyboardCell.column },
    ];
    return candidates.find((gap) => isGapInGrid(gap, settings)) ?? null;
  };

  const paintKeyboardSelection = () => {
    workingSelectionRef.current = {
      cells: new Set(filledCells),
      gaps: new Set(filledGaps),
    };

    let nextSelection = workingSelectionRef.current;
    let changed = false;

    if (paintTargets.cells) {
      nextSelection = {
        ...nextSelection,
        cells: paintCells(settings, nextSelection.cells, [keyboardCell], toolMode),
      };
      changed = true;
    }

    if (paintTargets.gaps) {
      const gap = getKeyboardGap();
      if (gap) {
        nextSelection = {
          ...nextSelection,
          gaps: paintGaps(settings, nextSelection.gaps, [gap], toolMode),
        };
        changed = true;
      }
    }

    if (!changed) {
      return;
    }

    workingSelectionRef.current = nextSelection;
    onStrokeStart();
    onStrokeChange(nextSelection);
    onStrokeEnd(nextSelection);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    setIsKeyboardFocused(true);

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      paintKeyboardSelection();
      return;
    }

    const moves: Record<string, { row: number; column: number }> = {
      ArrowUp: { row: -1, column: 0 },
      ArrowDown: { row: 1, column: 0 },
      ArrowLeft: { row: 0, column: -1 },
      ArrowRight: { row: 0, column: 1 },
    };
    const move = moves[event.key];
    if (!move) {
      return;
    }

    event.preventDefault();
    setKeyboardCell((cell) => ({
      row: Math.min(settings.rows - 1, Math.max(0, cell.row + move.row)),
      column: Math.min(settings.columns - 1, Math.max(0, cell.column + move.column)),
    }));
  };

  return (
    <div className="canvasWrapper" ref={wrapperRef}>
      <canvas
        ref={canvasRef}
        data-testid="editor-canvas"
        aria-label="Parallelogram drawing grid. Use arrow keys to move, then Space or Enter to paint or erase with enabled targets."
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Space Enter"
        role="application"
        tabIndex={0}
        onBlur={() => {
          pointerFocusRef.current = false;
          setIsKeyboardFocused(false);
        }}
        onFocus={() => {
          if (!pointerFocusRef.current) {
            setIsKeyboardFocused(true);
          }
        }}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      />
    </div>
  );
};
