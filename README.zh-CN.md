# Vector Grid Graphic Editor

[English](./README.md) | 中文

这是一个纯前端的矢量网格图形编辑器，用于通过可配置的平行四边形网格快速构造 Logo / 标志类图形。

## 当前功能

- 默认 `16 x 16` 平行四边形网格，并支持调整行数和列数。
- 平行四边形专属控制项：
  - 单元宽度
  - 单元高度
  - 左右边斜切 / 上下边斜切
  - 正向 / 反向斜切
  - 斜切角度
  - 横向 gap 开关和值
  - 纵向 gap 开关和值
- 未填充区域采用线框网格表现：白底 + 灰色矢量网格线，避免浅灰色块占据视觉。
- 支持点击填充、按住鼠标拖拽涂抹、橡皮擦模式。
- 支持在 `Cells` 和 `Gaps` 之间切换填充目标；当横向和纵向 gap 同时开启时，也支持填充 gap 交叉区域。
- 支持键盘绘制：聚焦画布后，用方向键移动单元，用 Space 或 Enter 按当前工具填充或擦除。
- 首版采用单色填充，默认黑色，便于专注 Logo 草图构形。
- SVG 导出支持两种模式：
  - `Merged`：对相邻填充单元和已填充 gap 做 union 合并，导出连续矢量路径。
  - `Separated`：保留每个填充单元或 gap 区域为独立 path。
- Merged SVG union 和 SVG 优化都避开拖拽热路径，避免拖慢编辑器首屏和涂抹反馈。

## 技术方案

- Vite + React + TypeScript + pnpm
- Canvas 负责高频网格渲染和交互反馈
- React 负责控制面板、状态和导出入口
- `polygon-clipping` 负责无分割线导出时的 polygon union
- `svgo/browser` 负责下载 SVG 时的优化
- Vitest 覆盖几何和导出逻辑
- Playwright 覆盖点击、拖拽、线框网格像素检查、截图差异、SVG 下载和 SVG 渲染

## 本地开发

```bash
pnpm install
pnpm dev
```

运行验证：

```bash
pnpm test
pnpm build
pnpm test:e2e
```

## 目录结构

```text
src/domain/          编辑器共享类型和网格状态工具
src/shapes/          图形注册表和平行四边形几何逻辑
src/svg/             SVG path 生成、union 导出和优化
src/components/      React 控制面板、Canvas 编辑器、SVG 预览
tests/               Playwright 端到端测试
```

## 扩展思路

当前首版只实现平行四边形，但控制项已经按 shape registry 的方式组织。后续增加正方形、长方形、正三角形、倒三角形等图形时，可以让每种图形声明自己的控制项、polygon 生成逻辑和命中检测逻辑，而不是把所有字段硬编码到主编辑器里。
