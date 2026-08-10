import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Plus, CheckCircle2, Circle, ChevronDown, Pin, Folder, FolderPlus } from 'lucide-react';

type Priority = 'high' | 'medium' | 'low';

interface Subtask {
  id: string;
  name: string;
  completed: boolean;
}

interface Task {
  id: string;
  name: string;
  description: string;
  dueDate: string;
  completed: boolean;
  priority: Priority;
  category: string;
  subtasks: Subtask[];
  pinned: boolean;
  groupId: string | null;
}

interface Group {
  id: string;
  name: string;
  parentId: string | null;
}

const DEFAULT_CATEGORIES = ['Work', 'Personal', 'Shopping'];

const loadTasks = (): Task[] => {
  try {
    const saved = localStorage.getItem('tasks');
    if (!saved) return [];

    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((task): task is Record<string, unknown> => Boolean(task) && typeof task === 'object')
      .map((task) => ({
        id: typeof task.id === 'string' ? task.id : crypto.randomUUID(),
        name: typeof task.name === 'string' ? task.name : '',
        description: typeof task.description === 'string' ? task.description : '',
        dueDate: typeof task.dueDate === 'string' ? task.dueDate : '',
        completed: Boolean(task.completed),
        priority: (
          task.priority === 'high' || task.priority === 'low' || task.priority === 'medium'
            ? task.priority
            : 'medium'
        ) as Priority,
        category: typeof task.category === 'string' && task.category ? task.category : 'Personal',
        subtasks: Array.isArray(task.subtasks)
          ? task.subtasks
              .filter((subtask): subtask is Record<string, unknown> =>
                Boolean(subtask) && typeof subtask === 'object'
              )
              .map((subtask) => ({
                id: typeof subtask.id === 'string' ? subtask.id : crypto.randomUUID(),
                name: typeof subtask.name === 'string' ? subtask.name : '',
                completed: Boolean(subtask.completed),
              }))
          : [],
        pinned: Boolean(task.pinned),
        groupId: typeof task.groupId === 'string' ? task.groupId : null,
      }))
      .filter((task) => task.name.trim().length > 0);
  } catch {
    return [];
  }
};

const loadGroups = (): Group[] => {
  try {
    const saved = localStorage.getItem('taskGroups');
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((group): group is Record<string, unknown> => Boolean(group) && typeof group === 'object')
      .filter((group) => typeof group.id === 'string' && typeof group.name === 'string')
      .map((group) => ({
        id: group.id as string,
        name: (group.name as string).trim(),
        parentId: typeof group.parentId === 'string' ? group.parentId : null,
      }))
      .filter((group) => group.name.length > 0);
  } catch {
    return [];
  }
};

const loadCategories = (): string[] => {
  try {
    const saved = localStorage.getItem('categories');
    if (!saved) return DEFAULT_CATEGORIES;

    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) return DEFAULT_CATEGORIES;

    const valid = parsed.filter(
      (category): category is string => typeof category === 'string' && category.trim().length > 0
    );
    return valid.length > 0 ? [...new Set(valid)] : DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
};

