import type { Booking, Lead, Quote, Task } from '../../api/schemas';
import { DAY, addDays, dayKey, daysBetween, toDate } from '../../lib/time';
import { isLate, isStale } from '../../lib/rules';

/* =====================================================================================
 * G1 «Focus» — the pure brain of the «يومي» page. No React, no I/O: everything here is
 * computed from the bootstrap snapshot (+ quotes from billing) and a clock, and is unit-tested.
 * ===================================================================================== */

export type Me = { name: string; isAdmin: boolean };
const CLOSED = ['خسرناه', 'متوقف'];

/* ---------------- call queue ---------------- */

export type QueueReason = 'overdue' | 'due-today' | 'new-no-reply' | 'hot-cold' | 'stale';
export type QueueItem = { lead: Lead; reason: QueueReason; score: number; days: number };

export const REASON_LABEL: Record<QueueReason, [string, string]> = {
  overdue: ['متابعة متأخرة', 'Overdue follow-up'],
  'due-today': ['متابعة النهارده', 'Follow-up due today'],
  'new-no-reply': ['عميل جديد محدش رد عليه', 'New lead, no reply yet'],
  'hot-cold': ['مهتم جدًا ومحدش كلّمه', 'Hot lead going cold'],
  stale: ['بقاله فترة من غير تواصل', 'No contact for a while']
};

/** Hot = 4–5 interest dots (score ≥ 61) or «عالية» priority. */
export const isHot = (l: Lead) => (l.score != null && l.score > 60) || l.priority === 'عالية';

/** Days since the last contact (or since creation when never contacted). */
export function daysSilent(l: Lead, now: number): number {
  const ref = toDate(l.lastContact) || toDate(l.created);
  return ref ? Math.max(0, Math.floor((now - ref.getTime()) / DAY)) : 0;
}

/** Which leads this person works. Admins with no leads of their own work the whole book. */
export function myLeads(leads: Lead[], me: Me): Lead[] {
  const mine = leads.filter((l) => l.owner === me.name);
  return mine.length || !me.isAdmin ? mine : leads;
}

/**
 * Today's call queue, most urgent first. A lead is in the queue for exactly one reason (the strongest):
 * overdue follow-up › due today › new with no reply › hot going cold (3+ silent days) › stale.
 * Clients (type «حالي») and closed leads are not called from here; leads already handled today are skipped.
 */
export function buildQueue(input: { leads: Lead[]; me: Me; staleDays: number; handled?: Iterable<string> }, now: number): QueueItem[] {
  const handled = new Set(input.handled || []);
  const today = dayKey(new Date(now));
  const out: QueueItem[] = [];
  for (const l of myLeads(input.leads, input.me)) {
    if (handled.has(l.id) || CLOSED.includes(l.stage) || l.type === 'حالي' || l.stage === 'عميل نشط') continue;
    const silent = daysSilent(l, now);
    const fu = l.nextFollowUp ? dayKey(l.nextFollowUp) : '';
    let item: QueueItem | null = null;
    if (fu && fu < today) { const late = daysBetween(fu, today); item = { lead: l, reason: 'overdue', score: 100 + Math.min(late, 30), days: late }; }
    else if (fu && fu === today) item = { lead: l, reason: 'due-today', score: 90, days: 0 };
    else if (!fu && !l.firstReply && l.stage === 'جديد') item = { lead: l, reason: 'new-no-reply', score: 80 + Math.min(silent, 9), days: silent };
    else if (!fu && isHot(l) && silent >= 3) item = { lead: l, reason: 'hot-cold', score: 70 + Math.min(silent, 19), days: silent };
    else if (isStale(l, input.staleDays)) item = { lead: l, reason: 'stale', score: 50 + Math.min(silent, 30), days: silent };
    if (item) out.push(item);
  }
  return out.sort((a, b) => b.score - a.score || b.days - a.days || a.lead.id.localeCompare(b.lead.id));
}

/* ---------------- outcomes & next step ---------------- */

export type Outcome = 'answered' | 'no-answer' | 'meeting' | 'won' | 'lost';
export const OUTCOMES: { id: Outcome; key: string; label: [string, string]; summary: string; stage?: string; next: { text: string; days: number } | null }[] = [
  { id: 'answered', key: '1', label: ['رد', 'Answered'], summary: 'مكالمة: رد واتكلمنا', next: { text: 'متابعة بعد المكالمة', days: 3 } },
  { id: 'no-answer', key: '2', label: ['مردّش', 'No answer'], summary: 'مكالمة: مردّش', next: { text: 'اتصل تاني', days: 1 } },
  { id: 'meeting', key: '3', label: ['اتحدد اجتماع', 'Meeting set'], summary: 'مكالمة: اتحدد اجتماع', stage: 'اجتماع محجوز', next: { text: 'تأكيد الاجتماع', days: 1 } },
  { id: 'won', key: '4', label: ['كسبناه', 'Won'], summary: 'مكالمة: وافق واتقفلت الصفقة', stage: 'عميل نشط', next: { text: 'ترحيب وبدء التنفيذ', days: 1 } },
  { id: 'lost', key: '5', label: ['خسرناه', 'Lost'], summary: 'مكالمة: اعتذر', stage: 'خسرناه', next: null }
];
export const outcomeByKey = (k: string) => OUTCOMES.find((o) => o.key === k);

