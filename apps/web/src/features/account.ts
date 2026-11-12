import { fa } from '@daroon/shared';
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
   Nobody has to make an account to start: the welcome page goes straight into the app, and after the first
   check-in a sheet offers to keep the traces («نگهش داریم؟»). An account is a name to be called by (Persian), a
   username to sign in with (Latin) and a password; nothing to wait for, no mail server needed. A six-digit code by
   email is offered where the server can send one, and Google where it has a client id.
   Sheet steps: password (sign up / sign in) · email → code · google. */
export const authCfg = { google: null as string | null, email: true, known: false, online: false };
export async function loadAuthConfig() {
  try {
    const c = await api.authConfig();
    authCfg.google = c.google;
    authCfg.email = c.email !== false;
    authCfg.online = true;
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
  /** opened on its own after a check-in: «نگهش داریم؟» with «بعداً», instead of «ساختن حساب» */
  keep: false,
  email: '',
  name: '',
  user: '',
  err: '',
  busy: false,
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
    /* labels sit above their fields on the right; hints are Persian and read from the right; what is typed in the
       Latin fields runs left to right but stays against the right edge (auth.css) */
    return `${top(up ? (login.keep ? 'نگهش داریم؟' : 'ساختن حساب') : 'خوش برگشتی')}<div class="sheet-scroll set auth">
    <p class="auth-lead">${up ? 'با یه حساب، ردپاهات گم نمی‌شن.' : 'ردپاهات منتظرتن.'}</p>
    <form class="authform" data-form="loginPassword" novalidate>
      ${up ? `<label for="loginName">اسمت</label><input class="inp" id="loginName" name="name" maxlength="24" autocomplete="given-name" placeholder="مثلاً یحیی" value="${esc(login.name)}">` : ''}
      <label for="loginUser">نام کاربری</label>
      <input class="inp latin" id="loginUser" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="24" placeholder="${up ? 'با حروف انگلیسی، مثلاً yahya' : 'با حروف انگلیسی'}" value="${esc(login.user)}" required>
      <p class="auth-msg" id="userMsg" aria-live="polite"></p>
      <div class="auth-sug" id="userSug" hidden></div>
      <label for="loginPw">رمز</label>
      <div class="pw"><input class="inp latin" id="loginPw" name="password" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" maxlength="128" placeholder="${up ? 'دست‌کم ۸ حرف' : 'رمزت'}" required>
        <button type="button" class="pw-eye" data-act="pwToggle" aria-label="نمایش رمز" aria-pressed="false">${IC.eye}</button></div>
      ${up ? '<div class="pw-bars" id="pwBars" aria-hidden="true"><i></i><i></i><i></i></div>' : ''}
      <p class="auth-msg" id="pwMsg" aria-live="polite"></p>
      <p class="auth-err" id="authErr" role="alert" hidden></p>
      <button class="primary" type="submit">${up ? (login.keep ? 'نگه دار' : 'ساختن حساب') : 'ورود'}</button></form>
    <div class="auth-more">${up && login.keep ? '<button class="quiet" data-act="closeSheet">بعداً</button>' : ''}<button class="quiet" data-act="${up ? 'loginPassword' : 'loginSignup'}">${up ? 'حساب دارم' : 'حساب ندارم؛ یکی بسازم'}</button></div>
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
  if (login.step === 'password' && login.user) userTyped(login.user);
}
/** What has been typed so far, kept while the sheet changes between making an account and signing in. */
function keepTyped() {
  login.name = ($('#loginName') as HTMLInputElement | null)?.value ?? login.name;
  login.user = ($('#loginUser') as HTMLInputElement | null)?.value ?? login.user;
}
export function openLogin(step = 'password', mode?: 'signup' | 'login', keep = false) {
  login.step = step;
  if (mode) login.mode = mode;
  login.keep = keep;
  login.err = '';
  login.busy = false;
  openSheet('login', loginSheetHTML(), keep ? 'نگه داشتن ردپاها' : 'ورود');
  if (step === 'google') mountGoogle();
}
export function loginStep(step, mode?: 'signup' | 'login') {
  keepTyped();
  login.step = step;
  if (mode) login.mode = mode;
  login.err = '';
  refreshLogin();
}
/** After a check-in, once: offer to keep the traces with an account. Only where the server can be reached, and
    never again on its own; the account page keeps the same offer for later. */
export function offerKeep(): boolean {
  if (DB.account || DB.keepAsked || !authCfg.online || S.sheet || !visible().some((e) => !e.demo)) return false;
  DB.keepAsked = true;
  persist({ quiet: true });
  openLogin('password', 'signup', true);
  return true;
}

/* ── the username and password fields answer while they are typed ── */
const say = (id: string, text = '', kind: '' | 'ok' | 'bad' = '') => {
  const p = $(id);
  if (!p) return;
  p.textContent = text;
  p.className = `auth-msg${kind ? ' ' + kind : ''}`;
};
function suggest(list: string[]) {
  const box = $('#userSug');
  if (!box) return;
  box.hidden = !list.length;
  box.innerHTML = list
    .map(
      (u) => `<button type="button" class="chip" dir="ltr" data-act="userPick" data-u="${esc(u)}">${esc(u)}</button>`,
    )
    .join('');
}
let userTimer: ReturnType<typeof setTimeout> | undefined,
  userCtl: AbortController | null = null;
export function userTyped(raw: string) {
  clearTimeout(userTimer);
  userCtl?.abort();
  const v = (raw || '').trim(),
    inp = $('#loginUser');
  const bad = (m: string) => {
    say('#userMsg', m, 'bad');
    inp?.setAttribute('aria-invalid', 'true');
  };
  inp?.removeAttribute('aria-invalid');
  suggest([]);
  if (/[^ -~]/.test(v)) return bad('نام کاربری با حروف انگلیسیه. صفحه‌کلیدت رو انگلیسی کن.');
  if (/[^A-Za-z0-9._]/.test(v)) return bad('فقط حروف انگلیسی، عدد، نقطه و _ ؛ بدون فاصله.');
  say('#userMsg');
  const u = v.toLowerCase();
  if (login.mode !== 'signup' || !USERNAME.test(u)) return;
  /* a moment after the typing stops, ask whether the name is free; with no answer (offline) say nothing */
  userTimer = setTimeout(async () => {
    const ctl = (userCtl = new AbortController());
    try {
      const r = await api.usernameStatus(u, ctl.signal);
      if (ctl.signal.aborted || ($('#loginUser') as HTMLInputElement | null)?.value.trim().toLowerCase() !== u) return;
      if (r.available) return say('#userMsg', 'این نام کاربری آزاده.', 'ok');
      bad(
        r.suggestions.length
          ? 'این نام کاربری رو کس دیگه‌ای برداشته. این‌ها آزادن:'
          : 'این نام کاربری رو کس دیگه‌ای برداشته.',
      );
      suggest(r.suggestions);
    } catch (e) {
      /* unknown: signing up will tell */
    }
  }, 450);
}
export function pickUsername(u: string) {
  const inp = $('#loginUser') as HTMLInputElement | null;
  if (!inp) return;
  inp.value = u;
  login.user = u;
  suggest([]);
  inp.removeAttribute('aria-invalid');
  say('#userMsg', 'این نام کاربری آزاده.', 'ok');
  ($('#loginPw') as HTMLInputElement | null)?.focus({ preventScroll: true });
}
/** How strong a new password looks (0..3 bars), with what is still missing said plainly. */
export function pwTyped(pw: string) {
  $('#loginPw')?.removeAttribute('aria-invalid');
  if (login.mode !== 'signup') return say('#pwMsg');
  const kinds = [/[a-z\u0600-\u06FF]/, /[A-Z]/, /\d/, /[^A-Za-z0-9\u0600-\u06FF]/].filter((r) => r.test(pw)).length;
  const score =
    pw.length < 8 ? 0 : pw.length >= 14 || (pw.length >= 11 && kinds >= 3) ? 3 : pw.length >= 10 || kinds >= 2 ? 2 : 1;
  $$('#pwBars i').forEach((b, i) => b.classList.toggle('on', i < score));
  if (!pw) return say('#pwMsg');
  if (pw.length < 8) return say('#pwMsg', `دست‌کم ۸ حرف؛ ${fa(8 - pw.length)} تا دیگه بنویس.`);
  const persian = /[\u0600-\u06FF]/.test(pw) ? ' با صفحه‌کلید فارسی نوشتی؛ موقع ورود هم با همین بنویس.' : '';
  say(
    '#pwMsg',
    `${score >= 3 ? 'رمز خیلی خوبیه.' : 'رمز خوبیه.'} یادت بمونه؛ بدون ایمیل بازیابی نمی‌شه.${persian}`,
    'ok',
  );
}
/** Show or hide the password without losing what was typed or the caret. */
export function togglePassword() {
  const inp = $('#loginPw') as HTMLInputElement | null,
    b = $('[data-act="pwToggle"]');
  if (!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  b?.setAttribute('aria-pressed', String(show));
  b?.setAttribute('aria-label', show ? 'پنهان کردن رمز' : 'نمایش رمز');
  inp.focus({ preventScroll: true });
}
/* Errors are said under the field they belong to and the sheet is never drawn again, so nothing typed is lost. */
export async function submitPassword(username: string, password: string, name: string) {
  const user = (username || '').trim().toLowerCase();
  login.user = user;
  login.name = (name || '').trim();
  const up = login.mode === 'signup';
  const err = $('#authErr'),
    btn = $('[data-form="loginPassword"] .primary') as HTMLButtonElement | null;
  const fail = (m: string, at?: string) => {
    if (at) {
      say(at, m, 'bad');
      $(at === '#userMsg' ? '#loginUser' : '#loginPw')?.setAttribute('aria-invalid', 'true');
    } else if (err) {
      err.textContent = m;
      err.hidden = false;
    }
    (at ? $(at === '#userMsg' ? '#loginUser' : '#loginPw') : null)?.focus({ preventScroll: true });
  };
  if (err) err.hidden = true;
  if (/[^ -~]/.test(user)) return fail('نام کاربری با حروف انگلیسیه. صفحه‌کلیدت رو انگلیسی کن.', '#userMsg');
  if (!USERNAME.test(user))
    return up
      ? fail('نام کاربری سه تا بیست‌وچهار حرفه: حروف انگلیسی، عدد، نقطه یا _', '#userMsg')
      : fail('نام کاربری یا رمز درست نیست.');
  if (up && password.length < 8) return fail(`رمز دست‌کم ۸ حرفه؛ ${fa(8 - password.length)} تا دیگه بنویس.`, '#pwMsg');
  if (!password) return fail('رمز رو بنویس.', '#pwMsg');
  const label = btn?.textContent ?? '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'یه لحظه…';
  }
  try {
    const { account } = up
      ? await api.signup(user, password, login.name || undefined)
      : await api.login(user, password);
    login.name = login.user = '';
    await signedIn(account);
  } catch (e) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = label;
    }
    if (e instanceof ApiError && e.code === 'username_taken') {
      fail('این نام کاربری رو کس دیگه‌ای برداشته.', '#userMsg');
      userTyped(user);
    } else fail(errText(e, up ? 'نام کاربری یا رمز قابل قبول نیست.' : 'نام کاربری یا رمز درست نیست.'));
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
