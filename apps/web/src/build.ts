/* Which build this is: the commit it was built from and that commit's date, so the person deploying by hand can see
 * that the new version arrived (and that a cached page is not the old one). Set at build time by vite.config.ts from
 * BUILD_ID ("<short hash> <yyyy-mm-dd>", passed in by deploy/update.sh) or, locally, from git. */
import { d2j, fa, g2d, J_MONTHS } from '@daroon/shared';

declare const __BUILD__: string;
const raw = typeof __BUILD__ === 'string' ? __BUILD__.trim() : '';

/** e.g. «نسخه‌ی ۱۸ آبان ۱۴۰۵، 311b431», as HTML: the commit id is isolated so it never reorders the Persian around it. */
export function buildLabel(): string {
  const [hash = '', date = ''] = raw.split(/\s+/);
  if (!/^[0-9a-f]{4,40}$/.test(hash)) return 'نسخه‌ی آزمایشی';
  const id = `<bdi dir="ltr">${hash}</bdi>`;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return `نسخه‌ی ${id}`;
  const j = d2j(g2d(+m[1], +m[2], +m[3]));
  return `نسخه‌ی ${fa(j.jd)} ${J_MONTHS[j.jm - 1]} ${fa(j.jy)}، ${id}`;
}
