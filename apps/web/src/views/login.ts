import { cvars } from '../domain/lexicon';
import { authCfg } from '../features/account';

export function vLogin() {
  const ws = ['آرامش', 'امید', 'دلتنگی', 'اشتیاق', 'نگرانی', 'صمیمیت', 'غم', 'سردرگمی', 'خوشحالی', 'دلخوری'];
  const words = ws
    .map((w, i) => {
      const a = (i / ws.length) * Math.PI * 2 + 0.3,
        x = 50 + 38 * Math.cos(a),
        y = 50 - 45 * Math.sin(a);
      return `<li style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;--d:${(i * 0.7).toFixed(1)}s;${cvars(w)}"><i></i>${w}</li>`;
    })
    .join('');
  return `<div class="login">
    <p class="login-brand r" style="--i:0"><span class="brand-seed" aria-hidden="true"></span><span class="logo" role="img" aria-label="درون"></span></p>
    <div class="login-stage r" style="--i:1"><div class="anchor-login" data-anchor data-scale=".5"></div><ul class="login-words" aria-hidden="true">${words}</ul></div>
    <div class="login-copy">
      <h1 class="hero r" style="--i:2" tabindex="-1" data-autofocus>حال‌هایی که هنوز اسم ندارن، این‌جا جا دارن.</h1>
      <p class="lede r" style="--i:3">کلمه‌ها رو لمس کن، شکل درونت رو ببین، و ردپاش رو نگه دار.</p>
    </div>
    <div class="login-acts r" style="--i:4">
      <button class="gbtn" data-act="loginGoogle"${authCfg.google ? '' : ' hidden'}><span class="g" aria-hidden="true">G</span>ادامه با Google</button>
      <button class="gbtn" data-act="loginEmail"><span class="g" aria-hidden="true">@</span>ادامه با ایمیل</button>
      <button class="quiet" data-act="loginSkip">فعلاً بدون حساب</button>
      <p class="fine">با حساب، ردپاهات روی همه‌ی دستگاه‌هات هست. یادداشت‌ها فقط روی همین دستگاه می‌مونن.</p>
    </div></div>`;
}
