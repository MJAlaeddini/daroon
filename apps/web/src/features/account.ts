import { todayKey } from '@daroon/shared';
import { $, esc } from '../core/util';
import { NEUTRAL_PAL, palFor } from '../domain/lexicon';
import { S } from '../state/app';
import { DB, persist, visible } from '../state/store';
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
export let claudeUser = null; try { (window as any).claude?.use?.('user').then(u => claudeUser = u).catch(() => {}); } catch (e){}
export async function suggestedName(){ try { if (!claudeUser) return ''; const me = await claudeUser.me(); return me?.name || ''; } catch (e){ return ''; } }
export function loginSheetHTML(name){
  return `<div class="sheet-top"><h2 class="ed" style="font-size:24px" tabindex="-1" data-autofocus>ورود نمونه با Google</h2><button class="ib" data-act="closeSheet" aria-label="بستن">${IC.close}</button></div>
  <div class="sheet-scroll set"><p class="fine" style="max-width:none">در نسخه‌ی نهایی، این‌جا صفحه‌ی امن ورود گوگل باز می‌شه. فعلاً برای دیدن تجربه، فقط اسمی که دوست داری صدات کنیم رو بنویس.</p>
    <form class="custom" data-form="login" style="margin-top:12px"><label class="vh" for="loginName">اسم</label><input class="inp" id="loginName" maxlength="24" autocomplete="off" placeholder="اسمت" value="${esc(name)}"><button class="primary" type="submit" style="min-height:48px;padding:0 20px">ورود</button></form></div>`;
}
export async function openLogin(){ openSheet('login', loginSheetHTML(''), 'ورود'); const n = await suggestedName(); const i = $('#loginName'); if (i && !i.value && n) i.value = n; }
export function signIn(name){ DB.account = { name: name.trim().slice(0, 24), provider: 'google', since: todayKey() }; DB.loginDone = true; persist(); refreshAvatar(); closeSheet(true); S.prev = []; S.view = 'today'; renderView(); toast(`خوش اومدی، ${esc(DB.account.name)}.`); }
