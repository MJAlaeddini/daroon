import { $, $$, esc } from '../core/util';
import { ApiError, api } from '../net/api';
import { isDark } from '../sculpture/engine';
import { resetSync, syncNow } from './sync';
import { NEUTRAL_PAL, palFor } from '../domain/lexicon';
import { S } from '../state/app';
import { DB, persist, reindex, visible } from '../state/store';
import { IC } from '../ui/icons';
import { renderView } from '../ui/render';
import { closeSheet, openSheet } from '../ui/sheets';
import { toast } from '../ui/toast';

/* account */
export function initials(n){ n = (n || '').trim(); return n ? n[0] : ''; }
export function avatarHTML(size = 34){
  const top = patternTopKey(), pal = top ? palFor(top) : NEUTRAL_PAL;
  const inner = DB.account ? `<span class="av-l">${esc(initials(DB.account.name))}</span>` : '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="9" r="3.6"/><path d="M5.5 19.5c1.3-3.3 3.8-5 6.5-5s5.2 1.7 6.5 5"/></svg>';
  return `<span class="avatar" style="width:${size}px;height:${size}px;--c0:${pal[0]};--c1:${pal[1]};--c2:${pal[2]}">${inner}</span>`;
}
export function patternTopKey(){ const c = new Map(); visible().forEach(e => e.emotions.forEach(x => c.set(x.key, (c.get(x.key) || 0) + 1))); let b = null, n = 0; c.forEach((v, k) => { if (v > n){ n = v; b = k; } }); return b; }
export function refreshAvatar(){ const b = $('#avatarBtn'); if (b){ b.innerHTML = avatarHTML(); b.setAttribute('aria-label', DB.account ? `حساب ${DB.account.name} و تنظیمات` : 'ورود و تنظیمات'); } }
/* ═════════════════════════ sign-in ═════════════════════════
   Two ways in: a six-digit code by email (works everywhere), or Google when the server has a client id.
   The login sheet has three steps: choose → email → code. */
export const authCfg = { google: null as string | null, known: false };
export async function loadAuthConfig(){
  try { const c = await api.authConfig(); authCfg.google = c.google; } catch (e){ authCfg.google = null; }
  authCfg.known = true; $$('[data-act="loginGoogle"]').forEach(b => { b.hidden = !authCfg.google; });
}
const login = { step: 'email', email: '', err: '', busy: false };
const errText = (e) => !(e instanceof ApiError) ? 'یه چیزی درست پیش نرفت. دوباره امتحان کن.'
  : e.offline ? 'به اینترنت وصل نیستی. وقتی وصل شدی دوباره امتحان کن.'
  : ({ code_wrong: 'این کد درست نیست.', code_expired: 'این کد دیگه کار نمی‌کنه؛ یه کد تازه بگیر.', too_many_codes: 'چند بار پشت هم کد گرفتی. یه کم بعد دوباره امتحان کن.',
       too_many_requests: 'چند بار پشت هم امتحان کردی. یه کم بعد دوباره بیا.', invalid_input: 'این نشونی ایمیل درست به نظر نمی‌رسه.', google_invalid: 'ورود با Google انجام نشد.' }[e.code] || 'یه چیزی درست پیش نرفت. دوباره امتحان کن.');
export function loginSheetHTML(){
  const top = t => `<div class="sheet-top"><h2 class="ed" style="font-size:24px" tabindex="-1" data-autofocus>${t}</h2><button class="ib" data-act="closeSheet" aria-label="بستن">${IC.close}</button></div>`;
  const err = login.err ? `<p class="auth-err" role="alert">${esc(login.err)}</p>` : '';
  if (login.step === 'google') return `${top('ورود با Google')}<div class="sheet-scroll set auth">
    <p class="fine">حساب Google ات رو انتخاب کن. فقط اسم و نشونی ایمیلت به درون داده می‌شه.</p><div id="gsiBtn" class="gsi"></div>${err}
    <button class="link" data-act="loginEmail">به جاش با ایمیل وارد شو</button></div>`;
  if (login.step === 'code') return `${top('کد رو بنویس')}<div class="sheet-scroll set auth">
    <p class="fine">یه کد شش‌رقمی به <bdi dir="ltr">${esc(login.email)}</bdi> فرستادیم.</p>
    <form class="authform" data-form="loginCode" novalidate>
      <label for="loginCode">کد</label><input class="inp code" id="loginCode" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" dir="ltr" pattern="[0-9۰-۹]*" required>
      <label for="loginName">اسمی که صدات کنیم <small>(اختیاری)</small></label><input class="inp" id="loginName" name="name" maxlength="24" autocomplete="given-name">
      ${err}<button class="primary" type="submit" ${login.busy ? 'disabled' : ''}>${login.busy ? 'یه لحظه…' : 'ورود'}</button></form>
    <div class="btnrow"><button class="link" data-act="loginResend">فرستادن دوباره</button><button class="link" data-act="loginEmail">تغییر ایمیل</button></div></div>`;
  return `${top('ورود با ایمیل')}<div class="sheet-scroll set auth">
    <p class="fine">نشونی ایمیلت رو بنویس؛ یه کد شش‌رقمی برات می‌فرستیم. رمز لازم نیست.</p>
    <form class="authform" data-form="loginEmail" novalidate>
      <label for="loginEmailInput">ایمیل</label><input class="inp" id="loginEmailInput" name="email" type="email" inputmode="email" autocomplete="email" dir="ltr" value="${esc(login.email)}" required>
      ${err}<button class="primary" type="submit" ${login.busy ? 'disabled' : ''}>${login.busy ? 'یه لحظه…' : 'فرستادن کد'}</button></form>
    ${authCfg.google ? '<button class="link" data-act="loginGoogle">ورود با Google</button>' : ''}</div>`;
}
function refreshLogin(){ const sh = $('#layer .sheet'); if (!sh || S.sheet !== 'login') return; sh.innerHTML = `<span class="grab" aria-hidden="true"></span>${loginSheetHTML()}`;
  const f = sh.querySelector('#loginCode') || sh.querySelector('#loginEmailInput') || sh.querySelector('[data-autofocus]'); f && f.focus({ preventScroll: true });
  if (login.step === 'google') mountGoogle(); }
