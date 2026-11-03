/**
 * On a phone, a flow (the words, the guided questions, the page before saving) has a single header: its back
 * button and step take the top bar's place instead of sitting in a second row under the logo. The flow's own
 * header element is moved into the top bar while it is showing (moved, not copied, so ids and live updates such
 * as the guide's step label keep working) and handed back if the screen grows wide.
 */
import { $ } from '../core/util';

const PHONE = matchMedia('(max-width: 699px)');

function place() {
  const slot: HTMLElement | null = $('.tb-flow');
  if (!slot) return;
  const view: HTMLElement | null = $('#views .view:not(.leaving)');
  const own = view?.querySelector<HTMLElement>(':scope > .flow-head') ?? null;
  const flow = document.body.dataset.flow === '1';
  if (PHONE.matches && flow) {
    if (own) slot.replaceChildren(own);
  } else if (slot.firstElementChild) {
    const head = slot.firstElementChild as HTMLElement;
    if (flow && view && !PHONE.matches) view.prepend(head);
    else slot.replaceChildren();
  }
  document.body.classList.toggle('tb-flowing', PHONE.matches && flow && !!slot.firstElementChild);
}

export function setupChrome() {
  const views = $('#views');
  if (!views) return;
  new MutationObserver(place).observe(views, { childList: true, subtree: true });
  new MutationObserver(place).observe(document.body, { attributes: true, attributeFilter: ['data-flow'] });
  PHONE.addEventListener('change', place);
  place();
}
