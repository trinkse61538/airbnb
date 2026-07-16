import { useEffect, useState } from 'react';
import { Download, RefreshCw, WifiOff } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches,
  );

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstallPrompt(null);
    return choice.outcome === 'accepted';
  };

  return { canInstall: !!installPrompt && !isInstalled, isInstalled, install };
}

export function InstallAppButton({ compact = false }: { compact?: boolean }) {
  const { canInstall, install } = usePWAInstall();
  if (!canInstall) return null;

  return (
    <button
      type="button"
      onClick={() => void install()}
      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 p-2 text-[11px] font-extrabold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900"
      title="Install app"
    >
      <Download className="h-4 w-4" />
      {!compact && <span>Install app</span>}
    </button>
  );
}

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