export function openLogin(step = 'email'){ login.step = step; login.err = ''; login.busy = false;
  openSheet('login', loginSheetHTML(), 'ورود'); if (step === 'google') mountGoogle(); }
export function loginStep(step){ login.step = step; login.err = ''; refreshLogin(); }

export async function submitEmail(email){
  email = (email || '').trim(); login.email = email;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ login.err = 'این نشونی ایمیل درست به نظر نمی‌رسه.'; refreshLogin(); return; }
  login.busy = true; login.err = ''; refreshLogin();
  try { await api.requestCode(email); login.step = 'code'; } catch (e){ login.err = errText(e); }
  login.busy = false; refreshLogin();
}
const toLatin = s => String(s || '').replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '');
export async function submitCode(code, name){
  code = toLatin(code); if (code.length !== 6){ login.err = 'کد شش رقمه.'; refreshLogin(); return; }
  login.busy = true; login.err = ''; refreshLogin();
  try { const { account } = await api.verifyCode(login.email, code, (name || '').trim() || undefined); await signedIn(account); }
  catch (e){ login.busy = false; login.err = errText(e); refreshLogin(); }
}
export async function resendCode(){ await submitEmail(login.email); if (!login.err) toast('یه کد تازه فرستادیم.'); }

/* Google Identity Services: the official button, rendered into the sheet. */
let gsiLoading: Promise<any> | null = null;
function loadGsi(){
  if ((window as any).google?.accounts?.id) return Promise.resolve((window as any).google);
  if (!gsiLoading) gsiLoading = new Promise((ok, fail) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => ok((window as any).google); s.onerror = () => { gsiLoading = null; fail(new Error('gsi')); }; document.head.appendChild(s); });
  return gsiLoading;
}
async function mountGoogle(){
  if (!authCfg.google) return;
  try {
    const g = await loadGsi(); const host = $('#gsiBtn'); if (!host) return;
    g.accounts.id.initialize({ client_id: authCfg.google, ux_mode: 'popup', callback: async (r) => {
      try { const { account } = await api.google(r.credential); await signedIn(account); } catch (e){ login.err = errText(e); refreshLogin(); } } });
    g.accounts.id.renderButton(host, { theme: isDark() ? 'filled_black' : 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'fa', width: Math.min(320, host.clientWidth || 320) });
  } catch (e){ login.err = 'Google در دسترس نیست. می‌تونی با ایمیل وارد شی.'; refreshLogin(); }
}

/** After any successful sign-in: remember the account, push this device's entries, pull the rest. */
export async function signedIn(account){
  const first = !DB.account || DB.account.id !== account.id;
  if (first) resetSync();
  DB.account = account; DB.loginDone = true; persist({ quiet: true });
  refreshAvatar(); closeSheet(true); S.prev = []; S.view = 'today'; renderView();
  toast(account.name ? `خوش اومدی، ${esc(account.name)}.` : 'وارد شدی.');
  await syncNow();
  pullStories();
}
export async function pullStories(){
  try { const { stories } = await api.stories();
    for (const st of stories){ const old = DB.stories.find(x => x.week === st.week); if (!old || old.createdAt < st.createdAt) DB.stories = DB.stories.filter(x => x.week !== st.week).concat({ ...st, seen: old ? old.seen : false }); }
    persist({ quiet: true });
  } catch (e){}
}
export async function signOut(){
  try { await api.logout(); } catch (e){}
  DB.account = null; DB.loginDone = false; resetSync(); persist({ quiet: true });
  refreshAvatar(); closeSheet(true); S.prev = []; S.view = 'login'; renderView();
}
export async function deleteAccount(){
  try { await api.deleteAccount(); } catch (e){ toast(errText(e)); return; }
  DB.account = null; DB.loginDone = false; resetSync(); DB.entries = DB.entries.filter(e => e.demo); DB.stories = []; persist({ quiet: true }); reindex();
  refreshAvatar(); closeSheet(true); S.prev = []; S.view = 'login'; renderView(); toast('حسابت و همه‌ی ردپاهاش پاک شد.');
}
export function sessionExpired(){
  if (!DB.account) return; DB.account = null; resetSync(); persist({ quiet: true }); refreshAvatar();
  toast('نشست ورودت تموم شده؛ ردپاها روی همین دستگاه می‌مونن. برای همگام‌سازی دوباره وارد شو.');
}
