import { $ } from '../core/util';

/* toast */
export let toastT;
export function toast(msg: string, action?: { label: string; fn: () => void }) {
  const host = $('#toast');
  clearTimeout(toastT);
  toast.at = Date.now();
  host.innerHTML = `<div class="toast"><span>${msg}</span>${action ? `<button data-act="toastAct">${action.label}</button>` : ''}</div>`;
  toast.fn = action ? action.fn : null;
  toastT = setTimeout(
    () => {
      const t = host.firstElementChild;
      if (t) {
        t.classList.add('out');
        setTimeout(() => t.remove(), 300);
      }
    },
    action ? 6500 : 3800,
  );
}

toast.at = 0;
toast.fn = null as null | (() => void);
