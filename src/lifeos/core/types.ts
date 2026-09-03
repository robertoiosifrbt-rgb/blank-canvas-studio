export type ID = string;
export type ISODate = string;

export type LifeEntityType =
  | 'area' | 'goal' | 'project' | 'milestone' | 'task' | 'event' | 'habit'
  | 'routine' | 'note' | 'person' | 'transaction' | 'asset' | 'file'
  | 'journal' | 'review' | 'tag' | 'calendar' | 'automation' | 'template';

export interface EntityBase {
  id: ID;
  type: LifeEntityType;
  title: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  archivedAt?: ISODate | null;
  deletedAt?: ISODate | null;
  tags?: ID[];
  metadata?: Record<string, unknown>;
}

export interface Relation {
  id: ID;
  fromId: ID;
  toId: ID;
  kind: string;
  createdAt: ISODate;
}

export interface TimeRange { startAt?: ISODate; endAt?: ISODate; allDay?: boolean; }
export interface Reminder { id: ID; at: ISODate; channel: 'local'|'push'|'email'; enabled: boolean; }
export type TaskStatus = 'inbox'|'todo'|'in_progress'|'waiting'|'done'|'cancelled';
export type Priority = 'none'|'low'|'medium'|'high'|'urgent';

export interface Area extends EntityBase { type:'area'; color?: string; icon?: string; }
export interface Goal extends EntityBase { type:'goal'; areaId?: ID; targetDate?: ISODate; progress?: number; }
export interface Project extends EntityBase { type:'project'; areaId?: ID; goalIds?: ID[]; status?: 'planned'|'active'|'paused'|'done'|'cancelled'; }
export interface Milestone extends EntityBase { type:'milestone'; projectId: ID; dueAt?: ISODate; completedAt?: ISODate; }
export interface Task extends EntityBase { type:'task'; projectId?: ID; areaId?: ID; parentTaskId?: ID; status:TaskStatus; priority:Priority; time?:TimeRange; reminders?:Reminder[]; estimateMinutes?:number; recurrenceRule?:string; dependencyIds?:ID[]; assigneeIds?:ID[]; }
export interface Event extends EntityBase { type:'event'; calendarId?:ID; time:TimeRange; reminders?:Reminder[]; location?:string; }
export interface Habit extends EntityBase { type:'habit'; areaId?:ID; schedule?:string; target?:number; unit?:string; }
export interface Routine extends EntityBase { type:'routine'; itemIds:ID[]; schedule?:string; }
export interface Note extends EntityBase { type:'note'; body:string; linkedEntityIds?:ID[]; }
export interface Person extends EntityBase { type:'person'; name:string; email?:string; phone?:string; birthday?:ISODate; }
export interface Transaction extends EntityBase { type:'transaction'; amount:number; currency:string; direction:'income'|'expense'; occurredAt:ISODate; category?:string; }
export interface Asset extends EntityBase { type:'asset'; category?:string; value?:number; currency?:string; renewalAt?:ISODate; }
export interface LifeFile extends EntityBase { type:'file'; url?:string; mimeType?:string; size?:number; linkedEntityIds?:ID[]; }
export interface JournalEntry extends EntityBase { type:'journal'; body:string; occurredAt:ISODate; }
export interface Review extends EntityBase { type:'review'; period:'daily'|'weekly'|'monthly'|'yearly'; from:ISODate; to:ISODate; body?:string; }
export interface Tag extends EntityBase { type:'tag'; color?:string; }
export interface CalendarEntity extends EntityBase { type:'calendar'; color?:string; }
export interface Automation extends EntityBase { type:'automation'; trigger:Record<string,unknown>; conditions?:Record<string,unknown>[]; actions:Record<string,unknown>[]; enabled:boolean; }
export interface Template extends EntityBase { type:'template'; targetType:LifeEntityType; payload:Record<string,unknown>; }

export type LifeEntity = Area|Goal|Project|Milestone|Task|Event|Habit|Routine|Note|Person|Transaction|Asset|LifeFile|JournalEntry|Review|Tag|CalendarEntity|Automation|Template;
