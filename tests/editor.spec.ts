import { expect, test, type Locator } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { readFileSync } from 'node:fs';

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

test('paints by click and drag, then exports renderable SVG', async ({ page }) => {
  await page.goto('/');

  const canvas = page.getByTestId('editor-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId('selected-count')).toHaveText('0 filled');

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

  await expect(page.getByTestId('selected-count')).not.toHaveText('0 filled');
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

test('supports changing grid quantity and slant controls', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('rows-input').fill('20');
  await page.getByTestId('columns-input').fill('12');
  await page.getByTestId('slantAngle-input').fill('32');

  await expect(page.getByText('20 rows x 12 columns')).toBeVisible();
  await expect(page.getByTestId('export-stats')).toContainText('0 paths');
});
