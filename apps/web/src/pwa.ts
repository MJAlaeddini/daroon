/**
 * Installs the service worker that keeps the app working offline. A new version waits until the
 * person chooses to load it.
 *
 * An installed app on a phone is rarely closed for good, so it would never look for a new version on its own: it
 * checks every half hour while open and whenever it comes back to the screen. When one is ready, a small pill
 * stays at the top until it is tapped (a toast would be gone before anyone noticed).
 */
import { registerSW } from 'virtual:pwa-register';

const CHECK_EVERY = 30 * 60 * 1000;

function showUpdate(apply: () => void) {
  if (document.querySelector('.upd')) return;
  const el = document.createElement('div');
  el.className = 'upd';
  el.setAttribute('role', 'status');
  el.innerHTML = '<span>نسخه‌ی تازه‌ی درون آماده‌ست</span><button type="button">به‌روزرسانی</button>';
  el.querySelector('button')!.addEventListener('click', () => {
    el.classList.add('busy');
    apply();
  });
  document.body.appendChild(el);
}

export function setupPwa() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const update = registerSW({
    onNeedRefresh() {
      showUpdate(() => update(true));
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => {
        if (navigator.onLine && !reg.installing) reg.update().catch(() => {});
      };
      setInterval(check, CHECK_EVERY);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });
}