/** Date presets for the next step (keys 1–4 once an outcome is chosen). `days: null` = no follow-up. */
export const DATE_PRESETS: { key: string; days: number | null; label: [string, string] }[] = [
  { key: '1', days: 1, label: ['بكرة', 'Tomorrow'] },
  { key: '2', days: 3, label: ['بعد ٣ أيام', 'In 3 days'] },
  { key: '3', days: 7, label: ['الأسبوع الجاي', 'Next week'] },
  { key: '4', days: null, label: ['من غير متابعة', 'No follow-up'] }
];
/** The preset that matches an outcome's suggested delay (so the right chip is pre-selected). */
export function presetFor(o: Outcome): string {
  const d = OUTCOMES.find((x) => x.id === o)?.next?.days ?? null;
  return DATE_PRESETS.find((p) => p.days === d)?.key || '4';
}
/** yyyy-mm-dd for a preset, counted from today (Riyadh). Literal calendar days. */
export const dueFor = (days: number | null, today: string) => (days == null ? '' : addDays(today, days));

/**
 * Whether the stage should move for an outcome. A stage only moves forward on the path
 * (a «meeting» outcome never pulls a lead in «تفاوض» back to «اجتماع محجوز»). Won / lost always apply.
 */
const ORDER = ['جديد', 'تم التواصل', 'اجتماع محجوز', 'تم الاجتماع', 'عرض مرسل', 'تفاوض', 'فترة تجريبية', 'عميل نشط'];
export function stageAfter(current: string, o: Outcome): string | null {
  const target = OUTCOMES.find((x) => x.id === o)?.stage;
  if (!target || target === current) return null;
  if (o === 'won' || o === 'lost') return target;
  return ORDER.indexOf(target) > ORDER.indexOf(current) ? target : null;
}

/* ---------------- day progress ---------------- */

export type DayLog = { date: string; done: { id: string; outcome: Outcome; at: number }[] };
export function progress(log: DayLog, remaining: number) {
  const done = log.done.length;
  const total = done + remaining;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0, reached: log.done.filter((d) => d.outcome !== 'no-answer').length };
}
export function logOutcome(log: DayLog, today: string, id: string, outcome: Outcome, at: number): DayLog {
  const base = log.date === today ? log : { date: today, done: [] };
  return { date: today, done: [...base.done.filter((d) => d.id !== id), { id, outcome, at }] };
}

/* ---------------- next-best actions ---------------- */

export type ActionKind = 'overdue-followup' | 'hot-no-contact' | 'meeting-no-outcome' | 'quote-waiting' | 'renewal-soon';
export type NextAction = { id: string; kind: ActionKind; severity: 1 | 2 | 3; lead?: Lead; booking?: Booking; quote?: Quote; task?: Task; days: number; at: number };

export const ACTION_LABEL: Record<ActionKind, { title: [string, string]; cta: [string, string] }> = {
  'overdue-followup': { title: ['متابعة فاتت ميعادها', 'Overdue follow-up'], cta: ['كلّمه', 'Call'] },
  'hot-no-contact': { title: ['عميل مهتم ومحدش كلّمه', 'Hot lead, no contact'], cta: ['واتساب', 'WhatsApp'] },
  'meeting-no-outcome': { title: ['اجتماع من غير نتيجة', 'Meeting without outcome'], cta: ['سجّل النتيجة', 'Log outcome'] },
  'quote-waiting': { title: ['عرض سعر مستني رد', 'Quote awaiting reply'], cta: ['تابع العرض', 'Follow up'] },
  'renewal-soon': { title: ['تجديد قرّب', 'Renewal coming up'], cta: ['جهّز التجديد', 'Prepare renewal'] }
};

/**
 * What deserves attention beyond the call queue, most important first (severity 3 → 1, then oldest).
 * - overdue follow-ups: a lead whose next follow-up date passed, or an open task that is late;
 * - hot leads with no contact in 3+ days (or never);
 * - meetings that ended over an hour ago with no outcome logged;
 * - quotes sent 2+ days ago with no decision;
 * - client renewals in the next 30 days.
 */
