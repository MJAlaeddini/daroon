import nodemailer from 'nodemailer';
import { fa } from '@daroon/shared';
import type { Config } from '../../config';

export interface Mailer { sendLoginCode(to: string, code: string): Promise<void> }

/** The login-code mail, in the app's own voice. */
export function loginCodeMail(code: string) {
  const c = fa(code);
  return {
    subject: `کد ورود به درون: ${c}`,
    text: `سلام،\n\nکد ورود تو به درون: ${c}\n\nاین کد تا ده دقیقه کار می‌کنه. اگه خودت درخواستش نکردی، این پیام رو نادیده بگیر.\n`,
    html: `<div dir="rtl" style="font-family:Tahoma,sans-serif;font-size:15px;line-height:1.9;color:#1d1726">
<p>سلام،</p><p>کد ورود تو به درون:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:8px 0">${c}</p>
<p style="color:#544b60">این کد تا ده دقیقه کار می‌کنه. اگه خودت درخواستش نکردی، این پیام رو نادیده بگیر.</p></div>`,
  };
}

export function createMailer(config: Config, log: { info: (o: object, m: string) => void }): Mailer {
  if (!config.SMTP_URL) {
    return {
      async sendLoginCode(to, code) {
        log.info({ to, code }, 'SMTP_URL is not set; login code printed instead of mailed');
      },
    };
  }
  const transport = nodemailer.createTransport(config.SMTP_URL);
  return {
    async sendLoginCode(to, code) {
      await transport.sendMail({ from: config.MAIL_FROM, to, ...loginCodeMail(code) });
    },
  };
}
