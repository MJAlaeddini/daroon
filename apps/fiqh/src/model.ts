/**
 * The shape of a reasoning tree. A tree answers one question (مسئله). Its nodes are statements: sources at the
 * roots (a verse, a narration, a rule, consensus, a rational argument, the facts of the case), inferences in the
 * middle, rulings at the top. A node lists its premises in `from`; an objection points at the node it attacks.
 */
export type Kind =
  'verse' | 'hadith' | 'principle' | 'consensus' | 'reason' | 'subject' | 'inference' | 'ruling' | 'objection';

/** A narrator's standing in rijal, as the tree's author judges it. */
export type Standing = 'imami' | 'nonimami' | 'mamduh' | 'majhul' | 'daif';
export type ChainGrade = 'sahih' | 'muwaththaq' | 'hasan' | 'daif' | 'mursal';
export type Strength = 'fatwa' | 'wajib' | 'mustahab';

export interface Narrator {
  name: string;
  standing: Standing;
}

export interface Node {
  id: string;
  kind: Kind;
  /** A short label for the tree. */
  title: string;
  /** The text itself: Arabic for a verse or a narration, Persian for a statement. */
  text?: string;
  translation?: string;
  /** Where it is found: «تهذیب الأحکام، ج۱، ص۸، ح۱۱». */
  source?: string;
  /** For a narration: who said it (the Imam). */
  speaker?: string;
  /** For a narration: the chain from the compiler to the last narrator before the Imam. */
  chain?: Narrator[];
  /** The chain has a gap (a narrator dropped): the narration is mursal whatever the others are. */
  broken?: boolean;
  /** For an inference: how the premises yield the conclusion (اطلاق، تعلیل، الغای خصوصیت…). */
  method?: string;
  /** For a ruling: how firmly it is held. */
  strength?: Strength;
  /** For an objection: the answer, if there is one. */
  reply?: string;
  note?: string;
  /** Premises (ids). For an objection: the one node it attacks. */
  from: string[];
}

export interface Tree {
  id: string;
  /** The question the tree answers. */
  title: string;
  summary?: string;
  sample?: boolean;
  updatedAt: string;
  nodes: Node[];
}

export const KINDS: Record<Kind, { label: string; plural: string; root: boolean }> = {
  verse: { label: 'آیه', plural: 'آیات', root: true },
  hadith: { label: 'روایت', plural: 'روایات', root: true },
  principle: { label: 'قاعده', plural: 'قواعد', root: true },
  consensus: { label: 'اجماع', plural: 'اجماع', root: true },
  reason: { label: 'دلیل عقلی', plural: 'ادلهٔ عقلی', root: true },
  subject: { label: 'موضوع', plural: 'موضوعات', root: true },
  inference: { label: 'استدلال', plural: 'استدلال‌ها', root: false },
  ruling: { label: 'حکم', plural: 'احکام', root: false },
  objection: { label: 'اشکال', plural: 'اشکال‌ها', root: false },
};

export const STANDING: Record<Standing, string> = {
  imami: 'ثقهٔ امامی',
  nonimami: 'ثقهٔ غیرامامی',
  mamduh: 'ممدوح',
  majhul: 'مجهول',
  daif: 'ضعیف',
};

export const CHAIN: Record<ChainGrade, { label: string; why: string }> = {
  sahih: { label: 'صحیح', why: 'همهٔ راویان، ثقهٔ امامی‌اند.' },
  muwaththaq: { label: 'موثق', why: 'همه ثقه‌اند، ولی دست‌کم یکی امامی نیست.' },
  hasan: { label: 'حسن', why: 'ضعیفی در سند نیست، ولی دست‌کم یکی فقط ممدوح است.' },
  daif: { label: 'ضعیف', why: 'دست‌کم یکی از راویان ضعیف یا مجهول است.' },
  mursal: { label: 'مرسل', why: 'در سند افتادگی هست.' },
};

export const STRENGTH: Record<Strength, string> = {
  fatwa: 'فتوا',
  wajib: 'احتیاط واجب',
  mustahab: 'احتیاط مستحب',
};

/**
 * The usual four-fold grading of a chain: one weak or unknown link makes it weak; otherwise a trustworthy
 * non-Imami makes it muwaththaq, a merely praised narrator makes it hasan, and only Imami trustworthy narrators
 * throughout make it sahih. The weakest link decides.
 */
export function gradeChain(n: Pick<Node, 'chain' | 'broken'>): ChainGrade | null {
  const c = n.chain || [];
  if (n.broken) return 'mursal';
  if (!c.length) return null;
  if (c.some((x) => x.standing === 'daif' || x.standing === 'majhul')) return 'daif';
  if (c.some((x) => x.standing === 'nonimami')) return 'muwaththaq';
  if (c.some((x) => x.standing === 'mamduh')) return 'hasan';
  return 'sahih';
}

export const uid = (): string => Math.random().toString(36).slice(2, 9);

/** Everything a node rests on, nearest first (objections attacking those nodes are included). */
export function lineage(tree: Tree, id: string): Set<string> {
  const by = new Map(tree.nodes.map((n) => [n.id, n]));
  const seen = new Set<string>([id]);
  const stack = [id];
  while (stack.length) {
    const n = by.get(stack.pop()!);
    if (!n || n.kind === 'objection') continue;
    for (const p of n.from)
      if (!seen.has(p) && by.has(p)) {
        seen.add(p);
        stack.push(p);
      }
  }
  for (const n of tree.nodes) if (n.kind === 'objection' && seen.has(n.from[0])) seen.add(n.id);
  return seen;
}

/**
 * The derivation of a node as ordered steps, sources first: every premise appears before what is built on it.
 */
export function steps(tree: Tree, id: string): Node[] {
  const by = new Map(tree.nodes.map((n) => [n.id, n]));
  const out: Node[] = [];
  const done = new Set<string>();
  const visit = (k: string) => {
    if (done.has(k)) return;
    done.add(k);
    const n = by.get(k);
    if (!n) return;
    if (n.kind !== 'objection') n.from.forEach(visit);
    out.push(n);
  };
  visit(id);
  return out;
}

/** Would making `from` a premise of `to` create a circle? */
export function wouldLoop(tree: Tree, from: string, to: string): boolean {
  return from === to || lineage(tree, from).has(to);
}