export function nextBestActions(input: { leads: Lead[]; tasks: Task[]; bookings: Booking[]; quotes?: Quote[]; me: Me }, now: number, limit = 12): NextAction[] {
  const leads = myLeads(input.leads, input.me);
  const ids = new Set(leads.map((l) => l.id));
  const byId = new Map(input.leads.map((l) => [l.id, l]));
  const today = dayKey(new Date(now));
  const out: NextAction[] = [];
  const seen = new Set<string>();

  for (const l of leads) {
    if (CLOSED.includes(l.stage)) continue;
    const fu = l.nextFollowUp ? dayKey(l.nextFollowUp) : '';
    if (fu && fu < today) {
      const d = daysBetween(fu, today);
      out.push({ id: 'of' + l.id, kind: 'overdue-followup', severity: d >= 3 ? 3 : 2, lead: l, days: d, at: Date.parse(l.nextFollowUp) || 0 });
      seen.add(l.id);
    }
  }
  for (const x of input.tasks) {
    if (!isLate(x) || (x.leadId && !ids.has(x.leadId)) || (x.leadId && seen.has(x.leadId))) continue;
    if (!x.leadId && x.owner !== input.me.name) continue;
    const at = Date.parse(x.due);
    const d = Math.max(0, Math.floor((now - at) / DAY));
    out.push({ id: 'ot' + x.id, kind: 'overdue-followup', severity: d >= 3 ? 3 : 2, task: x, lead: byId.get(x.leadId), days: d, at });
    if (x.leadId) seen.add(x.leadId);
  }
  for (const l of leads) {
    if (CLOSED.includes(l.stage) || l.type === 'حالي' || seen.has(l.id) || !isHot(l)) continue;
    const d = daysSilent(l, now);
    if (!l.lastContact || d >= 3) out.push({ id: 'hn' + l.id, kind: 'hot-no-contact', severity: d >= 7 || !l.lastContact ? 3 : 2, lead: l, days: d, at: Date.parse(l.lastContact || l.created) || 0 });
  }
  for (const b of input.bookings) {
    if (b.leadId && !ids.has(b.leadId)) continue;
    const at = Date.parse(b.start);
    if (isNaN(at) || b.outcome || at > now - 3600e3) continue;
    if (b.status !== 'مؤكد' && b.status !== 'تم') continue;
    const d = Math.max(0, Math.floor((now - at) / DAY));
    out.push({ id: 'mo' + b.id, kind: 'meeting-no-outcome', severity: d >= 2 ? 3 : 2, booking: b, lead: byId.get(b.leadId), days: d, at });
  }
  for (const q of input.quotes || []) {
    if (!['اتبعت', 'اتفتح'].includes(q.status) || q.decidedAt) continue;
    if (q.leadId && !ids.has(q.leadId)) continue;
    const sent = Date.parse(q.sentAt || q.date);
    if (isNaN(sent)) continue;
    const d = Math.floor((now - sent) / DAY);
    if (d < 2) continue;
    out.push({ id: 'qw' + q.id, kind: 'quote-waiting', severity: d >= 5 ? 3 : 2, quote: q, lead: byId.get(q.leadId), days: d, at: sent });
  }
  for (const l of leads) {
    if (l.type !== 'حالي' || !l.renewal) continue;
    const r = Date.parse(l.renewal);
    if (isNaN(r) || r < now - DAY || r > now + 30 * DAY) continue;
    const d = Math.max(0, Math.ceil((r - now) / DAY));
    out.push({ id: 'rn' + l.id, kind: 'renewal-soon', severity: d <= 7 ? 2 : 1, lead: l, days: d, at: r });
  }
  return out.sort((a, b) => b.severity - a.severity || a.at - b.at).slice(0, limit);
}

/** Counts per kind (for the little tally above the list). */
export function countByKind(list: NextAction[]): Record<ActionKind, number> {
  const c: Record<ActionKind, number> = { 'overdue-followup': 0, 'hot-no-contact': 0, 'meeting-no-outcome': 0, 'quote-waiting': 0, 'renewal-soon': 0 };
  list.forEach((a) => { c[a.kind]++; });
  return c;
}

/* ---------------- greeting & edition line ---------------- */

/** «صباح الخير» before noon, «مساء الخير» after (Riyadh hour). */
export function greeting(hour: number): [string, string] {
  if (hour < 12) return ['صباح الخير', 'Good morning'];
  if (hour < 17) return ['نهارك سعيد', 'Good afternoon'];
  return ['مساء الخير', 'Good evening'];
}
/** Day of the year, used as the «issue number» of the day (the editorial masthead). */
export function issueNo(ymd: string): number {
  const [y] = ymd.split('-').map(Number);
  return daysBetween(y + '-01-01', ymd) + 1;
}
