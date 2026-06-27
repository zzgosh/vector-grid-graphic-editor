# Vector Grid Graphic Editor

English | [中文](./README.zh-CN.md)

A frontend-only editor for building logo-like vector graphics from a configurable parallelogram grid.

## Features

- 16 x 16 default parallelogram grid with editable row and column counts.
- Shape-specific controls for parallelogram width, height, slant edge mode, slant direction, slant angle, and horizontal / vertical gaps.
- Line-only construction grid: unfilled units render as white cells with grey vector grid lines, avoiding filled placeholder blocks.
- Click-to-paint and drag-to-paint interaction with an erase mode.
- Cell and gap fill targets are enabled together by default; either target can be explicitly disabled for focused editing.
- Gap painting includes gap intersections when both horizontal and vertical gaps are enabled, so slanted gap strips can stay continuous across rows.
- Keyboard painting: focus the canvas, move with arrow keys, and press Space or Enter to paint or erase.
- Single-color fill workflow for focused logo drafting.
- SVG export in two modes:
  - `Merged`: unions adjacent filled cells and filled gaps into continuous vector paths.
  - `Separated`: keeps every filled cell or gap region as an independent path.
- Merged SVG union and browser-side SVG optimization are kept out of the drag hot path, keeping the editing surface light.

## Tech Stack

- Vite, React, TypeScript, pnpm
- Canvas for interactive grid rendering
- `polygon-clipping` for SVG union export
- `svgo/browser` for download-time SVG optimization
- Vitest for geometry and export unit tests
- Playwright for interaction, line-grid pixel checks, screenshot-diff, download, and SVG render checks

## Development

```bash
pnpm install
pnpm dev
```

Run checks:

```bash
pnpm test
pnpm build
pnpm test:e2e
```

## Project Structure

```text
src/domain/          Shared editor types and grid state helpers
src/shapes/          Shape registry and parallelogram geometry
src/svg/             SVG path generation, union export, and optimization
src/components/      React controls, Canvas editor, and SVG preview
tests/               Playwright end-to-end checks
```

## Design Notes

React owns UI controls and state. Canvas owns high-frequency grid rendering, so larger grids do not create hundreds or thousands of DOM nodes. Shape behavior is isolated behind a shape registry so future square, rectangle, triangle, or other vector units can add their own control schema and geometry without rewriting the editor shell.
