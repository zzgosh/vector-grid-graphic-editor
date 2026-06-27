import { expect, test, type Locator } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { readFileSync } from 'node:fs';

type TestPoint = {
  x: number;
  y: number;
};

type TestSettings = {
  rows: number;
  columns: number;
  cellWidth: number;
  cellHeight: number;
  slantMode: 'verticalEdges' | 'horizontalEdges';
  slantDirection: 'forward' | 'backward';
  slantAngle: number;
  gapXEnabled: boolean;
  gapYEnabled: boolean;
  gapX: number;
  gapY: number;
};

type TestGap = {
  part: 'x' | 'y' | 'xy';
  row: number;
  column: number;
};

const DEFAULT_TEST_SETTINGS: TestSettings = {
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
};

const CANVAS_PADDING = 44;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const getSignedSlantOffset = (settings: TestSettings): number => {
  const adjacent = settings.slantMode === 'verticalEdges' ? settings.cellHeight : settings.cellWidth;
  const offset = Math.tan(toRadians(settings.slantAngle)) * adjacent;
  return settings.slantDirection === 'forward' ? -offset : offset;
};

const getCellPolygon = (
  settings: TestSettings,
  { row, column }: { row: number; column: number },
): TestPoint[] => {
  const skew = getSignedSlantOffset(settings);
  const gapX = settings.gapXEnabled ? settings.gapX : 0;
  const gapY = settings.gapYEnabled ? settings.gapY : 0;
  const origin =
    settings.slantMode === 'verticalEdges'
      ? {
          x: column * (settings.cellWidth + gapX) + row * skew,
          y: row * (settings.cellHeight + gapY),
        }
      : {
          x: column * (settings.cellWidth + gapX),
          y: column * skew + row * (settings.cellHeight + gapY),
        };

  if (settings.slantMode === 'verticalEdges') {
    return [
      { x: origin.x, y: origin.y },
      { x: origin.x + settings.cellWidth, y: origin.y },
      { x: origin.x + settings.cellWidth + skew, y: origin.y + settings.cellHeight },
      { x: origin.x + skew, y: origin.y + settings.cellHeight },
    ];
  }

  return [
    { x: origin.x, y: origin.y },
    { x: origin.x + settings.cellWidth, y: origin.y + skew },
    { x: origin.x + settings.cellWidth, y: origin.y + settings.cellHeight + skew },
    { x: origin.x, y: origin.y + settings.cellHeight },
  ];
};

const getGapPolygon = (settings: TestSettings, gap: TestGap): TestPoint[] => {
  if (gap.part === 'x') {
    const leftCell = getCellPolygon(settings, { row: gap.row, column: gap.column });
    const rightCell = getCellPolygon(settings, { row: gap.row, column: gap.column + 1 });
    return [leftCell[1], rightCell[0], rightCell[3], leftCell[2]];
  }

  if (gap.part === 'y') {
    const topCell = getCellPolygon(settings, { row: gap.row, column: gap.column });
    const bottomCell = getCellPolygon(settings, { row: gap.row + 1, column: gap.column });
    return [topCell[3], topCell[2], bottomCell[1], bottomCell[0]];
  }

  const topLeftCell = getCellPolygon(settings, { row: gap.row, column: gap.column });
  const topRightCell = getCellPolygon(settings, { row: gap.row, column: gap.column + 1 });
  const bottomRightCell = getCellPolygon(settings, { row: gap.row + 1, column: gap.column + 1 });
  const bottomLeftCell = getCellPolygon(settings, { row: gap.row + 1, column: gap.column });
  return [topLeftCell[2], topRightCell[3], bottomRightCell[0], bottomLeftCell[1]];
};

const centerOf = (polygon: TestPoint[]): TestPoint => ({
  x: polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length,
  y: polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length,
});

const getGridBounds = (settings: TestSettings) => {
  const points: TestPoint[] = [];
  for (let row = 0; row < settings.rows; row += 1) {
    for (let column = 0; column < settings.columns; column += 1) {
      points.push(...getCellPolygon(settings, { row, column }));
    }
  }
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  return { minX, minY, width: maxX - minX, height: maxY - minY };
};

const getCanvasLocalPointForWorldPoint = async (canvas: Locator, point: TestPoint) => {
  const size = await canvas.evaluate((element: HTMLCanvasElement) => ({
    width: element.clientWidth,
    height: element.clientHeight,
  }));
  const bounds = getGridBounds(DEFAULT_TEST_SETTINGS);
  const scale = Math.min(
    (size.width - CANVAS_PADDING * 2) / bounds.width,
    (size.height - CANVAS_PADDING * 2) / bounds.height,
  );
  const offsetX = (size.width - bounds.width * scale) / 2;
  const offsetY = (size.height - bounds.height * scale) / 2;

  return {
    x: offsetX + (point.x - bounds.minX) * scale,
    y: offsetY + (point.y - bounds.minY) * scale,
  };
};

const getCanvasPointForWorldPoint = async (canvas: Locator, point: TestPoint) => {
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    throw new Error('Canvas bounding box is missing.');
  }

  const localPoint = await getCanvasLocalPointForWorldPoint(canvas, point);
  return {
    x: box.x + localPoint.x,
    y: box.y + localPoint.y,
  };
};

const diffScreenshots = (before: Buffer, after: Buffer) => {
  const beforePng = PNG.sync.read(before);
  const afterPng = PNG.sync.read(after);
  const { width, height } = beforePng;
  const diff = new PNG({ width, height });
  const changedPixels = pixelmatch(beforePng.data, afterPng.data, diff.data, width, height, {
    threshold: 0.12,
  });
  return { changedPixels, diff: PNG.sync.write(diff) };
};

