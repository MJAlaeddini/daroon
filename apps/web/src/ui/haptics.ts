/**
 * A light tick under the finger for the moments that matter: choosing a word, a chip or an answer, saving, moving
 * between tabs. Android phones feel it; elsewhere `vibrate` is missing and nothing happens. Quiet when the person
 * asked for calm motion.
 */
import { DB } from '../state/store';

const TICK =
  '.word, .nm, .chip, .rf, .stone, .sug, .seg button, .wk-day, [data-act=verdict], [data-act=save], [data-go]';

export function haptic(ms = 8) {
  if (DB.settings.motion === 'calm') return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* some browsers throw outside a user gesture */
  }
}

export function setupHaptics() {
  if (!('vibrate' in navigator)) return;
  document.addEventListener(
    'pointerup',
    (e) => {
      if (e.pointerType !== 'touch') return;
      const el = (e.target as Element | null)?.closest?.(TICK);
      if (el && !(el as HTMLButtonElement).disabled && el.getAttribute('aria-disabled') !== 'true')
        haptic(el.matches('[data-act=save]') ? 14 : 8);
    },
    { passive: true },
  );
}
