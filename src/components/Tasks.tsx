import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Plus, CheckCircle2, Circle, ChevronDown, Pin, Zap } from 'lucide-react';

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
}

export const Tasks = () => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('tasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('categories');
    return saved ? JSON.parse(saved) : ['Work', 'Personal', 'Shopping'];
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    dueDate: '',
    priority: 'medium' as Priority,
    category: 'Personal',
  });
  const [newCategory, setNewCategory] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);

  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('categories', JSON.stringify(categories));
  }, [categories]);

  const addTask = () => {
    if (formData.name.trim()) {
      const newTask: Task = {
        id: Date.now().toString(),
        name: formData.name,
        description: formData.description,
        dueDate: formData.dueDate,
        completed: false,
        priority: formData.priority,
        category: formData.category,
        subtasks: [],
        pinned: false,
      };
      setTasks([newTask, ...tasks]);
      setFormData({
        name: '',
        description: '',
        dueDate: '',
        priority: 'medium',
        category: 'Personal',
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
    setTasks(
      tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: [...t.subtasks, { id: Date.now().toString(), name: subtaskName, completed: false }],
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
    if (newCategory.trim() && !categories.includes(newCategory)) {
      setCategories([...categories, newCategory]);
      setNewCategory('');
      setShowNewCategoryInput(false);
    }
  };

  const filteredTasks =
    selectedCategory === 'all'
      ? tasks
      : selectedCategory === 'pinned'
        ? tasks.filter((t) => t.pinned)
        : tasks.filter((t) => t.category === selectedCategory);

  const pinnedTasks = filteredTasks.filter((t) => t.pinned && !t.completed);
  const pendingTasks = filteredTasks.filter((t) => !t.pinned && !t.completed);
  const completedTasks = filteredTasks.filter((t) => t.completed);

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
          <div className="grid grid-cols-2 gap-4">
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="low">{t('low')}</option>
              <option value="medium">{t('medium')}</option>
              <option value="high">{t('high')}</option>
            </select>
          </div>
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

          {task.subtasks.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-sm font-medium text-gray-700">{t('subtasks')}</p>
              {task.subtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-2 text-sm ml-4">
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
          {task.subtasks.length > 0 && (
            <button
              onClick={onToggleExpand}
              className="text-gray-400 hover:text-blue-500 p-1"
            >
              <ChevronDown size={20} className={expanded ? 'rotate-180' : ''} />
            </button>
          )}
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
