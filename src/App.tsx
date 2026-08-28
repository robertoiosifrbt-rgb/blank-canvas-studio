import { useEffect, useState } from 'react';
import { Calendar, Events } from './components/Calendar';
import { Tasks } from './components/Tasks';
import { MyTasks } from './components/MyTasks';
import { bootstrapCloudState } from './cloudState';
import { LifeOSShell } from './lifeos/ui/LifeOSShell';
import { SkeletonScreen } from './lifeos/ui/SkeletonScreen';
import { getScreen, lifeOSScreens } from './lifeos/ui/screenRegistry';

const screenIds = new Set(lifeOSScreens.map((screen) => screen.id));

const screenFromHash = () => {
  const id = window.location.hash.replace(/^#\/?/, '');
  return screenIds.has(id) ? id : 'today';
};

function App() {
  const [currentScreen, setCurrentScreen] = useState(screenFromHash);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    void bootstrapCloudState().catch(() => undefined).finally(() => setDataReady(true));
  }, []);

  useEffect(() => {
    const onHashChange = () => setCurrentScreen(screenFromHash());
    window.addEventListener('hashchange', onHashChange);
    if (!window.location.hash) window.history.replaceState(null, '', '#/today');
    return () => window.removeEventListener('hashchange', onHashChange);
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

  const navigate = (id: string) => {
    if (!screenIds.has(id)) return;
    setCurrentScreen(id);
    if (window.location.hash !== `#/${id}`) window.location.hash = `/${id}`;
  };

  const installUpdate = () => {
    if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    else window.location.reload();
  };

  const renderScreen = () => {
    if (!dataReady) {
      return <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">Loading Life OS…</div>;
    }

    if (currentScreen === 'tasks') return <Tasks />;
    if (currentScreen === 'myTasks') return <MyTasks />;
    if (currentScreen === 'calendar') return <Calendar />;
    if (currentScreen === 'events') return <Events />;

    return <SkeletonScreen screen={getScreen(currentScreen)} onNavigate={navigate} />;
  };

  return (
    <>
      {updateAvailable && (
        <div className="sticky top-0 z-[200] flex items-center justify-between gap-3 bg-slate-950 px-4 py-3 text-white">
          <span>New version available</span>
          <button onClick={installUpdate} className="rounded-lg bg-white px-4 py-2 font-semibold text-slate-950">Update</button>
        </div>
      )}
      <LifeOSShell currentScreen={currentScreen} onNavigate={navigate}>
        {renderScreen()}
      </LifeOSShell>
    </>
  );
}

export default App;
