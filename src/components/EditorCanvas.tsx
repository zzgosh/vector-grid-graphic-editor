import { useEffect, useMemo, useRef, useState } from 'react';
import { cellKey } from '../domain/grid';
import type { GridSettings, Point, ToolMode } from '../domain/types';
import {
  findCellAtPoint,
  getCellPolygon,
  getCellsAlongSegment,
  getGridBounds,
} from '../shapes/parallelogram';

type EditorCanvasProps = {
  settings: GridSettings;
  filledCells: Set<string>;
  toolMode: ToolMode;
  onStrokeStart: () => void;
  onStrokeChange: (cells: Set<string>) => void;
  onStrokeEnd: (cells: Set<string>) => void;
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

export const EditorCanvas = ({
  settings,
  filledCells,
  toolMode,
  onStrokeStart,
  onStrokeChange,
  onStrokeEnd,
}: EditorCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const workingCellsRef = useRef<Set<string>>(filledCells);
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 620 });

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
    workingCellsRef.current = filledCells;
  }, [filledCells]);

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
    context.fillStyle = '#f4f5f6';
    context.fillRect(0, 0, canvasSize.width, canvasSize.height);

    context.save();
    context.translate(
      viewport.offsetX - viewport.worldMinX * viewport.scale,
      viewport.offsetY - viewport.worldMinY * viewport.scale,
    );
    context.scale(viewport.scale, viewport.scale);

    for (let row = 0; row < settings.rows; row += 1) {
      for (let column = 0; column < settings.columns; column += 1) {
        const polygon = getCellPolygon(settings, { row, column });
        const key = cellKey({ row, column });
        context.beginPath();
        polygon.forEach((point, index) => {
          if (index === 0) {
            context.moveTo(point.x, point.y);
          } else {
            context.lineTo(point.x, point.y);
          }
        });
        context.closePath();
        context.fillStyle = filledCells.has(key) ? settings.fillColor : '#d9dde2';
        context.strokeStyle = filledCells.has(key) ? settings.fillColor : '#c5cbd2';
        context.lineWidth = 1 / viewport.scale;
        context.fill();
        context.stroke();
      }
    }
    context.restore();
  }, [bounds, canvasSize, filledCells, settings, viewport]);

  const applyPoint = (point: Point, previousPoint?: Point | null) => {
    const cells = previousPoint
      ? getCellsAlongSegment(settings, previousPoint, point)
      : findCellAtPoint(settings, point)
        ? [findCellAtPoint(settings, point)!]
        : [];
    if (cells.length === 0) {
      return;
    }
    const nextCells = paintCells(settings, workingCellsRef.current, cells, toolMode);
    workingCellsRef.current = nextCells;
    onStrokeChange(nextCells);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    workingCellsRef.current = new Set(filledCells);
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
    onStrokeEnd(workingCellsRef.current);
  };

  return (
    <div className="canvasWrapper" ref={wrapperRef}>
      <canvas
        ref={canvasRef}
        data-testid="editor-canvas"
        aria-label="Parallelogram drawing grid"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      />
    </div>
  );
};
