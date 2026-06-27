import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Eraser,
  Grid3X3,
  Paintbrush,
  Redo2,
  RotateCcw,
  Trash2,
  Undo2,
} from 'lucide-react';
import { EditorCanvas } from './components/EditorCanvas';
import { NumericField } from './components/NumericField';
import { ShapeControls } from './components/ShapeControls';
import { SvgPreview } from './components/SvgPreview';
import { DEFAULT_GRID_SETTINGS, areCellSetsEqual, filterCellsForGrid } from './domain/grid';
import type { ExportMode, GridSettings, ToolMode } from './domain/types';
import { exportGridSvg, optimizeSvg } from './svg/exportSvg';

const cloneCells = (cells: Set<string>): Set<string> => new Set(cells);

const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
};

const normalizeSettings = (settings: GridSettings): GridSettings => ({
  ...settings,
  rows: Math.round(clamp(settings.rows, 4, 96)),
  columns: Math.round(clamp(settings.columns, 4, 96)),
  cellWidth: clamp(settings.cellWidth, 16, 160),
  cellHeight: clamp(settings.cellHeight, 16, 160),
  slantAngle: clamp(settings.slantAngle, 0, 55),
  gapX: clamp(settings.gapX, 0, 48),
  gapY: clamp(settings.gapY, 0, 48),
});

