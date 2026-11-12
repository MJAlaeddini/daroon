/* The welcome page: the stone, one sentence, one way in. Nobody is asked for an account here; «شروع کن» goes
 * straight into the app, and an account is offered after the first check-in (features/account.ts). */
export function vLogin() {
  return `<div class="login">
    <p class="login-brand r" style="--i:0"><span class="brand-seed" aria-hidden="true"></span><span class="logo" role="img" aria-label="درون"></span></p>
    <div class="login-stage r" style="--i:1"><div class="anchor-login" data-anchor data-scale=".62"></div></div>
    <div class="login-copy">
      <h1 class="hero r" style="--i:2" tabindex="-1" data-autofocus>حال‌هایی که هنوز اسم ندارن، این‌جا جا دارن.</h1>
      <p class="lede r" style="--i:3">کلمه رو لمس کن، شکل درونت رو ببین.</p>
    </div>
    <div class="login-acts r" style="--i:4">
      <button class="primary auth-main" data-act="loginSkip">شروع کن</button>
      <button class="quiet" data-act="loginPassword">حساب دارم</button>
    </div></div>`;
}
