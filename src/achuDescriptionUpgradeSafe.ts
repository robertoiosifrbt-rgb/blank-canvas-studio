import { ACHU_BACKLOG_GROUPS, ACHU_BACKLOG_TASKS } from './data/achuBacklog';
import { describeAchuTask } from './achuDescriptions';

type StoredTask = {
  id: string;
  name: string;
  description?: string;
  groupId?: string | null;
  children?: StoredTask[];
  [key: string]: unknown;
};

const VERSION_KEY = 'achuDescriptionsV3';

const groupNames = new Map<string, string>(
  (ACHU_BACKLOG_GROUPS as unknown as Array<{ id: string; name: string }>).map((group) => [group.id, group.name]),
);

const enrich = (task: StoredTask): StoredTask => ({
  ...task,
  description: describeAchuTask(task, task.groupId ? groupNames.get(task.groupId) || 'ACHU' : 'ACHU'),
  children: Array.isArray(task.children) ? task.children.map(enrich) : task.children,
});

export const upgradeAchuDescriptions = () => {
  try {
    if (localStorage.getItem(VERSION_KEY) === '1') return;

    const source = (ACHU_BACKLOG_TASKS as unknown as StoredTask[]).map(enrich);
    const sourceById = new Map(source.map((task) => [task.id, task]));
    const raw = localStorage.getItem('tasks');

    if (!raw) {
      localStorage.setItem('tasks', JSON.stringify(source));
      localStorage.setItem('achuTasksImportedV1', '1');
      localStorage.setItem(VERSION_KEY, '1');
      return;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    const upgraded = parsed.map((value) => {
      if (!value || typeof value !== 'object') return value;
      const task = value as StoredTask;
      const sourceTask = sourceById.get(task.id);
      if (!sourceTask || !task.id.startsWith('achu-')) return task;
      const nextDescription = describeAchuTask(task, task.groupId ? groupNames.get(task.groupId) || 'ACHU' : 'ACHU');
      return nextDescription === task.description ? task : { ...task, description: nextDescription };
    });

    localStorage.setItem('tasks', JSON.stringify(upgraded));
    localStorage.setItem(VERSION_KEY, '1');
  } catch {
    // Never block app startup because of legacy/local task data.
  }
};
