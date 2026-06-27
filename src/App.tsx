import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BetweenHorizontalStart,
  Download,
  Eraser,
  Grid2x2,
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
import { DEFAULT_GRID_SETTINGS, areKeySetsEqual, filterCellsForGrid, filterGapsForGrid } from './domain/grid';
import type { ExportMode, FillSelection, GridSettings, PaintTarget, ToolMode } from './domain/types';
import { exportGridSvg, optimizeSvg } from './svg/exportSvg';

const cloneSelection = (selection: FillSelection): FillSelection => ({
  cells: new Set(selection.cells),
  gaps: new Set(selection.gaps),
});

const areSelectionsEqual = (first: FillSelection, second: FillSelection): boolean =>
  areKeySetsEqual(first.cells, second.cells) && areKeySetsEqual(first.gaps, second.gaps);

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
  const [selection, setSelection] = useState<FillSelection>(() => ({
    cells: new Set(),
    gaps: new Set(),
  }));
  const [toolMode, setToolMode] = useState<ToolMode>('paint');
  const [paintTarget, setPaintTarget] = useState<PaintTarget>('cell');
  const [exportMode, setExportMode] = useState<ExportMode>('merged');
  const [isDrawing, setIsDrawing] = useState(false);
  const [exportSnapshot, setExportSnapshot] = useState(() => ({
    settings: DEFAULT_GRID_SETTINGS,
    selection: {
      cells: new Set<string>(),
      gaps: new Set<string>(),
    },
    exportMode: 'merged' as ExportMode,
  }));
  const undoStack = useRef<FillSelection[]>([]);
  const redoStack = useRef<FillSelection[]>([]);
  const strokeStart = useRef<FillSelection | null>(null);

  const visibleFilledCells = useMemo(
    () => filterCellsForGrid(selection.cells, settings),
    [selection, settings],
  );
  const visibleFilledGaps = useMemo(
    () => filterGapsForGrid(selection.gaps, settings),
    [selection, settings],
  );

  const exportResult = useMemo(
    () =>
      exportGridSvg(
        exportSnapshot.settings,
        exportSnapshot.selection.cells,
        exportSnapshot.exportMode,
        exportSnapshot.selection.gaps,
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
        selection: cloneSelection(selection),
        exportMode,
      });
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [exportMode, isDrawing, selection, settings]);

  const commitSelection = (nextSelection: FillSelection) => {
    setSelection((previousSelection) => {
      if (areSelectionsEqual(previousSelection, nextSelection)) {
        return previousSelection;
      }
      undoStack.current.push(cloneSelection(previousSelection));
      redoStack.current = [];
      return cloneSelection(nextSelection);
    });
  };

  const updateSettings = (partial: Partial<GridSettings>) => {
    const nextSettings = normalizeSettings({ ...settings, ...partial });
    setSettings(nextSettings);
  };

  const beginStroke = () => {
    setIsDrawing(true);
    strokeStart.current = cloneSelection(selection);
  };

  const updateStroke = (nextSelection: FillSelection) => {
    setSelection(nextSelection);
  };

  const endStroke = (finalSelection: FillSelection) => {
    const start = strokeStart.current;
    strokeStart.current = null;
    setIsDrawing(false);
    if (!start || areSelectionsEqual(start, finalSelection)) {
      return;
    }
    undoStack.current.push(start);
    redoStack.current = [];
    setSelection(cloneSelection(finalSelection));
    setExportSnapshot({
      settings,
      selection: cloneSelection(finalSelection),
      exportMode,
    });
  };

  const undo = () => {
    const previous = undoStack.current.pop();
    if (!previous) {
      return;
    }
    redoStack.current.push(cloneSelection(selection));
    setSelection(cloneSelection(previous));
  };

  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) {
      return;
    }
    undoStack.current.push(cloneSelection(selection));
    setSelection(cloneSelection(next));
  };

  const clearGrid = () => {
    commitSelection({ cells: new Set(), gaps: new Set() });
  };

  const resetSettings = () => {
    setSettings(DEFAULT_GRID_SETTINGS);
  };

  const downloadSvg = async () => {
    const freshExport = exportGridSvg(settings, selection.cells, exportMode, selection.gaps);
    const svg = await optimizeSvg(freshExport.svg);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `vector-grid-${exportMode}.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const selectedCellCount = visibleFilledCells.size;
  const selectedGapCount = visibleFilledGaps.size;

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

        <section className="controlSection compactTools" aria-labelledby="tools-heading">
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

          <div className="toolsCompactGrid">
            <div className="segmented toolSegmented" role="group" aria-label="Paint target">
              <button
                type="button"
                className={paintTarget === 'cell' ? 'active' : ''}
                aria-pressed={paintTarget === 'cell'}
                onClick={() => setPaintTarget('cell')}
              >
                <Grid2x2 size={16} />
                Cells
              </button>
              <button
                type="button"
                className={paintTarget === 'gap' ? 'active' : ''}
                aria-pressed={paintTarget === 'gap'}
                onClick={() => setPaintTarget('gap')}
                data-testid="gap-target"
              >
                <BetweenHorizontalStart size={16} />
                Gaps
              </button>
            </div>

            <div className="segmented toolSegmented" role="group" aria-label="Drawing tool">
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

            <div className="toolInlineRow">
              <label className="compactColorField">
                <span>Fill color</span>
                <input
                  type="color"
                  value={settings.fillColor}
                  onChange={(event) => updateSettings({ fillColor: event.target.value })}
                  aria-label="Fill color"
                />
              </label>

              <button
                className="secondaryButton compactClearButton"
                type="button"
                onClick={clearGrid}
                aria-label="Clear filled cells and gaps"
              >
                <Trash2 size={16} />
                Clear
              </button>
            </div>
          </div>
        </section>

        <section className="controlSection" aria-labelledby="export-heading">
          <div className="sectionHeading">
            <h2 id="export-heading">Export</h2>
            <span className="statPill" data-testid="selected-count">
              {selectedCellCount} cells · {selectedGapCount} gaps
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
            filledCells={selection.cells}
            filledGaps={selection.gaps}
            toolMode={toolMode}
            paintTarget={paintTarget}
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
