import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2 } from 'lucide-react';
import { Calendar } from './components/Calendar';
import { MobileTasks } from './components/MobileTasks';
import { bootstrapCloudState } from './cloudState';

type View = 'tasks' | 'calendar';

function App() {
  const [view, setView] = useState<View>('tasks');
  const [ready, setReady] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    void bootstrapCloudState().catch(() => undefined).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let refreshing = false;
    const onControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    void navigator.serviceWorker.register('/sw.js').then((registration) => {
      const showUpdate = (worker: ServiceWorker | null) => {
        if (worker) {
          setWaitingWorker(worker);
          setUpdateAvailable(true);
        }
      };
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

  if (!ready) return <div className="grid min-h-[100dvh] place-items-center bg-white text-gray-500">Loading…</div>;

  return (
    <div className="min-h-[100dvh] bg-[#f4f4f5]">
      {updateAvailable && (
        <div className="fixed inset-x-0 top-0 z-[100] flex items-center justify-between bg-[#4c6fff] px-4 py-3 text-white">
          <span>New version available</span>
          <button onClick={installUpdate} className="rounded-lg bg-white px-4 py-2 font-semibold text-[#4c6fff]">Update</button>
        </div>
      )}

      {view === 'tasks' ? (
        <MobileTasks onOpenCalendar={() => setView('calendar')} />
      ) : (
        <div className="mx-auto min-h-[100dvh] max-w-3xl bg-[#f7f7f8] pb-24">
          <header className="sticky top-0 z-20 border-b bg-white px-5 py-5">
            <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          </header>
          <main className="p-4"><Calendar /></main>
          <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex h-[76px] max-w-3xl items-center justify-around border-t border-[#e5e5e5] bg-[#fbf9f9] px-3">
            <button onClick={() => setView('tasks')} className="flex flex-col items-center gap-1 text-[#707174]"><CheckCircle2 size={24} /><span className="text-xs">My tasks</span></button>
            <button className="flex flex-col items-center gap-1 font-semibold text-[#202124]"><CalendarDays size={24} fill="currentColor" /><span className="text-xs">Calendar</span></button>
          </nav>
        </div>
      )}
    </div>
  );
}

export default App;
