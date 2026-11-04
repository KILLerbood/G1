import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildQueue, nextBestActions, progress, logOutcome, stageAfter, presetFor, dueFor, greeting, issueNo, countByKind, isHot, daysSilent, myLeads, outcomeByKey, type DayLog } from '../logic';

const NOW = Date.parse('2026-11-03T09:00:00Z'); // 12:00 Riyadh
const D = 864e5;
const iso = (ms: number) => new Date(ms).toISOString();
const me = { name: 'نور حسن', isAdmin: false };
const lead = (o: object) => ({ id: 'L-1', business: 'X', name: 'Y', stage: 'تم التواصل', type: 'متوقع', priority: 'متوسطة', score: 40, owner: 'نور حسن', firstReply: iso(NOW - 9 * D), lastContact: iso(NOW - D), created: iso(NOW - 20 * D), nextFollowUp: '', renewal: '', ...o }) as never;
const task = (o: object) => ({ id: 'T-1', leadId: 'L-1', task: 't', owner: 'نور حسن', due: iso(NOW - 3600e3), status: 'مفتوحة', ...o }) as never;
const booking = (o: object) => ({ id: 'M-1', leadId: 'L-1', start: iso(NOW - 3 * 3600e3), status: 'مؤكد', outcome: '', ...o }) as never;
const quote = (o: object) => ({ id: 'Q-1', leadId: 'L-1', status: 'اتبعت', sentAt: iso(NOW - 4 * D), date: iso(NOW - 4 * D), decidedAt: '', ...o }) as never;

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterAll(() => { vi.useRealTimers(); });

describe('buildQueue', () => {
  it('ranks overdue › due today › new › hot going cold › stale', () => {
    const q = buildQueue({ me, staleDays: 7, leads: [
      lead({ id: 'stale', lastContact: iso(NOW - 15 * D) }),
      lead({ id: 'hot', score: 90, lastContact: iso(NOW - 4 * D) }),
      lead({ id: 'new', stage: 'جديد', firstReply: '', lastContact: '' }),
      lead({ id: 'today', nextFollowUp: iso(NOW) }),
      lead({ id: 'late', nextFollowUp: iso(NOW - 2 * D) })
    ] }, NOW);
    expect(q.map((x) => x.reason)).toEqual(['overdue', 'due-today', 'new-no-reply', 'hot-cold', 'stale']);
    expect(q[0].days).toBe(2);
  });
  it('skips clients, closed leads, other owners and leads handled today', () => {
    const q = buildQueue({ me, staleDays: 7, handled: ['h'], leads: [
      lead({ id: 'c', type: 'حالي', stage: 'عميل نشط', nextFollowUp: iso(NOW - D) }),
      lead({ id: 'l', stage: 'خسرناه', nextFollowUp: iso(NOW - D) }),
      lead({ id: 'o', owner: 'يوسف', nextFollowUp: iso(NOW - D) }),
      lead({ id: 'h', nextFollowUp: iso(NOW - D) })
    ] }, NOW);
    expect(q).toEqual([]);
  });
  it('leaves out a lead whose follow-up is in the future even if contact is old', () => {
    expect(buildQueue({ me, staleDays: 7, leads: [lead({ lastContact: iso(NOW - 30 * D), nextFollowUp: iso(NOW + 2 * D) })] }, NOW)).toEqual([]);
  });
  it('an older overdue follow-up comes before a newer one', () => {
    const q = buildQueue({ me, staleDays: 7, leads: [lead({ id: 'a', nextFollowUp: iso(NOW - D) }), lead({ id: 'b', nextFollowUp: iso(NOW - 5 * D) })] }, NOW);
    expect(q.map((x) => x.lead.id)).toEqual(['b', 'a']);
  });
});

describe('myLeads / helpers', () => {
  it('admins with no own leads work the whole book; sales only theirs', () => {
    const all = [lead({ owner: 'يوسف' })];
    expect(myLeads(all, { name: 'عبد الله', isAdmin: true })).toHaveLength(1);
    expect(myLeads(all, me)).toHaveLength(0);
  });
  it('isHot and daysSilent', () => {
    expect(isHot(lead({ score: 61 }))).toBe(true);
    expect(isHot(lead({ score: 20, priority: 'عالية' }))).toBe(true);
    expect(isHot(lead({ score: null }))).toBe(false);
    expect(daysSilent(lead({ lastContact: iso(NOW - 3.5 * D) }), NOW)).toBe(3);
    expect(daysSilent(lead({ lastContact: '', created: iso(NOW - 2 * D) }), NOW)).toBe(2);
  });
});