export const Tasks = () => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [categories, setCategories] = useState<string[]>(loadCategories);
  const [groups, setGroups] = useState<Group[]>(loadGroups);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', parentId: '' });
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    dueDate: '',
    priority: 'medium' as Priority,
    category: 'Personal',
    groupId: '',
  });
  const [newCategory, setNewCategory] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('tasks', JSON.stringify(tasks));
    } catch {
      // Keep the app usable when browser storage is unavailable or full.
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem('categories', JSON.stringify(categories));
    } catch {
      // Keep the app usable when browser storage is unavailable or full.
    }
  }, [categories]);

  useEffect(() => {
    try {
      localStorage.setItem('taskGroups', JSON.stringify(groups));
    } catch {
      // Keep the app usable when browser storage is unavailable or full.
    }
  }, [groups]);

  const addTask = () => {
    if (formData.name.trim()) {
      const newTask: Task = {
        id: Date.now().toString(),
        name: formData.name.trim(),
        description: formData.description.trim(),
        dueDate: formData.dueDate,
        completed: false,
        priority: formData.priority,
        category: formData.category,
        subtasks: [],
        pinned: false,
        groupId: formData.groupId || null,
      };
      setTasks([newTask, ...tasks]);
      setFormData({
        name: '',
        description: '',
        dueDate: '',
        priority: 'medium',
        category: 'Personal',
        groupId: '',
      });
      setShowForm(false);
    }
  };

  const toggleTask = (id: string) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const togglePin = (id: string) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)));
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id));
  };

  const addSubtask = (taskId: string, subtaskName: string) => {
    const name = subtaskName.trim();
    if (!name) return;

    setTasks((currentTasks) =>
      currentTasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: [...t.subtasks, { id: crypto.randomUUID(), name, completed: false }],
            }
          : t
      )
    );
  };

  const toggleSubtask = (taskId: string, subtaskId: string) => {
    setTasks(
      tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: t.subtasks.map((s) =>
                s.id === subtaskId ? { ...s, completed: !s.completed } : s
              ),
            }
          : t
      )
    );
  };

  const deleteSubtask = (taskId: string, subtaskId: string) => {
    setTasks(
      tasks.map((t) =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) }
          : t
      )
    );
  };

  const addCategory = () => {
    const category = newCategory.trim();
    if (category && !categories.some((item) => item.toLowerCase() === category.toLowerCase())) {
      setCategories([...categories, category]);
      setFormData((current) => ({ ...current, category }));
      setNewCategory('');
      setShowNewCategoryInput(false);
    }
  };

  const addGroup = () => {
    const name = groupForm.name.trim();
    if (!name) return;
    const newGroup: Group = {
      id: crypto.randomUUID(),
      name,
      parentId: groupForm.parentId || null,
    };
    setGroups((current) => [...current, newGroup]);
    setSelectedGroup(newGroup.id);
    setGroupForm({ name: '', parentId: '' });
    setShowGroupForm(false);
  };

  const descendantGroupIds = (groupId: string): Set<string> => {
    const ids = new Set<string>([groupId]);
    let changed = true;
    while (changed) {
      changed = false;
      groups.forEach((group) => {
        if (group.parentId && ids.has(group.parentId) && !ids.has(group.id)) {
          ids.add(group.id);
          changed = true;
        }
      });
    }
    return ids;
  };

  const categoryFilteredTasks =
    selectedCategory === 'all'
      ? tasks
      : selectedCategory === 'pinned'
        ? tasks.filter((t) => t.pinned)
        : tasks.filter((t) => t.category === selectedCategory);
  const filteredTasks =
    selectedGroup === 'all'
      ? categoryFilteredTasks
      : categoryFilteredTasks.filter((task) => {
          const visibleGroups = descendantGroupIds(selectedGroup);
          return task.groupId !== null && visibleGroups.has(task.groupId);
        });

  const pinnedTasks = filteredTasks.filter((t) => t.pinned && !t.completed);
  const pendingTasks = filteredTasks.filter((t) => !t.pinned && !t.completed);
  const completedTasks = filteredTasks.filter((t) => t.completed);
  const completedCount = tasks.filter((task) => task.completed).length;
  const progress = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-700 border-green-300';
    }
  };

  const getPriorityIcon = (priority: Priority) => {
    return priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{t('tasks')}</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
        >
          <Plus size={20} />
          {t('add_task')}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium">{completedCount} / {tasks.length} {t('completed').toLowerCase()}</span>
          <span className="font-bold text-blue-600">{progress}%</span>
        </div>
        <div
          className="h-3 w-full overflow-hidden rounded-full bg-gray-200"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Folder size={20} /> {t('groups')}
          </h3>
          <button
            onClick={() => setShowGroupForm((open) => !open)}
            className="flex items-center gap-2 bg-blue-500 text-white px-3 py-2 rounded-lg"
          >
            <FolderPlus size={18} /> {t('add_group')}
          </button>
        </div>
        {showGroupForm && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              value={groupForm.name}
              onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })}
              onKeyDown={(event) => event.key === 'Enter' && addGroup()}
              placeholder={t('group_name')}
              className="px-3 py-2 border rounded-lg"
              autoFocus
            />
            <select
              value={groupForm.parentId}
              onChange={(event) => setGroupForm({ ...groupForm, parentId: event.target.value })}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">{t('root_group')}</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
            <button onClick={addGroup} className="bg-blue-500 text-white rounded-lg px-3 py-2">
              {t('save')}
            </button>
          </div>
        )}
        <div className="space-y-1">
          <button
            onClick={() => setSelectedGroup('all')}
            className={`w-full text-left px-3 py-2 rounded-lg ${selectedGroup === 'all' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
          >
            {t('all_groups')}
          </button>
          <GroupTree groups={groups} tasks={tasks} parentId={null} selectedGroup={selectedGroup} onSelect={setSelectedGroup} depth={0} />
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <input
            type="text"
            placeholder={t('task_name')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            placeholder={t('description')}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-24"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 block mb-2">{t('due_date')}</label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-2">{t('priority')}</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
              <option value="low">{t('low')}</option>
              <option value="medium">{t('medium')}</option>
              <option value="high">{t('high')}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-2">{t('category')}</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-2">{t('group')}</label>
            <select
              value={formData.groupId}
              onChange={(event) => setFormData({ ...formData, groupId: event.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('no_group')}</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={addTask}
              className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
            >
              {t('save')}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setFormData({
                  name: '',
                  description: '',
                  dueDate: '',
                  priority: 'medium',
                  category: 'Personal',
                  groupId: '',
                });
              }}
              className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-full whitespace-nowrap transition ${
            selectedCategory === 'all'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 hover:bg-gray-300'
          }`}
        >
          {t('all_tasks')}
        </button>
        <button
          onClick={() => setSelectedCategory('pinned')}
          className={`px-4 py-2 rounded-full whitespace-nowrap transition ${
            selectedCategory === 'pinned'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 hover:bg-gray-300'
          }`}
        >
          {t('important')}
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-full whitespace-nowrap transition ${
              selectedCategory === cat
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            {cat}
          </button>
        ))}
        {showNewCategoryInput ? (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={t('new_category')}
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addCategory()}
              className="px-3 py-2 border rounded-lg text-sm"
              autoFocus
            />
            <button
              onClick={addCategory}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
            >
              {t('save')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewCategoryInput(true)}
            className="px-4 py-2 rounded-full whitespace-nowrap bg-gray-200 hover:bg-gray-300 transition flex items-center gap-2"
          >
            <Plus size={16} />
            {t('add_category')}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {pinnedTasks.length > 0 && (
          <div>
            <h3 className="font-semibold text-lg mb-3 text-red-600">📌 {t('pinned')}</h3>
            <div className="space-y-2">
              {pinnedTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  expanded={expandedTask === task.id}
                  onToggleExpand={() =>
                    setExpandedTask(expandedTask === task.id ? null : task.id)
                  }
                  onToggle={() => toggleTask(task.id)}
                  onTogglePin={() => togglePin(task.id)}
                  onDelete={() => deleteTask(task.id)}
                  onAddSubtask={(name) => addSubtask(task.id, name)}
                  onToggleSubtask={(id) => toggleSubtask(task.id, id)}
                  onDeleteSubtask={(id) => deleteSubtask(task.id, id)}
                  getPriorityColor={getPriorityColor}
                  getPriorityIcon={getPriorityIcon}
                  t={t}
                />
              ))}
            </div>
          </div>
        )}

        {pendingTasks.length > 0 && (
          <div>
            <h3 className="font-semibold text-lg mb-3 text-gray-700">{t('pending')}</h3>
            <div className="space-y-2">
              {pendingTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  expanded={expandedTask === task.id}
                  onToggleExpand={() =>
                    setExpandedTask(expandedTask === task.id ? null : task.id)
                  }
                  onToggle={() => toggleTask(task.id)}
                  onTogglePin={() => togglePin(task.id)}
                  onDelete={() => deleteTask(task.id)}
                  onAddSubtask={(name) => addSubtask(task.id, name)}
                  onToggleSubtask={(id) => toggleSubtask(task.id, id)}
                  onDeleteSubtask={(id) => deleteSubtask(task.id, id)}
                  getPriorityColor={getPriorityColor}
                  getPriorityIcon={getPriorityIcon}
                  t={t}
                />
              ))}
            </div>
          </div>
        )}

        {completedTasks.length > 0 && (
          <div>
            <h3 className="font-semibold text-lg mb-3 text-gray-700">{t('completed')}</h3>
            <div className="space-y-2">
              {completedTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  expanded={expandedTask === task.id}
                  onToggleExpand={() =>
                    setExpandedTask(expandedTask === task.id ? null : task.id)
                  }
                  onToggle={() => toggleTask(task.id)}
                  onTogglePin={() => togglePin(task.id)}
                  onDelete={() => deleteTask(task.id)}
                  onAddSubtask={(name) => addSubtask(task.id, name)}
                  onToggleSubtask={(id) => toggleSubtask(task.id, id)}
                  onDeleteSubtask={(id) => deleteSubtask(task.id, id)}
                  getPriorityColor={getPriorityColor}
                  getPriorityIcon={getPriorityIcon}
                  t={t}
                />
              ))}
            </div>
          </div>
        )}

        {filteredTasks.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>{t('no_tasks')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

const GroupTree = ({
  groups,
  tasks,
  parentId,
  selectedGroup,
  onSelect,
  depth,
}: {
  groups: Group[];
  tasks: Task[];
  parentId: string | null;
  selectedGroup: string;
  onSelect: (id: string) => void;
  depth: number;
}) => {
  const groupAndDescendants = (id: string): Set<string> => {
    const ids = new Set<string>([id]);
    groups.forEach((candidate) => {
      if (candidate.parentId && ids.has(candidate.parentId)) ids.add(candidate.id);
    });
    return ids;
  };

  return (
  <>
    {groups
      .filter((group) => group.parentId === parentId)
      .map((group) => (
        <div key={group.id}>
          {(() => {
            const ids = groupAndDescendants(group.id);
            const groupTasks = tasks.filter((task) => task.groupId && ids.has(task.groupId));
            const done = groupTasks.filter((task) => task.completed).length;
            const percent = groupTasks.length ? Math.round((done / groupTasks.length) * 100) : 0;
            return <button
            onClick={() => onSelect(group.id)}
            className={`w-full text-left py-2 pr-3 rounded-lg ${
              selectedGroup === group.id ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
            }`}
            style={{ paddingLeft: `${12 + depth * 20}px` }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2"><Folder size={17} /> {group.name}</span>
              <span className="text-xs font-semibold">{percent}%</span>
            </div>
            <ProgressBar value={percent} compact />
          </button>;
          })()}
          <GroupTree
            groups={groups}
            tasks={tasks}
            parentId={group.id}
            selectedGroup={selectedGroup}
            onSelect={onSelect}
            depth={depth + 1}
          />
        </div>
      ))}
  </>
  );
};

const ProgressBar = ({ value, compact = false }: { value: number; compact?: boolean }) => (
  <div
    className={`${compact ? 'h-1.5 mt-1' : 'h-2 mt-2'} w-full overflow-hidden rounded-full bg-gray-200`}
    role="progressbar"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={value}
  >
    <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${value}%` }} />
  </div>
);

interface TaskItemProps {
  task: Task;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggle: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onAddSubtask: (name: string) => void;
  onToggleSubtask: (id: string) => void;
  onDeleteSubtask: (id: string) => void;
  getPriorityColor: (priority: Priority) => string;
  getPriorityIcon: (priority: Priority) => string;
  t: (key: string) => string;
}

const TaskItem = ({
  task,
  expanded,
  onToggleExpand,
  onToggle,
  onTogglePin,
  onDelete,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  getPriorityColor,
  getPriorityIcon,
  t,
}: TaskItemProps) => {
  const [newSubtask, setNewSubtask] = useState('');
  const completedSubtasks = task.subtasks.filter((subtask) => subtask.completed).length;
  const taskProgress = task.subtasks.length
    ? Math.round((completedSubtasks / task.subtasks.length) * 100)
    : task.completed ? 100 : 0;

  return (
    <div
      className={`rounded-lg shadow-sm p-4 hover:shadow-md transition ${
        task.completed ? 'bg-gray-50' : 'bg-white'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={onToggle}
          className={task.completed ? 'text-green-500' : 'text-gray-400 hover:text-blue-500'}
        >
          {task.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p
              className={`font-medium ${
                task.completed ? 'line-through text-gray-500' : ''
              }`}
            >
              {task.name}
            </p>
            <span className={`text-sm px-2 py-1 rounded border ${getPriorityColor(task.priority)}`}>
              {getPriorityIcon(task.priority)} {t(task.priority)}
            </span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
              {task.category}
            </span>
          </div>

          {task.description && (
            <p className={`text-sm mt-2 ${task.completed ? 'text-gray-400' : 'text-gray-600'}`}>
              {task.description}
            </p>
          )}

          {task.dueDate && (
            <p className="text-xs text-gray-500 mt-1">
              📅 {new Date(task.dueDate).toLocaleDateString()}
            </p>
          )}

          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>{completedSubtasks}/{task.subtasks.length} {t('subtasks').toLowerCase()}</span>
              <span>{taskProgress}%</span>
            </div>
            <ProgressBar value={taskProgress} />
          </div>

          {task.subtasks.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-sm font-medium text-gray-700">{t('subtasks')}</p>
              {task.subtasks.map((subtask) => (
                <div key={subtask.id} className="ml-4 py-1">
                  <div className="flex items-center gap-2 text-sm">
                  <button
                    onClick={() => onToggleSubtask(subtask.id)}
                    className={subtask.completed ? 'text-green-500' : 'text-gray-400'}
                  >
                    {subtask.completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  </button>
                  <span className={subtask.completed ? 'line-through text-gray-400' : ''}>
                    {subtask.name}
                  </span>
                  <button
                    onClick={() => onDeleteSubtask(subtask.id)}
                    className="text-gray-400 hover:text-red-500 ml-auto"
                  >
                    <Trash2 size={14} />
                  </button>
                  </div>
                  <ProgressBar value={subtask.completed ? 100 : 0} compact />
                </div>
              ))}
            </div>
          )}

          {expanded && (
            <div className="mt-3 space-y-2 text-sm">
              <input
                type="text"
                placeholder={t('add_subtask')}
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && newSubtask.trim()) {
                    onAddSubtask(newSubtask);
                    setNewSubtask('');
                  }
                }}
                className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onToggleExpand}
            className="text-gray-400 hover:text-blue-500 p-1"
            aria-label={t('add_subtask')}
            title={t('add_subtask')}
          >
            <ChevronDown size={20} className={expanded ? 'rotate-180' : ''} />
          </button>
          <button
            onClick={onTogglePin}
            className={task.pinned ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}
          >
            <Pin size={20} />
          </button>
          <button
            onClick={onDelete}
            className="text-gray-400 hover:text-red-500"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
