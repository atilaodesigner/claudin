import type { ModelBuilder } from '../ModelBuilder';
import type { TextureAtlas } from '../../rendering/TextureAtlas';

export interface ModelContext {
  atlas: TextureAtlas;
}

export type ModelFn = (b: ModelBuilder, ctx: ModelContext) => void;