describe('outcomes', () => {
  it('maps keys to outcomes', () => {
    expect(outcomeByKey('2')?.id).toBe('no-answer');
    expect(outcomeByKey('9')).toBeUndefined();
  });
  it('only moves the stage forward, but won/lost always apply', () => {
    expect(stageAfter('تم التواصل', 'meeting')).toBe('اجتماع محجوز');
    expect(stageAfter('تفاوض', 'meeting')).toBeNull();
    expect(stageAfter('تفاوض', 'won')).toBe('عميل نشط');
    expect(stageAfter('جديد', 'lost')).toBe('خسرناه');
    expect(stageAfter('جديد', 'answered')).toBeNull();
  });
  it('pre-selects the date preset that matches the outcome', () => {
    expect(presetFor('no-answer')).toBe('1');
    expect(presetFor('answered')).toBe('2');
    expect(presetFor('lost')).toBe('4');
    expect(dueFor(1, '2026-11-03')).toBe('2026-11-04');
    expect(dueFor(7, '2026-11-28')).toBe('2026-12-05');
    expect(dueFor(null, '2026-11-03')).toBe('');
  });
});

describe('progress', () => {
  it('counts done over done + remaining and resets on a new day', () => {
    let log: DayLog = { date: '2026-11-03', done: [] };
    log = logOutcome(log, '2026-11-03', 'a', 'answered', 1);
    log = logOutcome(log, '2026-11-03', 'b', 'no-answer', 2);
    log = logOutcome(log, '2026-11-03', 'a', 'meeting', 3); // re-logging the same lead replaces it
    expect(progress(log, 6)).toEqual({ done: 2, total: 8, pct: 25, reached: 1 });
    expect(logOutcome(log, '2026-11-04', 'c', 'won', 4).done).toHaveLength(1);
    expect(progress({ date: 'x', done: [] }, 0).pct).toBe(0);
  });
});

describe('nextBestActions', () => {
  it('finds the five kinds and orders by severity then age', () => {
    const list = nextBestActions({
      me,
      leads: [
        lead({ id: 'L-1', nextFollowUp: iso(NOW - 4 * D) }),
        lead({ id: 'L-2', score: 95, lastContact: '' }),
        lead({ id: 'L-3', type: 'حالي', stage: 'عميل نشط', renewal: iso(NOW + 10 * D) })
      ],
      tasks: [],
      bookings: [booking({ leadId: 'L-2' })],
      quotes: [quote({ leadId: 'L-1' })]
    }, NOW);
    expect(countByKind(list)).toEqual({ 'overdue-followup': 1, 'hot-no-contact': 1, 'meeting-no-outcome': 1, 'quote-waiting': 1, 'renewal-soon': 1 });
    expect(list[0].severity).toBe(3);
    expect(list[list.length - 1].kind).toBe('renewal-soon');
  });
  it('does not repeat a lead as a late task when it is already an overdue follow-up', () => {
    const list = nextBestActions({ me, leads: [lead({ nextFollowUp: iso(NOW - 2 * D) })], tasks: [task({ due: iso(NOW - 2 * D) })], bookings: [] }, NOW);
    expect(list.map((a) => a.kind)).toEqual(['overdue-followup']);
  });
  it('ignores fresh quotes, decided quotes, meetings with an outcome and far renewals', () => {
    const list = nextBestActions({
      me,
      leads: [lead({}), lead({ id: 'L-9', type: 'حالي', stage: 'عميل نشط', renewal: iso(NOW + 60 * D) })],
      tasks: [],
      bookings: [booking({ outcome: 'اتفقنا' }), booking({ id: 'M-2', start: iso(NOW - 10 * 60e3) })],
      quotes: [quote({ sentAt: iso(NOW - D) }), quote({ id: 'Q-2', status: 'اتوافق عليه' })]
    }, NOW);
    expect(list).toEqual([]);
  });
  it('respects the limit', () => {
    const leads = Array.from({ length: 20 }, (_, i) => lead({ id: 'L' + i, nextFollowUp: iso(NOW - (i + 1) * D) }));
    expect(nextBestActions({ me, leads, tasks: [], bookings: [] }, NOW, 5)).toHaveLength(5);
  });
});

describe('masthead', () => {
  it('greets by hour and numbers the day of the year', () => {
    expect(greeting(8)[0]).toBe('صباح الخير');
    expect(greeting(14)[0]).toBe('نهارك سعيد');
    expect(greeting(20)[0]).toBe('مساء الخير');
    expect(issueNo('2026-01-01')).toBe(1);
    expect(issueNo('2026-11-03')).toBe(307);
  });
});
