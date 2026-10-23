/**
 * Weekly story: the prompt the writer receives, the validation of what comes back,
 * and a plain local fallback when no writer is available.
 */
import { fa } from './digits';
import { WD, wdIndex, weekRange } from './jalali';
import { labelOf } from './lexicon';

export interface StoryEntry {
  day: string;
  time: string;
  emotions: { key: string }[];
  context: { name: string; value: string } | null;
  note?: string;
}
export interface StoryDraft {
  title: string;
  pages: { label: string | null; text: string }[];
}

export function storyPrompt(ws: string, list: StoryEntry[], allowed: string[]): string {
  const rows = list.map((e) => ({
    روز: WD[wdIndex(e.day)],
    ساعت: e.time,
    احساس‌ها: e.emotions.map((x) => labelOf(x.key)),
    بی‌نام: !e.emotions.length,
    زمینه: e.context ? `${e.context.name}: ${e.context.value}` : null,
    یادداشت: e.note || null,
  }));
  return `تو برای یک دفترچه‌ی شخصیِ احساس به اسم «درون»، «داستان هفته» می‌نویسی: چند صفحه‌ی کوتاه که آدم بخونه و ببینه هفته‌اش چطور گذشته.
داده‌ها ردپاهای هفته‌ی ${weekRange(ws)} هستن که خود کاربر ثبت کرده.

قواعد نوشتن:
- فارسیِ خودمونی، روان و گرم؛ مثل یه دوست دقیق و مهربون. کاربر رو «تو» خطاب کن. شکسته‌نویسی طبیعی خوبه («می‌شه»، «داشتی»، «اومد»).
- فقط از چیزهایی بگو که در داده‌ها هست. چیزی نساز و اغراق نکن.
- هیچ تشخیص، برچسب روان‌شناختی، اصطلاح بالینی یا توصیه‌ی درمانی نده. نصیحت و قضاوت نکن.
- احساس‌ها رو با همون کلمه‌هایی که کاربر انتخاب کرده بیار. حال‌های بی‌نام رو هم محترم بشمار.
- از یادداشت‌ها فقط کوتاه و با احتیاط یاد کن و جمله‌ی کامل یادداشت رو نقل نکن.
- از آمار خشک پرهیز کن؛ عدد فقط وقتی که به روایت کمک کنه.
- ۴ تا ۶ صفحه. هر صفحه حداکثر ۲۰۰ نویسه و حداکثر سه جمله‌ی کوتاه.
- ترتیب: یک صفحه‌ی آغاز درباره‌ی حال‌وهوای کلی هفته؛ چند صفحه درباره‌ی لحظه‌ها یا احساس‌های پررنگ‌تر؛ اگه احساس‌هایی کنار هم اومدن یا چیزی در طول هفته عوض شد، یک صفحه درباره‌اش؛ و یک صفحه‌ی پایانی آروم که با یک سؤال باز و ساده برای فکر کردن تموم بشه.
- برای هر صفحه، اگه درباره‌ی یک احساس مشخصه، "emotion" رو دقیقاً یکی از «کلمه‌های مجاز» بذار؛ وگرنه null.
- عنوان: حداکثر پنج کلمه، ساده و کمی شاعرانه.
- کلمه‌هایی مثل «هوش مصنوعی»، «تحلیل» یا «داده» رو به کار نبر.

فقط JSON برگردون، به این شکل:
{"title":"...","pages":[{"emotion":"... یا null","text":"..."}]}

کلمه‌های مجاز: ${JSON.stringify(allowed)}
ردپاها: ${JSON.stringify(rows)}`;
}

/** Validates and trims the writer's reply. Throws when it is unusable. */
export function normStory(r: unknown, allowed: string[]): StoryDraft {
  const o = r as { title?: unknown; pages?: unknown } | null;
  if (!o || !Array.isArray(o.pages)) throw new Error('shape');
  const pages = (o.pages as { emotion?: unknown; text?: unknown }[])
    .filter((p) => p && typeof p.text === 'string' && p.text.trim())
    .slice(0, 6)
    .map((p) => ({
      label: typeof p.emotion === 'string' && allowed.includes(p.emotion) ? p.emotion : null,
      text: (p.text as string).trim().slice(0, 300),
    }));
  if (pages.length < 2) throw new Error('short');
  return {
    title: String(o.title || 'هفته‌ی تو')
      .trim()
      .slice(0, 48),
    pages,
  };
}

/** A plain summary written without the writer. */
export function localStory(list: StoryEntry[]): StoryDraft {
  const cnt = new Map<string, number>(),
    pairs = new Map<string, number>();
  const tod: Record<string, number> = { صبح: 0, ظهر: 0, عصر: 0, شب: 0 };
  let un = 0;
  list.forEach((e) => {
    if (!e.emotions.length) un++;
    const h = +e.time.slice(0, 2);
    tod[h < 11 ? 'صبح' : h < 15 ? 'ظهر' : h < 19 ? 'عصر' : 'شب']++;
    const ks = [...new Set(e.emotions.map((x) => x.key))];
    ks.forEach((k) => cnt.set(k, (cnt.get(k) || 0) + 1));
    for (let a = 0; a < ks.length; a++)
      for (let b = a + 1; b < ks.length; b++) {
        const p = [ks[a], ks[b]].join('|');
        pairs.set(p, (pairs.get(p) || 0) + 1);
      }
  });
  const top = [...cnt.entries()].sort((a, b) => b[1] - a[1]);
  const days = new Set(list.map((e) => e.day)).size;
  const when = Object.entries(tod).sort((a, b) => b[1] - a[1])[0][0];
  const L = labelOf,
    pages: StoryDraft['pages'] = [];
  pages.push({
    label: top[0] ? L(top[0][0]) : null,
    text: `این هفته ${fa(days)} روز به خودت سر زدی و ${fa(list.length)} ردپا گذاشتی. ${top.length ? `بیشتر از همه «${L(top[0][0])}» اومد.` : 'بیشترش حال‌هایی بود که هنوز اسم نداشتن.'}`,
  });
  if (top[0])
    pages.push({
      label: L(top[0][0]),
      text: `«${L(top[0][0])}» ${fa(top[0][1])} بار سراغت اومد، بیشتر ${when}‌ها. شاید بد نباشه یادت بیاد اون لحظه‌ها چی کنارش بود.`,
    });
  if (top[1])
    pages.push({ label: L(top[1][0]), text: `کنارش «${L(top[1][0])}» هم بود. یه هفته می‌تونه هم این باشه، هم اون.` });
  const pr = [...pairs.entries()].sort((a, b) => b[1] - a[1])[0];
  if (pr) {
    const [a, b] = pr[0].split('|');
    pages.push({
      label: L(a),
      text: `«${L(a)}» و «${L(b)}» با هم اومدن. گاهی دو حال کنار هم می‌شینن و هیچ‌کدوم اون یکی رو کنار نمی‌زنه.`,
    });
  }
  if (un)
    pages.push({
      label: null,
      text: `${fa(un)} بار هم حالی داشتی که اسمی براش انتخاب نکردی. اون هم بخشی از این هفته بود، همون‌طور که بود.`,
    });
  pages.push({
    label: top[0] ? L(top[0][0]) : null,
    text: 'اگه بخوای این هفته رو فقط با یه کلمه‌ی دیگه بگی، اون کلمه چیه؟',
  });
  return { title: top[0] ? `هفته‌ای به رنگ ${L(top[0][0])}` : 'هفته‌ای بی‌نام', pages: pages.slice(0, 6) };
}
