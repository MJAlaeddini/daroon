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
export function initials(n) {
  n = (n || '').trim();
  return n ? n[0] : '';
}
export function avatarHTML(size = 34) {
  const top = patternTopKey(),
    pal = top ? palFor(top) : NEUTRAL_PAL;
  const inner = DB.account
    ? `<span class="av-l">${esc(initials(DB.account.name))}</span>`
    : '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="9" r="3.6"/><path d="M5.5 19.5c1.3-3.3 3.8-5 6.5-5s5.2 1.7 6.5 5"/></svg>';
  return `<span class="avatar" style="width:${size}px;height:${size}px;--c0:${pal[0]};--c1:${pal[1]};--c2:${pal[2]}">${inner}</span>`;
}
export function patternTopKey() {
  const c = new Map();
  visible().forEach((e) => e.emotions.forEach((x) => c.set(x.key, (c.get(x.key) || 0) + 1)));
  let b = null,
    n = 0;
  c.forEach((v, k) => {
    if (v > n) {
      n = v;
      b = k;
    }
  });
  return b;
}
export function refreshAvatar() {
  const b = $('#avatarBtn');
  if (b) {
    b.innerHTML = avatarHTML();
    b.setAttribute('aria-label', DB.account ? `حساب ${DB.account.name} و تنظیمات` : 'ورود و تنظیمات');
  }
}
/* ═════════════════════════ sign-in ═════════════════════════
   The main way in is a username and a password (nothing to wait for, no mail server needed). A six-digit code by
   email is offered where the server can send one, and Google where it has a client id.
   Sheet steps: password (sign up / sign in) · email → code · google. */
export const authCfg = { google: null as string | null, email: true, known: false };
export async function loadAuthConfig() {
  try {
    const c = await api.authConfig();
    authCfg.google = c.google;
    authCfg.email = c.email !== false;
  } catch (e) {
    authCfg.google = null;
  }
  authCfg.known = true;
  showAltWays();
}
function showAltWays() {
  $$('[data-act="loginGoogle"]').forEach((b) => {
    b.hidden = !authCfg.google;
  });
  $$('[data-act="loginEmail"]').forEach((b) => {
    b.hidden = !authCfg.email;
  });
  $$('.auth-alt').forEach((p) => {
    p.hidden = !authCfg.google && !authCfg.email;
  });
}
/** The way-in buttons, the same on the welcome page and on the account page. */
export function authButtonsHTML() {
  return `<button class="primary auth-main" data-act="loginSignup">ساختن حساب</button>
    <button class="gbtn" data-act="loginPassword">حساب دارم؛ ورود</button>
    ${altWaysHTML()}`;
}
function altWaysHTML() {
  return `<p class="auth-alt"${authCfg.google || authCfg.email ? '' : ' hidden'}><span>یا با</span>
    <button class="link" data-act="loginEmail"${authCfg.email ? '' : ' hidden'}>کد ایمیلی</button>
    <button class="link" data-act="loginGoogle"${authCfg.google ? '' : ' hidden'}>Google</button></p>`;
}
const login = {
  step: 'password',
  mode: 'signup' as 'signup' | 'login',
  email: '',
  user: '',
  err: '',
  busy: false,
  showPw: false,
};
const USERNAME = /^[a-z0-9._]{3,24}$/;
const errText = (e, invalid = 'این نشونی ایمیل درست به نظر نمی‌رسه.') =>
  !(e instanceof ApiError)
    ? 'یه چیزی درست پیش نرفت. دوباره امتحان کن.'
    : e.offline
      ? 'به اینترنت وصل نیستی. وقتی وصل شدی دوباره امتحان کن.'
      : {
          code_wrong: 'این کد درست نیست.',
          code_expired: 'این کد دیگه کار نمی‌کنه؛ یه کد تازه بگیر.',
          too_many_codes: 'چند بار پشت هم کد گرفتی. یه کم بعد دوباره امتحان کن.',
          too_many_requests: 'چند بار پشت هم امتحان کردی. یه کم بعد دوباره بیا.',
          invalid_input: invalid,
          google_invalid: 'ورود با Google انجام نشد.',
          username_taken: 'این نام کاربری رو کس دیگه‌ای برداشته؛ یکی دیگه امتحان کن.',
          login_wrong: 'نام کاربری یا رمز درست نیست.',
        }[e.code] || 'یه چیزی درست پیش نرفت. دوباره امتحان کن.';
