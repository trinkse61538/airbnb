import { useEffect, useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';

export function NetworkStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    const updateHandler = () => setUpdateReady(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('pwa-update-ready', updateHandler);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('pwa-update-ready', updateHandler);
    };
  }, []);

  if (online && !updateReady) return null;

  return (
    <div className={`sticky top-[53px] z-30 flex items-center justify-center gap-2 px-3 py-2 text-center text-[10px] font-bold sm:top-[73px] ${
      updateReady
        ? 'bg-indigo-600 text-white'
        : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
    }`}>
      {updateReady ? <RefreshCw className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      <span>{updateReady ? 'A new version is ready.' : 'You are offline. Showing data saved on this device.'}</span>
      {updateReady && (
        <button type="button" onClick={() => window.location.reload()} className="rounded-md bg-white/15 px-2 py-1 underline underline-offset-2">
          Update now
        </button>
      )}
    </div>
  );
}
