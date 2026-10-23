/**
 * Installs the service worker that keeps the app working offline. A new version waits until the
 * person chooses to load it.
 */
import { registerSW } from 'virtual:pwa-register';
import { toast } from './ui/toast';

export function setupPwa() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const update = registerSW({
    onNeedRefresh() {
      toast('نسخه‌ی تازه‌ی درون آماده‌ست.', { label: 'به‌روزرسانی', fn: () => update(true) });
    },
  });
}
