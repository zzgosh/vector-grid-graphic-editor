# Repository Guidance

## Project Scope

This is a frontend-only vector grid graphic editor. Keep geometry, SVG export, and React UI separated so future shape types can be added through the shape registry.

## Commands

```bash
pnpm test
pnpm build
pnpm test:e2e
```

## Implementation Notes

- Keep high-frequency drawing in Canvas, not React-rendered grid cells.
- Keep shape-specific controls in `src/shapes/`.
- Keep SVG optimization lazy-loaded so editing performance is not tied to SVGO bundle size.
- When changing geometry or export behavior, add or update unit tests before relying on Playwright coverage.
