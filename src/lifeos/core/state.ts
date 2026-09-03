import type { ID, LifeEntity, Relation } from './types';

export interface LifeOSState {
  schemaVersion: number;
  entities: Record<ID, LifeEntity>;
  relations: Record<ID, Relation>;
  settings: Record<string, unknown>;
  indexes: {
    byType: Record<string, ID[]>;
    byTag: Record<ID, ID[]>;
    children: Record<ID, ID[]>;
    backlinks: Record<ID, ID[]>;
  };
}

export const LIFE_OS_SCHEMA_VERSION = 1;
export const createEmptyLifeOSState = (): LifeOSState => ({
  schemaVersion: LIFE_OS_SCHEMA_VERSION,
  entities: {}, relations: {}, settings: {},
  indexes: { byType:{}, byTag:{}, children:{}, backlinks:{} },
});
