import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon, CheckSquare, Menu, X } from 'lucide-react';
import { Calendar } from './components/Calendar';
import { Tasks } from './components/Tasks';
import { LanguageSwitcher } from './components/LanguageSwitcher';

type View = 'calendar' | 'tasks';

function App() {
  const { t } = useTranslation();
  const [currentView, setCurrentView] = useState<View>('tasks');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-blue-600">{t('app_title')}</h1>
            <div className="hidden md:flex items-center gap-4">
              <LanguageSwitcher />
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pt-4 border-t space-y-3">
              <button
                onClick={() => {
                  setCurrentView('tasks');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                  currentView === 'tasks'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <CheckSquare size={20} />
                {t('tasks')}
              </button>
              <button
                onClick={() => {
                  setCurrentView('calendar');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                  currentView === 'calendar'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <CalendarIcon size={20} />
                {t('calendar')}
              </button>
              <LanguageSwitcher />
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar navigation */}
          <div className="hidden lg:block">
            <nav className="space-y-2 sticky top-24">
              <button
                onClick={() => setCurrentView('tasks')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${
                  currentView === 'tasks'
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <CheckSquare size={20} />
                {t('tasks')}
              </button>
              <button
                onClick={() => setCurrentView('calendar')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${
                  currentView === 'calendar'
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <CalendarIcon size={20} />
                {t('calendar')}
              </button>
            </nav>
          </div>

          {/* Main content area */}
          <div className="lg:col-span-3">
            {currentView === 'tasks' && <Tasks />}
            {currentView === 'calendar' && <Calendar />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
