import { foldAr } from '../lib/format';

/**
 * How well a command label matches what was typed (0 = no match). Pure, used by the Ctrl+K palette.
 * Exact > starts-with > a word starts-with > contains > all words found anywhere. Arabic spelling is folded.
 */
export function matchScore(label: string, query: string, extra = ''): number {
  const q = foldAr(query);
  if (!q) return 1;
  const l = foldAr(label);
  if (l === q) return 100;
  if (l.startsWith(q)) return 80;
  if (l.split(' ').some((w) => w.startsWith(q))) return 60;
  if (l.includes(q)) return 40;
  const hay = l + ' ' + foldAr(extra);
  return q.split(' ').every((w) => hay.includes(w)) ? 20 : 0;
}

/** Sort commands by score (stable for ties) and drop non-matches. */
export function rankBy<T>(items: T[], query: string, text: (x: T) => [string, string?]): T[] {
  return items
    .map((x, i) => { const [label, extra] = text(x); return { x, i, s: matchScore(label, query, extra) }; })
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((r) => r.x);
}
