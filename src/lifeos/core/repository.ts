import { createEmptyLifeOSState, type LifeOSState } from './state';
import type { ID, LifeEntity, Relation } from './types';

export interface LifeOSStorageAdapter {
  load(): Promise<LifeOSState | null>;
  save(state: LifeOSState): Promise<void>;
}

export class LocalStorageAdapter implements LifeOSStorageAdapter {
  constructor(private key='life-os-state-v1') {}
  async load() { const raw=localStorage.getItem(this.key); return raw ? JSON.parse(raw) as LifeOSState : null; }
  async save(state:LifeOSState) { localStorage.setItem(this.key, JSON.stringify(state)); }
}

export class LifeOSRepository {
  private state: LifeOSState = createEmptyLifeOSState();
  constructor(private storage:LifeOSStorageAdapter) {}
  async init(){ this.state=(await this.storage.load()) ?? createEmptyLifeOSState(); return this.state; }
  snapshot(){ return structuredClone(this.state); }
  get<T extends LifeEntity=LifeEntity>(id:ID){ return this.state.entities[id] as T|undefined; }
  list(type?:LifeEntity['type']){ const all=Object.values(this.state.entities); return type ? all.filter(e=>e.type===type) : all; }
  async upsert(entity:LifeEntity){ this.state.entities[entity.id]=entity; this.reindex(); await this.storage.save(this.state); return entity; }
  async remove(id:ID, hard=false){ const e=this.state.entities[id]; if(!e)return; if(hard) delete this.state.entities[id]; else this.state.entities[id]={...e,deletedAt:new Date().toISOString()} as LifeEntity; this.reindex(); await this.storage.save(this.state); }
  async relate(relation:Relation){ this.state.relations[relation.id]=relation; this.reindex(); await this.storage.save(this.state); return relation; }
  private reindex(){ const byType:Record<string,ID[]>={}, byTag:Record<ID,ID[]>={}, children:Record<ID,ID[]>={}, backlinks:Record<ID,ID[]>={}; for(const e of Object.values(this.state.entities)){ (byType[e.type]??=[]).push(e.id); for(const tag of e.tags??[]) (byTag[tag]??=[]).push(e.id); const parent=(e as {parentTaskId?:ID}).parentTaskId; if(parent)(children[parent]??=[]).push(e.id); } for(const r of Object.values(this.state.relations)){ (backlinks[r.toId]??=[]).push(r.fromId); } this.state.indexes={byType,byTag,children,backlinks}; }
}