const countDarkCanvasPixels = async (canvas: Locator) => {
  return canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext('2d');
    if (!context) {
      return 0;
    }
    const step = 8;
    let count = 0;
    for (let y = 0; y < element.height; y += step) {
      for (let x = 0; x < element.width; x += step) {
        const [r, g, b, a] = context.getImageData(x, y, 1, 1).data;
        if (a > 0 && r < 64 && g < 64 && b < 64) {
          count += 1;
        }
      }
    }
    return count;
  });
};

const getCanvasPixelAtWorldPoint = async (canvas: Locator, point: TestPoint) => {
  const localPoint = await getCanvasLocalPointForWorldPoint(canvas, point);
  return canvas.evaluate((element: HTMLCanvasElement, local) => {
    const context = element.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context is missing.');
    }
    const scaleX = element.width / element.clientWidth;
    const scaleY = element.height / element.clientHeight;
    const pixel = context.getImageData(
      Math.round(local.x * scaleX),
      Math.round(local.y * scaleY),
      1,
      1,
    ).data;
    return {
      r: pixel[0],
      g: pixel[1],
      b: pixel[2],
      a: pixel[3],
    };
  }, localPoint);
};

test('paints by click and drag, then exports renderable SVG', async ({ page }) => {
  await page.goto('/');

  const canvas = page.getByTestId('editor-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId('selected-count')).toHaveText('0 cells · 0 gaps');
  const unfilledCellCenter = centerOf(getCellPolygon(DEFAULT_TEST_SETTINGS, { row: 6, column: 6 }));
  const unfilledCellPixel = await getCanvasPixelAtWorldPoint(canvas, unfilledCellCenter);
  expect(unfilledCellPixel).toMatchObject({ r: 255, g: 255, b: 255, a: 255 });

  const before = await canvas.screenshot();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    throw new Error('Canvas bounding box is missing.');
  }

  await page.mouse.click(box.x + box.width * 0.42, box.y + box.height * 0.42);
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.45, { steps: 8 });
  await page.mouse.move(box.x + box.width * 0.69, box.y + box.height * 0.54, { steps: 6 });
  await page.mouse.up();

  await expect(page.getByTestId('selected-count')).not.toHaveText('0 cells · 0 gaps');
  const selectedText = await page.getByTestId('selected-count').textContent();
  const selectedCount = Number(selectedText?.match(/\d+/)?.[0] ?? '0');
  expect(selectedCount).toBeGreaterThan(3);
  await expect.poll(() => countDarkCanvasPixels(canvas), { timeout: 5_000 }).toBeGreaterThan(20);

  const after = await canvas.screenshot();
  const diff = diffScreenshots(before, after);
  test.info().attach('paint-diff.png', { body: diff.diff, contentType: 'image/png' });
  expect(diff.changedPixels).toBeGreaterThan(1_000);

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('download-svg').click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  const svg = readFileSync(path!, 'utf8');
  expect(svg).toContain('<svg');
  expect(svg).toContain('viewBox=');
  expect(svg).toContain('<path');
  expect(svg).not.toContain('width=');
  expect(svg).not.toContain('height=');

  await page.setContent(`<main style="padding:32px;background:#f4f5f6">${svg}</main>`);
  const exportedSvg = page.locator('svg');
  await expect(exportedSvg).toBeVisible();
  const rendered = await exportedSvg.screenshot();
  expect(PNG.sync.read(rendered).width).toBeGreaterThan(10);
});

test('paints gap regions as exportable fill targets', async ({ page }) => {
  await page.goto('/');

  const canvas = page.getByTestId('editor-canvas');
  await expect(canvas).toBeVisible();
  await page.getByTestId('gap-target').click();

  const gapCenter = centerOf(getGapPolygon(DEFAULT_TEST_SETTINGS, { part: 'x', row: 6, column: 6 }));
  const canvasPoint = await getCanvasPointForWorldPoint(canvas, gapCenter);
  await page.mouse.click(canvasPoint.x, canvasPoint.y);

  await expect(page.getByTestId('selected-count')).toHaveText('0 cells · 1 gaps');
  await expect(page.locator('.previewPanel')).toContainText('1 gaps');
  await expect(page.getByTestId('export-stats')).toContainText('1 paths');
  await expect.poll(() => countDarkCanvasPixels(canvas), { timeout: 5_000 }).toBeGreaterThan(0);
});

test('supports changing grid quantity and slant controls', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('rows-input').fill('20');
  await page.getByTestId('rows-input').press('Enter');
  await page.getByTestId('columns-input').fill('12');
  await page.getByTestId('columns-input').press('Enter');
  await page.getByTestId('slantAngle-input').fill('32');
  await page.getByTestId('slantAngle-input').press('Enter');

  await expect(page.getByText('20 rows x 12 columns')).toBeVisible();
  await expect(page.getByTestId('export-stats')).toContainText('0 paths');
});

test('supports keyboard painting and preserves hidden cells across grid resizing', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByTestId('editor-canvas');
  await canvas.focus();

  for (let index = 0; index < 15; index += 1) {
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
  }
  await page.keyboard.press('Space');
  await expect(page.getByTestId('selected-count')).toHaveText('1 cells · 0 gaps');

  await page.getByTestId('rows-input').fill('4');
  await page.getByTestId('rows-input').press('Enter');
  await page.getByTestId('columns-input').fill('4');
  await page.getByTestId('columns-input').press('Enter');
  await expect(page.getByTestId('selected-count')).toHaveText('0 cells · 0 gaps');

  await page.getByTestId('rows-input').fill('16');
  await page.getByTestId('rows-input').press('Enter');
  await page.getByTestId('columns-input').fill('16');
  await page.getByTestId('columns-input').press('Enter');
  await expect(page.getByTestId('selected-count')).toHaveText('1 cells · 0 gaps');
});
