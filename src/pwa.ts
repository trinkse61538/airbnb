import { publicUrl } from './utils/publicUrl';

export function registerPWA() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(publicUrl('sw.js'), { scope: import.meta.env.BASE_URL })
      .then(registration => {
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new Event('pwa-update-ready'));
            }
          });
        });

        window.setInterval(() => void registration.update(), 60 * 60 * 1000);
      })
      .catch(error => console.warn('PWA service worker registration failed:', error));
  });
}
