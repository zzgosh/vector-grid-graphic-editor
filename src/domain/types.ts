export type Point = {
  x: number;
  y: number;
};

export type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

export type CellRef = {
  row: number;
  column: number;
};

export type GapPart = 'x' | 'y' | 'xy';

export type GapRef = {
  part: GapPart;
  row: number;
  column: number;
};

export type FillSelection = {
  cells: Set<string>;
  gaps: Set<string>;
};

export type SlantMode = 'verticalEdges' | 'horizontalEdges';
export type SlantDirection = 'forward' | 'backward';
export type ToolMode = 'paint' | 'erase';
export type PaintTargets = {
  cells: boolean;
  gaps: boolean;
};
export type ExportMode = 'separated' | 'merged';

export type GridSettings = {
  rows: number;
  columns: number;
  cellWidth: number;
  cellHeight: number;
  slantMode: SlantMode;
  slantDirection: SlantDirection;
  slantAngle: number;
  gapXEnabled: boolean;
  gapYEnabled: boolean;
  gapX: number;
  gapY: number;
  fillColor: string;
};

export type NumberControl = {
  kind: 'number';
  key: keyof GridSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
};

export type ToggleControl = {
  kind: 'toggle';
  key: keyof GridSettings;
  label: string;
};

export type SegmentedControl = {
  kind: 'segmented';
  key: keyof GridSettings;
  label: string;
  options: Array<{ label: string; value: string }>;
};

export type ShapeControl = NumberControl | ToggleControl | SegmentedControl;

export type ShapeDefinition = {
  id: 'parallelogram';
  label: string;
  description: string;
  controls: ShapeControl[];
};
