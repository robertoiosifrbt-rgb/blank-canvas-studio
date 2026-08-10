import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Plus, CheckCircle2, Circle } from 'lucide-react';

interface Task {
  id: string;
  name: string;
  dueDate: string;
  completed: boolean;
}

export const Tasks: React.FC = () => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('tasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', dueDate: '' });

  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }, [tasks]);

  const addTask = () => {
    if (formData.name.trim()) {
      const newTask: Task = {
        id: Date.now().toString(),
        name: formData.name,
        dueDate: formData.dueDate,
        completed: false,
      };
      setTasks([newTask, ...tasks]);
      setFormData({ name: '', dueDate: '' });
      setShowForm(false);
    }
  };

  const toggleTask = (id: string) => {
    setTasks(
      tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter((task) => task.id !== id));
  };

  const pendingTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

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
          <input
            type="date"
            value={formData.dueDate}
            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
                setFormData({ name: '', dueDate: '' });
              }}
              className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {pendingTasks.length > 0 && (
          <div>
            <h3 className="font-semibold text-lg mb-3 text-gray-700">{t('pending')}</h3>
            <div className="space-y-2">
              {pendingTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition"
                >
                  <button
                    onClick={() => toggleTask(task.id)}
                    className="text-gray-400 hover:text-blue-500 transition"
                  >
                    <Circle size={24} />
                  </button>
                  <div className="flex-1">
                    <p className="font-medium">{task.name}</p>
                    {task.dueDate && (
                      <p className="text-sm text-gray-500">
                        {new Date(task.dueDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-gray-400 hover:text-red-500 transition"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {completedTasks.length > 0 && (
          <div>
            <h3 className="font-semibold text-lg mb-3 text-gray-700">{t('completed')}</h3>
            <div className="space-y-2">
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 bg-gray-50 rounded-lg shadow-sm p-4 opacity-60"
                >
                  <button
                    onClick={() => toggleTask(task.id)}
                    className="text-green-500 hover:text-gray-500 transition"
                  >
                    <CheckCircle2 size={24} />
                  </button>
                  <div className="flex-1">
                    <p className="font-medium line-through text-gray-500">{task.name}</p>
                    {task.dueDate && (
                      <p className="text-sm text-gray-400">
                        {new Date(task.dueDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="text-gray-400 hover:text-red-500 transition"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tasks.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>{t('no_tasks')}</p>
          </div>
        )}
      </div>
    </div>
  );
};