export function loginSheetHTML() {
  const top = (t) =>
    `<div class="sheet-top"><h2 class="ed" style="font-size:24px" tabindex="-1" data-autofocus>${t}</h2><button class="ib" data-act="closeSheet" aria-label="بستن">${IC.close}</button></div>`;
  const err = login.err ? `<p class="auth-err" role="alert">${esc(login.err)}</p>` : '';
  if (login.step === 'password') {
    const up = login.mode === 'signup';
    const seg = (m, t) =>
      `<button type="button" data-act="loginMode" data-m="${m}" aria-pressed="${login.mode === m}">${t}</button>`;
    return `${top(up ? 'ساختن حساب' : 'ورود')}<div class="sheet-scroll set auth">
    <div class="seg auth-seg" role="group" aria-label="حساب">${seg('signup', 'حساب تازه')}${seg('login', 'حساب دارم')}</div>
    <form class="authform" data-form="loginPassword" novalidate>
      <label for="loginUser">نام کاربری</label>
      <input class="inp" id="loginUser" name="username" dir="ltr" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="24" value="${esc(login.user)}" required>
      ${up ? '<p class="auth-hint">با حروف انگلیسی، عدد، نقطه یا _</p>' : ''}
      <label for="loginPw">رمز</label>
      <div class="pw"><input class="inp" id="loginPw" name="password" type="${login.showPw ? 'text' : 'password'}" dir="ltr" autocomplete="${up ? 'new-password' : 'current-password'}" maxlength="128" required>
        <button type="button" class="pw-eye" data-act="pwToggle" aria-pressed="${login.showPw}">${login.showPw ? 'پنهان' : 'نمایش'}</button></div>
      ${up ? '<p class="auth-hint">دست‌کم هشت حرف. یادت بمونه؛ بدون ایمیل بازیابی نمی‌شه.</p>' : ''}
      ${up ? '<label for="loginName">اسمی که صدات کنیم <small>(اختیاری)</small></label><input class="inp" id="loginName" name="name" maxlength="24" autocomplete="given-name">' : ''}
      ${err}<button class="primary" type="submit" ${login.busy ? 'disabled' : ''}>${login.busy ? 'یه لحظه…' : up ? 'ساختن حساب' : 'ورود'}</button></form>
    ${altWaysHTML()}</div>`;
  }
  if (login.step === 'google')
    return `${top('ورود با Google')}<div class="sheet-scroll set auth">
    <p class="fine">حساب Google ات رو انتخاب کن. فقط اسم و نشونی ایمیلت به درون داده می‌شه.</p><div id="gsiBtn" class="gsi"></div>${err}
    <button class="link" data-act="loginPassword">به جاش با نام کاربری و رمز</button></div>`;
  if (login.step === 'code')
    return `${top('کد رو بنویس')}<div class="sheet-scroll set auth">
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
    <button class="link" data-act="loginPassword">با نام کاربری و رمز</button></div>`;
}
function refreshLogin() {
  const sh = $('#layer .sheet');
  if (!sh || S.sheet !== 'login') return;
  sh.innerHTML = `<span class="grab" aria-hidden="true"></span>${loginSheetHTML()}`;
  const f =
    sh.querySelector('#loginCode') ||
    sh.querySelector('#loginEmailInput') ||
    sh.querySelector('#loginUser') ||
    sh.querySelector('[data-autofocus]');
  f && f.focus({ preventScroll: true });
  if (login.step === 'google') mountGoogle();
}
export function openLogin(step = 'password', mode?: 'signup' | 'login') {
  login.step = step;
  if (mode) login.mode = mode;
  login.err = '';
  login.busy = false;
  login.showPw = false;
  openSheet('login', loginSheetHTML(), 'ورود');
  if (step === 'google') mountGoogle();
}
export function loginStep(step, mode?: 'signup' | 'login') {
  login.step = step;
  if (mode) login.mode = mode;
  login.err = '';
  refreshLogin();
}
export function loginMode(mode: 'signup' | 'login') {
  if (login.mode === mode) return;
  login.user = ($('#loginUser') as HTMLInputElement | null)?.value ?? login.user;
  login.mode = mode;
  login.err = '';
  refreshLogin();
}
/** Show or hide the password without losing what was typed or the caret. */
export function togglePassword() {
  login.showPw = !login.showPw;
  const inp = $('#loginPw') as HTMLInputElement | null,
    b = $('[data-act="pwToggle"]');
  if (inp) inp.type = login.showPw ? 'text' : 'password';
  if (b) {
    b.textContent = login.showPw ? 'پنهان' : 'نمایش';
    b.setAttribute('aria-pressed', String(login.showPw));
  }
  inp?.focus({ preventScroll: true });
}
export async function submitPassword(username: string, password: string, name: string) {
  const user = (username || '').trim().toLowerCase();
  login.user = user;
  const up = login.mode === 'signup';
  const fail = (m: string) => {
    login.err = m;
    refreshLogin();
  };
  if (!USERNAME.test(user))
    return fail(
      up
        ? 'نام کاربری فقط حروف انگلیسی، عدد، نقطه یا خط زیره؛ بین سه تا بیست‌وچهار حرف.'
        : 'نام کاربری یا رمز درست نیست.',
    );
  if (up && password.length < 8) return fail('رمز دست‌کم هشت حرفه.');
  if (!password) return fail('رمز رو بنویس.');
  login.busy = true;
  login.err = '';
  refreshLogin();
  try {
    const { account } = up
      ? await api.signup(user, password, (name || '').trim() || undefined)
      : await api.login(user, password);
    await signedIn(account);
  } catch (e) {
    login.busy = false;
    fail(errText(e, up ? 'نام کاربری یا رمز قابل قبول نیست.' : 'نام کاربری یا رمز درست نیست.'));
  }
}

