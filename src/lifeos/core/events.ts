export interface LifeOSEvent<T=unknown>{ name:string; payload:T; at:string; }
export type LifeOSEventHandler<T=unknown>=(event:LifeOSEvent<T>)=>void|Promise<void>;

export class LifeOSEventBus {
  private handlers=new Map<string,Set<LifeOSEventHandler>>();
  on(name:string,handler:LifeOSEventHandler){ const set=this.handlers.get(name)??new Set(); set.add(handler); this.handlers.set(name,set); return ()=>set.delete(handler); }
  async emit<T>(name:string,payload:T){ const event:LifeOSEvent<T>={name,payload,at:new Date().toISOString()}; for(const h of this.handlers.get(name)??[]) await h(event); }
}
