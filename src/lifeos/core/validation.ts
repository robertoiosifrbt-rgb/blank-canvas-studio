import type { LifeEntity, Task } from './types';
export interface ValidationIssue { path:string; message:string; }
export const validateEntity=(entity:LifeEntity):ValidationIssue[]=>{ const issues:ValidationIssue[]=[]; if(!entity.id)issues.push({path:'id',message:'Required'}); if(!entity.title?.trim())issues.push({path:'title',message:'Required'}); if(entity.type==='task'){ const t=entity as Task; if(t.time?.startAt&&t.time?.endAt&&new Date(t.time.endAt)<=new Date(t.time.startAt)) issues.push({path:'time.endAt',message:'Must be after startAt'}); } return issues; };
