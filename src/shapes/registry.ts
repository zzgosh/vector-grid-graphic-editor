import { parallelogramShape } from './parallelogram';

export const shapeRegistry = {
  parallelogram: parallelogramShape,
};

export type ShapeId = keyof typeof shapeRegistry;
