export const LIFE_OS_MODULES = [
  'today','areas','goals','projects','milestones','tasks','calendar','events','habits','routines',
  'notes','people','finance','assets','files','travel','home','health','learning','journal','reviews',
  'search','focus','timeTracking','analytics','automations','templates','notifications','integrations','ai'
] as const;
export type LifeOSModule = typeof LIFE_OS_MODULES[number];
export interface ModuleDefinition { id:LifeOSModule; enabled:boolean; route?:string; dependsOn?:LifeOSModule[]; }
export const moduleRegistry:ModuleDefinition[] = LIFE_OS_MODULES.map(id=>({id,enabled:true,route:`/${id}`}));
