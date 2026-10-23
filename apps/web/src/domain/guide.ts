import { S } from '../state/app';

/* ═════════════════════════ guided discovery (deterministic, no AI) ═════════════════════════ */
export const Q1 = { q: 'از یه جای ساده شروع کنیم. الان بیشتر کدوم به تجربه‌ات نزدیکه؟', opts: [
  { id:'event', t:'یه اتفاق توی ذهنم مونده', mod:{sep:.05} },
  { id:'thoughts', t:'فکرهام خیلی شلوغن', mod:{tens:.2,freq:.2,turb:.1} },
  { id:'body', t:'بیشتر یه چیزی توی بدنم حس می‌کنم', mod:{coh:.1,exp:-.05} },
  { id:'vague', t:'یه حال مبهم دارم که نمی‌تونم توصیفش کنم', mod:{diff:.15,sep:.1} },
  { id:'none', t:'هیچ‌کدوم؛ واقعاً نمی‌دونم', mod:{} },
]};
export const Q2 = {
  event:{ q:'وقتی به اون اتفاق فکر می‌کنی، کدوم بخشش بیشتر باهات مونده؟', opts:[
    { id:'person', t:'حرف یا رفتار یه نفر', sug:['دلخوری','رنجش','خشم','قدردانی'], mod:{tens:.1} },
    { id:'expect', t:'چیزی که انتظار داشتم اتفاق نیفتاد', sug:['ناامیدی','دلخوری','غم','حسرت'], mod:{lum:-.1} },
    { id:'self', t:'کاری که خودم کردم یا نکردم', sug:['پشیمانی','رضایت','دلشوره','کلافگی'], mod:{coh:.1} },
    { id:'change', t:'تغییری که پیش اومد', sug:['بلاتکلیفی','امید','دلتنگی','هیجان'], mod:{energy:.1,dx:.2} },
    { id:'unsure', t:'دقیق نمی‌دونم', sug:[], mod:{sep:.1}, vague:true },
  ]},
  thoughts:{ q:'فکرهات بیشتر دور چی می‌چرخن؟', opts:[
    { id:'past', t:'اتفاقی که گذشته', sug:['حسرت','پشیمانی','دلتنگی','قدردانی'], mod:{dx:-.2} },
    { id:'future', t:'چیزی که ممکنه پیش بیاد', sug:['نگرانی','امید','اشتیاق','بلاتکلیفی'], mod:{dy:.1,tens:.1} },
    { id:'tasks', t:'کارها و مسئولیت‌هام', sug:['کلافگی','نگرانی','انگیزه','رضایت'], mod:{tens:.2,turb:.1} },
    { id:'many', t:'چند چیز مختلف', sug:['سردرگمی','کلافگی','دلشوره','کنجکاوی'], mod:{sep:.2,turb:.15} },
    { id:'unsure', t:'نمی‌دونم', sug:[], mod:{}, vague:true },
  ]},
  body:{ q:'اگر فقط بخوای حس جسمی رو توصیف کنی، بیشتر شبیه چیه؟', opts:[
    { id:'heavy', t:'سنگینی یا گرفتگی', sug:['غم','دلگیری','دلتنگی','بی‌حوصلگی'], mod:{dy:-.3,exp:-.08,lum:-.1} },
    { id:'tense', t:'تنش یا بی‌قراری', sug:['نگرانی','خشم','اشتیاق','کلافگی'], mod:{tens:.25,freq:.2} },
    { id:'light', t:'سبکی یا رهایی', sug:['آرامش','شادی','رهایی','سبکی'], mod:{exp:.1,lum:.15,dy:.2} },
    { id:'tired', t:'خستگی یا کم‌انرژی بودن', sug:['بی‌حوصلگی','دلگیری','آرامش','کلافگی'], mod:{energy:-.25,lum:-.1} },
    { id:'unsure', t:'نمی‌دونم', sug:[], mod:{}, vague:true },
  ]},
  vague:{ q:'اگه بدون اسم گذاشتن بخوای توصیفش کنی، به کدوم نزدیک‌تره؟', opts:[
    { id:'pressure', t:'انگار یه فشاری درونمه', sug:['کلافگی','نگرانی','دلخوری','بلاتکلیفی'], mod:{coh:.15,exp:-.1,tens:.2} },
    { id:'missing', t:'انگار یه چیزی کمه', sug:['دلتنگی','تنهایی','حسرت','انتظار'], mod:{asym:.2,sep:.1} },
    { id:'changing', t:'حس می‌کنم یه چیزی داره تغییر می‌کنه', sug:['امید','بلاتکلیفی','کنجکاوی','دلشوره'], mod:{dy:.2,energy:.1} },
    { id:'between', t:'انگار بین دو حالت مختلفم', sug:['دوگانگی','سردرگمی','امید','دلتنگی'], mod:{sep:.3} },
    { id:'neither', t:'حتی این‌ها هم نیست', sug:[], mod:{}, vague:true },
  ]},
  none:{ q:'دوست داری چطور ادامه بدیم؟', opts:[
    { id:'words', t:'چند کلمه ببینم', go:'explore' },
    { id:'write', t:'یه جمله درباره‌اش بنویسم', go:'write' },
    { id:'keep', t:'فعلاً همین نامشخص بودن رو ثبت کنم', go:'unnamed' },
    { id:'stop', t:'الان نمی‌خوام ادامه بدم', go:'exit' },
  ]},
};
export const CTX_NAME = { event:'موقعیت', thoughts:'فکرها', body:'حس جسمی', vague:'حال' };
export const CTX_KIND = { event:'situation', thoughts:'thoughts', body:'body', vague:'felt' };
export function ctxFor(q1: string, q2?: string | null){
  if (!q1 || q1 === 'none') return null;
  const o1 = Q1.opts.find(o => o.id === q1), o2 = q2 ? Q2[q1].opts.find(o => o.id === q2) : null;
  const value = (o2 && !o2.vague) ? o2.t : o1.t;
  return { kind: CTX_KIND[q1], name: CTX_NAME[q1], q1, q2: q2 || null, value };
}
export function guideMods(){ const g = S.guide; if (!g) return {}; const m = {}; const add = o => { for (const k in (o || {})) m[k] = (m[k] || 0) + o[k]; };
  if (g.q1) add(Q1.opts.find(o => o.id === g.q1)?.mod); if (g.q1 && g.q2) add(Q2[g.q1].opts.find(o => o.id === g.q2)?.mod); return m; }
