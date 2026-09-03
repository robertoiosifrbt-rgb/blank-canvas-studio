import type { LifeEntity, LifeEntityType, ID } from './types';
import { LifeOSRepository } from './repository';
import { LifeOSEventBus } from './events';

const id=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();

export class EntityService {
  constructor(private repo:LifeOSRepository,private events:LifeOSEventBus){}
  async create<T extends LifeEntity>(type:LifeEntityType,input:Omit<T,'id'|'type'|'createdAt'|'updatedAt'>){ const entity={...input,id:id(),type,createdAt:now(),updatedAt:now()} as T; await this.repo.upsert(entity); await this.events.emit('entity.created',entity); return entity; }
  async patch<T extends LifeEntity>(idValue:ID,patch:Partial<T>){ const current=this.repo.get<T>(idValue); if(!current) throw new Error(`Entity ${idValue} not found`); const next={...current,...patch,id:current.id,type:current.type,updatedAt:now()} as T; await this.repo.upsert(next); await this.events.emit('entity.updated',next); return next; }
  async archive(idValue:ID){ return this.patch(idValue,{archivedAt:now()} as Partial<LifeEntity>); }
  async trash(idValue:ID){ await this.repo.remove(idValue); await this.events.emit('entity.trashed',{id:idValue}); }
}

export interface SearchProvider { search(query:string,scope?:LifeEntityType[]):Promise<ID[]>; }
export interface NotificationProvider { schedule(entityId:ID,at:string,message:string):Promise<void>; cancel(entityId:ID):Promise<void>; }
export interface SyncProvider { pull():Promise<void>; push():Promise<void>; }
export interface AutomationEngine { evaluate(eventName:string,payload:unknown):Promise<void>; }
export interface AnalyticsSink { track(name:string,payload?:Record<string,unknown>):void; }
