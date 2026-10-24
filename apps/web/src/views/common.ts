import { labelOf } from '@daroon/shared';
import { esc } from '../core/util';
import { cvars } from '../domain/lexicon';
import { glyph } from '../ui/glyph';

/* ═════════════════════════ views ═════════════════════════ */
export const wordWithGlyph = (key: string, color?: string | null) =>
  `<span class="w" style="${cvars(key, color)}">${glyph(key, color)}<span>${esc(labelOf(key))}</span></span>`;
