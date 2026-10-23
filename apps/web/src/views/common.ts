import { labelOf } from '@daroon/shared';
import { esc } from '../core/util';
import { cvars, lex } from '../domain/lexicon';
import { DB } from '../state/store';
import { glyph } from '../ui/glyph';

/* ═════════════════════════ views ═════════════════════════ */
export const emoji = key => DB.settings.emoji && lex(key).emo ? `<span class="emo" aria-hidden="true">${lex(key).emo}</span>` : '';
export const wordWithGlyph = (key: string, color?: string | null) => `<span class="w" style="${cvars(key, color)}">${glyph(key, color)}<span>${esc(labelOf(key))}</span>${emoji(key)}</span>`;