export async function submitEmail(email) {
  email = (email || '').trim();
  login.email = email;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    login.err = 'این نشونی ایمیل درست به نظر نمی‌رسه.';
    refreshLogin();
    return;
  }
  login.busy = true;
  login.err = '';
  refreshLogin();
  try {
    await api.requestCode(email);
    login.step = 'code';
  } catch (e) {
    login.err = errText(e);
  }
  login.busy = false;
  refreshLogin();
}
const toLatin = (s) =>
  String(s || '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '');
export async function submitCode(code, name) {
  code = toLatin(code);
  if (code.length !== 6) {
    login.err = 'کد شش رقمه.';
    refreshLogin();
    return;
  }
  login.busy = true;
  login.err = '';
  refreshLogin();
  try {
    const { account } = await api.verifyCode(login.email, code, (name || '').trim() || undefined);
    await signedIn(account);
  } catch (e) {
    login.busy = false;
    login.err = errText(e);
    refreshLogin();
  }
}
export async function resendCode() {
  await submitEmail(login.email);
  if (!login.err) toast('یه کد تازه فرستادیم.');
}

/* Google Identity Services: the official button, rendered into the sheet. */
let gsiLoading: Promise<any> | null = null;
function loadGsi() {
  if ((window as any).google?.accounts?.id) return Promise.resolve((window as any).google);
  if (!gsiLoading)
    gsiLoading = new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => ok((window as any).google);
      s.onerror = () => {
        gsiLoading = null;
        fail(new Error('gsi'));
      };
      document.head.appendChild(s);
    });
  return gsiLoading;
}
async function mountGoogle() {
  if (!authCfg.google) return;
  try {
    const g = await loadGsi();
    const host = $('#gsiBtn');
    if (!host) return;
    g.accounts.id.initialize({
      client_id: authCfg.google,
      ux_mode: 'popup',
      callback: async (r) => {
        try {
          const { account } = await api.google(r.credential);
          await signedIn(account);
        } catch (e) {
          login.err = errText(e);
          refreshLogin();
        }
      },
    });
    g.accounts.id.renderButton(host, {
      theme: isDark() ? 'filled_black' : 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      locale: 'fa',
      width: Math.min(320, host.clientWidth || 320),
    });
  } catch (e) {
    login.err = 'Google در دسترس نیست. می‌تونی با نام کاربری و رمز وارد شی.';
    refreshLogin();
  }
}

/** After any successful sign-in: remember the account, push this device's entries, pull the rest. */
export async function signedIn(account) {
  const first = !DB.account || DB.account.id !== account.id;
  if (first) resetSync();
  DB.account = account;
  DB.loginDone = true;
  persist({ quiet: true });
  refreshAvatar();
  closeSheet(true);
  S.prev = [];
  S.view = 'today';
  renderView();
  toast(account.name ? `خوش اومدی، ${esc(account.name)}.` : 'وارد شدی.');
  await syncNow();
  pullStories();
}
export async function pullStories() {
  try {
    const { stories } = await api.stories();
    for (const st of stories) {
      const old = DB.stories.find((x) => x.week === st.week);
      if (!old || old.createdAt < st.createdAt)
        DB.stories = DB.stories.filter((x) => x.week !== st.week).concat({ ...st, seen: old ? old.seen : false });
    }
    persist({ quiet: true });
  } catch (e) {}
}
export async function signOut() {
  try {
    await api.logout();
  } catch (e) {}
  DB.account = null;
  DB.loginDone = false;
  resetSync();
  persist({ quiet: true });
  refreshAvatar();
  closeSheet(true);
  S.prev = [];
  S.view = 'login';
  renderView();
}
export async function deleteAccount() {
  try {
    await api.deleteAccount();
  } catch (e) {
    toast(errText(e));
    return;
  }
  DB.account = null;
  DB.loginDone = false;
  resetSync();
  DB.entries = DB.entries.filter((e) => e.demo);
  DB.stories = [];
  persist({ quiet: true });
  reindex();
  refreshAvatar();
  closeSheet(true);
  S.prev = [];
  S.view = 'login';
  renderView();
  toast('حسابت و همه‌ی ردپاهاش پاک شد.');
}
export function sessionExpired() {
  if (!DB.account) return;
  DB.account = null;
  resetSync();
  persist({ quiet: true });
  refreshAvatar();
  toast('نشست ورودت تموم شده؛ ردپاها روی همین دستگاه می‌مونن. برای همگام‌سازی دوباره وارد شو.');
}