export const App = () => {
  const [settings, setSettings] = useState<GridSettings>(DEFAULT_GRID_SETTINGS);
  const [filledCells, setFilledCells] = useState<Set<string>>(() => new Set());
  const [toolMode, setToolMode] = useState<ToolMode>('paint');
  const [exportMode, setExportMode] = useState<ExportMode>('merged');
  const [isDrawing, setIsDrawing] = useState(false);
  const [exportSnapshot, setExportSnapshot] = useState(() => ({
    settings: DEFAULT_GRID_SETTINGS,
    filledCells: new Set<string>(),
    exportMode: 'merged' as ExportMode,
  }));
  const undoStack = useRef<Set<string>[]>([]);
  const redoStack = useRef<Set<string>[]>([]);
  const strokeStart = useRef<Set<string> | null>(null);

  const visibleFilledCells = useMemo(
    () => filterCellsForGrid(filledCells, settings),
    [filledCells, settings],
  );

  const exportResult = useMemo(
    () =>
      exportGridSvg(
        exportSnapshot.settings,
        exportSnapshot.filledCells,
        exportSnapshot.exportMode,
      ),
    [exportSnapshot],
  );

  useEffect(() => {
    if (isDrawing) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setExportSnapshot({
        settings,
        filledCells: cloneCells(filledCells),
        exportMode,
      });
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [exportMode, filledCells, isDrawing, settings]);

  const commitCells = (nextCells: Set<string>) => {
    setFilledCells((previousCells) => {
      if (areCellSetsEqual(previousCells, nextCells)) {
        return previousCells;
      }
      undoStack.current.push(cloneCells(previousCells));
      redoStack.current = [];
      return cloneCells(nextCells);
    });
  };

  const updateSettings = (partial: Partial<GridSettings>) => {
    const nextSettings = normalizeSettings({ ...settings, ...partial });
    setSettings(nextSettings);
  };

  const beginStroke = () => {
    setIsDrawing(true);
    strokeStart.current = cloneCells(filledCells);
  };

  const updateStroke = (nextCells: Set<string>) => {
    setFilledCells(nextCells);
  };

  const endStroke = (finalCells: Set<string>) => {
    const start = strokeStart.current;
    strokeStart.current = null;
    setIsDrawing(false);
    if (!start || areCellSetsEqual(start, finalCells)) {
      return;
    }
    undoStack.current.push(start);
    redoStack.current = [];
    setFilledCells(cloneCells(finalCells));
    setExportSnapshot({
      settings,
      filledCells: cloneCells(finalCells),
      exportMode,
    });
  };

  const undo = () => {
    const previous = undoStack.current.pop();
    if (!previous) {
      return;
    }
    redoStack.current.push(cloneCells(filledCells));
    setFilledCells(cloneCells(previous));
  };

  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) {
      return;
    }
    undoStack.current.push(cloneCells(filledCells));
    setFilledCells(cloneCells(next));
  };

  const clearGrid = () => {
    commitCells(new Set());
  };

  const resetSettings = () => {
    setSettings(DEFAULT_GRID_SETTINGS);
  };

  const downloadSvg = async () => {
    const freshExport = exportGridSvg(settings, filledCells, exportMode);
    const svg = await optimizeSvg(freshExport.svg);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `vector-grid-${exportMode}.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const selectedCount = visibleFilledCells.size;

  return (
    <main className="appShell">
      <aside className="sidebar" aria-label="Editor controls">
        <div className="brandBlock">
          <div className="brandMark" aria-hidden="true">
            <Grid3X3 size={22} />
          </div>
          <div>
            <h1>Vector Grid Graphic Editor</h1>
            <p>Parallelogram logo construction grid</p>
          </div>
        </div>

        <section className="controlSection" aria-labelledby="grid-heading">
          <div className="sectionHeading">
            <h2 id="grid-heading">Canvas</h2>
            <button className="iconButton" type="button" onClick={resetSettings} aria-label="Reset settings">
              <RotateCcw size={17} />
            </button>
          </div>
          <div className="twoColumn">
            <NumericField
              label="Rows"
              value={settings.rows}
              min={4}
              max={96}
              step={1}
              testId="rows-input"
              onCommit={(rows) => updateSettings({ rows })}
            />
            <NumericField
              label="Columns"
              value={settings.columns}
              min={4}
              max={96}
              step={1}
              testId="columns-input"
              onCommit={(columns) => updateSettings({ columns })}
            />
          </div>
        </section>

        <ShapeControls settings={settings} onChange={updateSettings} />

        <section className="controlSection" aria-labelledby="tools-heading">
          <div className="sectionHeading">
            <h2 id="tools-heading">Tools</h2>
            <div className="toolbarGroup" role="group" aria-label="History controls">
              <button className="iconButton" type="button" onClick={undo} aria-label="Undo">
                <Undo2 size={17} />
              </button>
              <button className="iconButton" type="button" onClick={redo} aria-label="Redo">
                <Redo2 size={17} />
              </button>
            </div>
          </div>

          <div className="segmented" role="group" aria-label="Drawing tool">
            <button
              type="button"
              className={toolMode === 'paint' ? 'active' : ''}
              aria-pressed={toolMode === 'paint'}
              onClick={() => setToolMode('paint')}
            >
              <Paintbrush size={16} />
              Paint
            </button>
            <button
              type="button"
              className={toolMode === 'erase' ? 'active' : ''}
              aria-pressed={toolMode === 'erase'}
              onClick={() => setToolMode('erase')}
            >
              <Eraser size={16} />
              Erase
            </button>
          </div>

          <label className="field">
            <span>Fill color</span>
            <input
              type="color"
              value={settings.fillColor}
              onChange={(event) => updateSettings({ fillColor: event.target.value })}
              aria-label="Fill color"
            />
          </label>

          <button className="secondaryButton" type="button" onClick={clearGrid}>
            <Trash2 size={16} />
            Clear filled cells
          </button>
        </section>

        <section className="controlSection" aria-labelledby="export-heading">
          <div className="sectionHeading">
            <h2 id="export-heading">Export</h2>
            <span className="statPill" data-testid="selected-count">
              {selectedCount} filled
            </span>
          </div>
          <div className="segmented" role="group" aria-label="SVG export mode">
            <button
              type="button"
              className={exportMode === 'merged' ? 'active' : ''}
              aria-pressed={exportMode === 'merged'}
              onClick={() => setExportMode('merged')}
            >
              Merged
            </button>
            <button
              type="button"
              className={exportMode === 'separated' ? 'active' : ''}
              aria-pressed={exportMode === 'separated'}
              onClick={() => setExportMode('separated')}
            >
              Separated
            </button>
          </div>
          <button className="primaryButton" type="button" onClick={downloadSvg} data-testid="download-svg">
            <Download size={17} />
            Download SVG
          </button>
        </section>
      </aside>

      <section className="workspace" aria-label="Vector grid workspace">
        <div className="workspaceHeader">
          <div>
            <h2>Editing Surface</h2>
            <p>
              {settings.rows} rows x {settings.columns} columns · {settings.cellWidth}px x{' '}
              {settings.cellHeight}px cells
            </p>
          </div>
          <div className="exportStats" data-testid="export-stats">
            <span>{exportResult.stats.pathCount} paths</span>
            <span>{exportResult.stats.pointCount} points</span>
          </div>
        </div>

        <div className="canvasFrame">
          <EditorCanvas
            settings={settings}
            filledCells={filledCells}
            toolMode={toolMode}
            onStrokeStart={beginStroke}
            onStrokeChange={updateStroke}
            onStrokeEnd={endStroke}
          />
        </div>

        <SvgPreview result={exportResult} />
      </section>
    </main>
  );
};
