/**
 * Offers to put Daroon on the home screen. On first open on a phone a sheet explains how: Android/Chrome gets the
 * browser's own install dialog, iOS gets the Share → Add to Home Screen steps, in-app browsers are told to open the
 * page in a real browser. Desktop just keeps using the web version; the account sheet has a row to come back here.
 */
import { $ } from '../core/util';
import { S } from '../state/app';
import { DB, persist } from '../state/store';
import { IC } from '../ui/icons';
import { closeSheet, openSheet } from '../ui/sheets';
import { toast } from '../ui/toast';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'ios' | 'android' | 'inapp' | 'desktop';

let deferred: InstallPromptEvent | null = null;

function platform(): Platform {
  const ua = navigator.userAgent;
  if (/Instagram|FBAN|FBAV|Line\/|Twitter|Snapchat/i.test(ua)) return 'inapp';
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

export const installed = (): boolean =>
  matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

/** Whether there is anything to offer on this device: a phone in the browser, or a browser that can install. */
export const canInstall = (): boolean => !installed() && (platform() !== 'desktop' || !!deferred);

const SHARE =
  '<svg class="ic" viewBox="0 0 24 24" aria-label="اشتراک‌گذاری"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M7 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
const MENU =
  '<svg class="ic" viewBox="0 0 24 24" aria-label="منو"><circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/></svg>';

function installHTML(): string {
  const p = platform();
  const top = `<div class="sheet-top"><h2 class="ed" style="font-size:24px" tabindex="-1" data-autofocus>درون روی گوشیت</h2><button class="ib" data-act="closeSheet" aria-label="بستن">${IC.close}</button></div>`;
  const intro =
    '<p class="fine">بذارش روی صفحه‌ی اصلی؛ مثل یه برنامه، تمام‌صفحه باز می‌شه و ردپاهات همون‌جا می‌مونن.</p>';
  const later = '<button class="quiet" data-act="closeSheet">فعلاً توی مرورگر ادامه می‌دم</button>';
  const steps = (items: string[]) => `<ol class="install-steps">${items.map((s) => `<li>${s}</li>`).join('')}</ol>`;
  let body: string;
  if (deferred) body = `<button class="primary" data-act="installNow">نصب</button>${later}`;
  else if (p === 'ios')
    body =
      steps([
        `دکمه‌ی اشتراک‌گذاری ${SHARE} رو بزن (پایین صفحه، توی آیپد بالا).`,
        'برو پایین و <b>Add to Home Screen</b> رو بزن.',
        'بالای صفحه <b>Add</b> رو بزن.',
      ]) + later;
  else if (p === 'android')
    body = steps([`منوی مرورگر ${MENU} رو باز کن.`, '<b>Install app</b> یا <b>Add to Home screen</b> رو بزن.']) + later;
  else if (p === 'inapp')
    body = `<p class="fine">از این‌جا نمی‌شه نصبش کرد. این صفحه رو توی Safari یا Chrome باز کن؛ معمولاً از منوی ${MENU} گزینه‌ی «باز کردن در مرورگر» هست.</p>${later}`;
  else body = `<p class="fine">روی کامپیوتر، همین نسخه‌ی وب رو استفاده کن.</p>${later}`;
  return `${top}<div class="sheet-scroll set auth install">${intro}${body}</div>`;
}

export function openInstall() {
  DB.settings.installOffered = true;
  persist({ quiet: true });
  openSheet('install', installHTML(), 'نصب درون');
}

export async function installNow() {
  if (!deferred) return openInstall();
  const ev = deferred;
  deferred = null;
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  closeSheet();
  if (outcome === 'dismissed') toast('باشه؛ هر وقت خواستی از صفحه‌ی حساب نصبش کن.');
}

/** Listens for the browser's install offer and, on a phone's first visit, opens the sheet once. */
export function setupInstall(opts: { auto: boolean }) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    if (S.sheet === 'install') {
      const sh = $('#layer .sheet');
      if (sh) sh.innerHTML = `<span class="grab" aria-hidden="true"></span>${installHTML()}`;
    }
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    if (S.sheet === 'install') closeSheet();
    toast('درون روی صفحه‌ی اصلی گوشیت نشست.');
  });
  if (!opts.auto || installed() || DB.settings.installOffered || platform() === 'desktop') return;
  // after the first screen has arrived, and only if nothing else is open; Chrome's offer usually lands by then
  setTimeout(() => {
    if (!S.sheet && !S.story && !S.done && ['login', 'today'].includes(S.view)) openInstall();
  }, 2200);
}
