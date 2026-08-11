import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar as CalendarIcon, CheckSquare, ListChecks, Menu, X } from 'lucide-react';
import { Calendar, Events } from './components/Calendar';
import { Tasks } from './components/Tasks';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { bootstrapCloudState } from './cloudState';

type View = 'calendar' | 'tasks' | 'events';

function App() {
  const { t } = useTranslation();
  const [currentView, setCurrentView] = useState<View>('tasks');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    void bootstrapCloudState().catch(() => undefined).finally(() => setDataReady(true));
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let refreshing = false;
    const onControllerChange = () => { if (!refreshing) { refreshing = true; window.location.reload(); } };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    void navigator.serviceWorker.register('/sw.js').then((registration) => {
      const showUpdate = (worker: ServiceWorker | null) => { if (worker) { setWaitingWorker(worker); setUpdateAvailable(true); } };
      showUpdate(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate(worker);
        });
      });
      void registration.update();
    });
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, []);

  const installUpdate = () => {
    if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    else window.location.reload();
  };

  return (
    <div className="min-h-screen bg-white pb-20 md:pb-0">
      {updateAvailable && <div className="sticky top-0 z-[200] flex items-center justify-between gap-3 bg-blue-700 px-4 py-3 text-white"><span>Versiune nouă disponibilă</span><button onClick={installUpdate} className="rounded-lg bg-white px-4 py-2 font-semibold text-blue-700">Actualizează</button></div>}
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
              <button
                onClick={() => {
                  setCurrentView('events');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                  currentView === 'events'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <ListChecks size={20} />
                {t('tasks') === 'Sarcini' ? 'Evenimente' : 'Events'}
              </button>
              <LanguageSwitcher />
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8 py-0 sm:py-8">
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
              <button
                onClick={() => setCurrentView('events')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition font-medium ${
                  currentView === 'events'
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <ListChecks size={20} />
                {t('tasks') === 'Sarcini' ? 'Evenimente' : 'Events'}
              </button>
            </nav>
          </div>

          {/* Main content area */}
          <div className="lg:col-span-3">
            {!dataReady && <div className="rounded-xl bg-white p-8 text-center">Se încarcă datele…</div>}
            {dataReady && currentView === 'tasks' && <Tasks />}
            {dataReady && currentView === 'calendar' && <Calendar />}
            {dataReady && currentView === 'events' && <Events />}
          </div>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-[80] grid h-20 grid-cols-3 border-t border-gray-200 bg-white md:hidden">
        <button onClick={() => setCurrentView('tasks')} className={`flex flex-col items-center justify-center gap-1 text-xs font-medium ${currentView === 'tasks' ? 'text-gray-950' : 'text-gray-500'}`}>
          <CheckSquare size={24} className={currentView === 'tasks' ? 'fill-gray-950 text-gray-950' : ''} />
          {t('tasks')}
        </button>
        <button onClick={() => setCurrentView('calendar')} className={`flex flex-col items-center justify-center gap-1 text-xs font-medium ${currentView === 'calendar' ? 'text-gray-950' : 'text-gray-500'}`}>
          <CalendarIcon size={24} className={currentView === 'calendar' ? 'fill-gray-950 text-gray-950' : ''} />
          {t('calendar')}
        </button>
        <button onClick={() => setCurrentView('events')} className={`flex flex-col items-center justify-center gap-1 text-xs font-medium ${currentView === 'events' ? 'text-gray-950' : 'text-gray-500'}`}>
          <ListChecks size={24} className={currentView === 'events' ? 'fill-gray-950 text-gray-950' : ''} />
          {t('tasks') === 'Sarcini' ? 'Evenimente' : 'Events'}
        </button>
      </nav>
    </div>
  );
}

export default App;
