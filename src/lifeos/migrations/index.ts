import type { LifeOSState } from '../core/state';
export interface Migration { from:number; to:number; run(state:LifeOSState):LifeOSState; }
const migrations:Migration[]=[];
export const migrateLifeOSState=(state:LifeOSState,target:number)=>{ let current=state; while(current.schemaVersion<target){ const migration=migrations.find(m=>m.from===current.schemaVersion); if(!migration) throw new Error(`Missing migration from schema ${current.schemaVersion}`); current=migration.run(current); current.schemaVersion=migration.to; } return current; };
