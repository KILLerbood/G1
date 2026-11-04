import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useBoot } from '../../app/boot';
import { useActions } from '../../app/actions';
import { api } from '../../api/endpoints';
import { qk, refreshAfterWrite, upsertLead, upsertTask } from '../../api/queries';
import type { Lead } from '../../api/schemas';
import { useI18n } from '../../i18n';
import { Icon, Brand } from '../../components/Icon';
import { Avatar, Dots, Skel, StagePill, Empty } from '../../components/ui';
import { useToast } from '../../components/overlay';
import { errorText } from '../../api/errors';
import { useNow } from '../../lib/hooks';
import { store } from '../../lib/storage';
import { dayKey, riyadhParts } from '../../lib/time';
import { ago, fDateLong, fTime, rel } from '../../lib/format';
import { isLate, leadName } from '../../lib/rules';
import { useOpenLead } from '../lead/useOpenLead';
import { useAskLostReason, useLeadOps } from '../lead/mutations';
import { useLead } from '../../api/queries';
import { chordActive, digitOf, keyboardBusy } from '../../app/chord';
import {
  ACTION_LABEL, DATE_PRESETS, OUTCOMES, REASON_LABEL, buildQueue, countByKind, dueFor, greeting, issueNo, logOutcome,
  nextBestActions, presetFor, progress, stageAfter, type DayLog, type NextAction, type Outcome
} from './logic';
import { waPhone } from './whatsapp';

const logKey = (email: string) => 'g1-focus-day:' + email.toLowerCase();
const loadLog = (email: string, today: string): DayLog => {
  const v = store.json<DayLog | null>(logKey(email), null);
  return v && v.date === today && Array.isArray(v.done) ? v : { date: today, done: [] };
};
const toAr = (n: number, lang: string) => (lang === 'ar' ? n.toLocaleString('ar-EG') : String(n));

/** «يومي / Focus»: the home. A masthead with the day's progress, the one-key call queue, and the next-best actions. */
export function Focus() {
  const { t, lang } = useI18n();
  const boot = useBoot();
  const now = useNow(60_000);
  const today = dayKey(new Date(now));
  const me = boot.me;
  const [log, setLogState] = useState<DayLog>(() => loadLog(me.email, today));
  const setLog = useCallback((l: DayLog) => { store.setJson(logKey(me.email), l); setLogState(l); }, [me.email]);
  useEffect(() => { if (log.date !== today) setLog({ date: today, done: [] }); }, [today, log.date, setLog]);

  const quotesQ = useQuery({ queryKey: ['g1-quotes'], queryFn: () => api.billing({}), staleTime: 120_000, select: (b) => b.quotes });
  const queue = useMemo(() => buildQueue({ leads: boot.leads, me, staleDays: boot.settings.staleDays || 7, handled: log.done.map((d) => d.id) }, now), [boot.leads, me, boot.settings.staleDays, log, now]);
  const actions = useMemo(() => nextBestActions({ leads: boot.leads, tasks: boot.tasks, bookings: boot.bookings, quotes: quotesQ.data, me }, now, 10), [boot.leads, boot.tasks, boot.bookings, quotesQ.data, me, now]);
  const prog = progress(log, queue.length);
  const meetingsToday = boot.bookings.filter((b) => b.status === 'مؤكد' && dayKey(b.start) === today).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const tasksToday = boot.tasks.filter((x) => x.status === 'مفتوحة' && (x.owner === me.name || me.isAdmin && !x.owner) && (isLate(x) || dayKey(x.due) === today)).sort((a, b) => Date.parse(a.due) - Date.parse(b.due));
  const [jump, setJump] = useState<{ id: string; n: number } | null>(null);
  const [params, setParams] = useSearchParams();
  // «?start=1» (from Ctrl+K) starts the queue right away.
  useEffect(() => {
    if (params.get('start') === '1' && queue[0]) { setJump({ id: queue[0].lead.id, n: Date.now() }); setParams((p) => { const n = new URLSearchParams(p); n.delete('start'); return n; }, { replace: true }); }
  }, [params, queue, setParams]);

  const hour = riyadhParts(new Date(now)).h;
  const [hi, hiEn] = greeting(hour);
  const first = me.name.split(/\s+/)[0];

  return (
    <div className="focus">
      <header className="f-mast">
        <div className="f-kicker">
          <span className="f-kicker__no num">{t('العدد ', 'No. ') + toAr(issueNo(today), lang)}</span>
          <span>{fDateLong(new Date(now), lang)}</span>
          <span className="f-kicker__rule" aria-hidden="true" />
          <span>{t('يومي', 'Focus')}</span>
        </div>
        <h1 className="f-title display">
          {t(hi, hiEn)}{t(' يا ', ', ')}{first}.
          <span className="f-title__sub">{queue.length
            ? t('قدامك ', 'You have ') + toAr(queue.length, lang) + t(' مكالمة', ' calls') + (meetingsToday.length ? t(' و', ' and ') + toAr(meetingsToday.length, lang) + t(' اجتماع النهارده.', ' meetings today.') : t(' النهارده.', ' today.'))
            : t('الطابور فاضي. يوم هادي، استغله في المتابعات.', 'The queue is empty. A calm day: use it for follow-ups.')}</span>
        </h1>
        <div className="f-progress" data-tour="progress">
          <div className="f-progress__head">
            <b className="num">{toAr(prog.done, lang)}<span> / {toAr(prog.total, lang)}</span></b>
            <span>{t('مكالمة اتسجلت النهارده', 'calls logged today')}{prog.reached ? t(' · وصلت لـ ', ' · reached ') + toAr(prog.reached, lang) : ''}</span>
            <span className="grow" />
            <b className="num f-progress__pct">{prog.pct}%</b>
          </div>
          <div className="f-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={prog.pct} aria-label={t('تقدّم اليوم', 'Day progress')}>
            <i style={{ width: prog.pct + '%' }} />
            {Array.from({ length: Math.min(prog.total, 40) }, (_, i) => <span key={i} className="f-bar__tick" style={{ insetInlineStart: ((i + 1) / Math.min(prog.total, 40)) * 100 + '%' }} />)}
          </div>
        </div>
        <dl className="f-figs">
          <div><dt>{t('في الطابور', 'In queue')}</dt><dd className="num">{toAr(queue.length, lang)}</dd></div>
          <div><dt>{t('اجتماعات النهارده', 'Meetings today')}</dt><dd className="num">{toAr(meetingsToday.length, lang)}</dd></div>
          <div><dt>{t('مهام متأخرة', 'Late tasks')}</dt><dd className={'num' + (tasksToday.some(isLate) ? ' is-bad' : '')}>{toAr(tasksToday.filter(isLate).length, lang)}</dd></div>
          <div><dt>{t('خطوات مهمة', 'Key actions')}</dt><dd className="num">{toAr(actions.length, lang)}</dd></div>
        </dl>
      </header>

      <div className="f-grid">
        <CallQueue queue={queue} log={log} setLog={setLog} today={today} jump={jump} />
        <aside className="f-side">
          <NextActions list={actions} loadingQuotes={quotesQ.isLoading} onCall={(id) => setJump({ id, n: Date.now() })} />
          <Agenda meetings={meetingsToday} tasks={tasksToday} />
        </aside>
      </div>
    </div>
  );
}

/* ================================ call queue ================================ */

type Phase = 'outcome' | 'next';
function CallQueue({ queue, log, setLog, today, jump }: { queue: ReturnType<typeof buildQueue>; log: DayLog; setLog: (l: DayLog) => void; today: string; jump: { id: string; n: number } | null }) {
  const { t, v, lang } = useI18n();
  const boot = useBoot();
  const actions = useActions();
  const openLead = useOpenLead();
  const qc = useQueryClient();
  const toast = useToast();
  const askLost = useAskLostReason();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>('outcome');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [note, setNote] = useState('');
  const [preset, setPreset] = useState('1');
  const [busy, setBusy] = useState(false);
  const noteRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLElement>(null);

  // Skipped leads go to the back of the line (this session only).
  const ordered = useMemo(() => [...queue.filter((q) => !skipped.includes(q.lead.id)), ...queue.filter((q) => skipped.includes(q.lead.id))], [queue, skipped]);
  const active = activeId ? boot.leads.find((l) => l.id === activeId) || null : null;
  const activeItem = ordered.find((q) => q.lead.id === activeId);
  const pos = activeItem ? ordered.indexOf(activeItem) : -1;
  const doneAll = !active && log.done.length > 0 && ordered.length === 0;

  const open = useCallback((id: string | null) => {
    setActiveId(id); setPhase('outcome'); setOutcome(null); setNote(''); setBusy(false);
    if (id) requestAnimationFrame(() => cardRef.current?.focus({ preventScroll: false }));
  }, []);
  useEffect(() => { if (jump) open(jump.id); }, [jump, open]);
  const nextAfter = (id: string) => ordered.find((q) => q.lead.id !== id)?.lead.id || null;
  const start = () => open(ordered[0]?.lead.id || null);
  const skip = () => { if (!active) return; const id = active.id; setSkipped((s) => [...s.filter((x) => x !== id), id]); open(ordered.filter((q) => q.lead.id !== id)[0]?.lead.id || id); };
  const choose = (o: Outcome) => {
    const def = OUTCOMES.find((x) => x.id === o)!;
    setOutcome(o); setNote(def.next?.text || ''); setPreset(presetFor(o)); setPhase('next');
  };

  async function save() {
    if (!active || !outcome || busy) return;
    const lead = active;
    const def = OUTCOMES.find((x) => x.id === outcome)!;
    let lostReason = '';
    if (outcome === 'lost') { lostReason = await askLost(lead); if (!lostReason) return; }
    setBusy(true);
    const days = DATE_PRESETS.find((p) => p.key === preset)?.days ?? null;
    const due = outcome === 'lost' ? '' : dueFor(days, today);
    const stage = stageAfter(lead.stage, outcome);
    // Advance first: the next lead is on screen while the writes go out.
    setLog(logOutcome(log, today, lead.id, outcome, Date.now()));
    open(nextAfter(lead.id));
    try {
      const r = await api.addActivity({ leadId: lead.id, kind: 'مكالمة', direction: 'صادر', summary: def.summary, details: note.trim() });
      if (r.lead) upsertLead(qc, r.lead);
      const patch: Record<string, unknown> = {};
      if (stage) patch.stage = stage;
      if (lostReason) patch.lostReason = lostReason;
      if (due || lead.nextFollowUp) patch.nextFollowUp = due;
      if (Object.keys(patch).length) { const s = await api.saveLead({ id: lead.id, ...patch }); if (s.lead) upsertLead(qc, s.lead); }
      if (due && note.trim()) { const tk = await api.addTask({ leadId: lead.id, task: note.trim(), due, owner: boot.me.name }); upsertTask(qc, tk.task); }
      refreshAfterWrite(qc, lead.id);
      qc.invalidateQueries({ queryKey: qk.boot });
      toast(leadName(lead) + ' · ' + t(def.label[0], def.label[1]) + (due ? t(' · متابعة ', ' · follow-up ') + rel(due, lang) : ''));
    } catch (e) { toast(errorText(e, lang), { err: true }); }
  }

  // The keyboard drives the whole queue. Layout-independent (e.code), so it works on an Arabic keyboard too.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || chordActive()) return;
      const { typing, dialog } = keyboardBusy();
      if (dialog || typing) return;
      const d = digitOf(e);
      if (!active) {
        if (e.code === 'Space' && ordered.length) { e.preventDefault(); start(); }
        return;
      }
      if (phase === 'outcome') {
        const o = OUTCOMES.find((x) => x.key === d);
        if (o) { e.preventDefault(); choose(o.id); return; }
      } else {
        const p = DATE_PRESETS.find((x) => x.key === d);
        if (p && outcome !== 'lost') { e.preventDefault(); setPreset(p.key); return; }
        if (e.key === 'Enter') { e.preventDefault(); void save(); return; }
        if (e.code === 'KeyE') { e.preventDefault(); noteRef.current?.focus(); return; }
        if (e.key === 'Backspace') { e.preventDefault(); setPhase('outcome'); return; }
      }
      if (e.code === 'Escape') { e.preventDefault(); if (phase === 'next') setPhase('outcome'); else open(null); }
      else if (e.code === 'KeyS') { e.preventDefault(); skip(); }
      else if (e.code === 'KeyW') { e.preventDefault(); actions.whatsapp(active); }
      else if (e.code === 'KeyC' && active.phone) { e.preventDefault(); window.location.href = 'tel:' + active.phone; }
      else if (e.code === 'KeyO') { e.preventDefault(); openLead(active.id); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  return (
    <section className="f-queue" data-tour="queue" aria-labelledby="q-h">
      <div className="f-sec">
        <span className="f-sec__no num">01</span>
        <h2 id="q-h">{t('طابور المكالمات', 'Call queue')}</h2>
        <span className="f-sec__meta">{ordered.length ? toAr(ordered.length, lang) + t(' متبقي', ' left') : ''}</span>
      </div>

      {!active ? (
        doneAll ? (
          <div className="q-idle q-idle--done">
            <span className="q-idle__big display">{t('خلصت الطابور.', 'Queue cleared.')}</span>
            <p>{t('سجّلت ', 'You logged ')}{toAr(log.done.length, lang)}{t(' مكالمة النهارده. شوف «أهم الخطوات» على الجنب.', ' calls today. Check the next-best actions alongside.')}</p>
          </div>
        ) : ordered.length ? (
          <div className="q-idle">
            <button className="q-start" onClick={start} autoFocus={false}>
              <span className="q-start__lbl">{t('ابدأ الطابور', 'Start the queue')}</span>
              <span className="q-start__next">{t('أول واحد: ', 'First: ')}<b>{leadName(ordered[0].lead)}</b> · {t(REASON_LABEL[ordered[0].reason][0], REASON_LABEL[ordered[0].reason][1])}</span>
              <kbd className="q-start__kbd">Space</kbd>
            </button>
            <p className="hint">{t('بعد كده كله بالكيبورد: 1–5 للنتيجة، 1–4 لميعاد المتابعة، Enter للي بعده، S تخطّي، W واتساب.', 'Then it’s all keyboard: 1–5 outcome, 1–4 follow-up date, Enter next, S skip, W WhatsApp.')}</p>
          </div>
        ) : (
          <Empty icon="check" title={t('مفيش مكالمات مستنياك', 'No calls waiting')}>{t('كل المتابعات في ميعادها. ضيف عميل جديد بـ N أو شوف المسار.', 'Every follow-up is on schedule. Add a lead with N or check the pipeline.')}</Empty>
        )
      ) : (
        <article ref={cardRef} tabIndex={-1} className="q-card page-enter" key={active.id} aria-label={leadName(active)}>
          <div className="q-card__meta">
            <span className="num">{toAr(pos + 1, lang)} / {toAr(ordered.length, lang)}</span>
            {activeItem ? <span className="q-reason"><i aria-hidden="true" />{t(REASON_LABEL[activeItem.reason][0], REASON_LABEL[activeItem.reason][1])}{activeItem.days ? ' · ' + toAr(activeItem.days, lang) + t(' يوم', 'd') : ''}</span> : <span className="q-reason">{t('من خارج الطابور', 'Picked manually')}</span>}
            <span className="grow" />
            <button className="link-btn" onClick={() => open(null)}>{t('إيقاف', 'Stop')} <kbd>Esc</kbd></button>
          </div>
          <h3 className="q-card__name display">{leadName(active)}</h3>
          <p className="q-card__who">{[active.name !== leadName(active) ? active.name : '', active.city, active.owner].filter(Boolean).join(' · ')}</p>
          <div className="q-card__tags"><StagePill stage={active.stage} /><Dots lead={active} />{active.lastContact ? <span className="faint">{t('آخر تواصل ', 'Last contact ')}{ago(active.lastContact, lang)}</span> : <span className="faint">{t('محدش كلّمه لسه', 'Never contacted')}</span>}</div>

          <div className="q-card__contact">
            <a className="q-phone num ltr" href={active.phone ? 'tel:' + active.phone : undefined} aria-disabled={!active.phone}>{active.phone || t('مفيش رقم', 'No phone')}</a>
            <div className="row wrap" style={{ gap: 8 }}>
              <a className="btn btn--sm" href={active.phone ? 'tel:' + active.phone : undefined} aria-disabled={!active.phone}><Icon name="phone" />{t('اتصل', 'Call')}<kbd>C</kbd></a>
              <button className="btn btn--sm" onClick={() => actions.whatsapp(active)} disabled={!waPhone(active.phone) && !active.phone}><Brand name="wa" size={16} />{t('واتساب', 'WhatsApp')}<kbd>W</kbd></button>
              <button className="btn btn--sm btn--ghost" onClick={() => openLead(active.id)}><Icon name="doc" />{t('الملف', 'Profile')}<kbd>O</kbd></button>
              <button className="btn btn--sm btn--ghost" onClick={skip}>{t('تخطّي', 'Skip')}<kbd>S</kbd></button>
            </div>
          </div>

          <LeadContext lead={active} />

          {phase === 'outcome' ? (
            <div className="q-outcomes" role="group" aria-label={t('نتيجة المكالمة', 'Call outcome')}>
              {OUTCOMES.map((o) => (
                <button key={o.id} className={'q-out q-out--' + o.id} onClick={() => choose(o.id)}>
                  <kbd>{o.key}</kbd><span>{t(o.label[0], o.label[1])}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="q-next page-enter">
              <div className="q-next__head">
                <span className={'q-chosen q-out--' + outcome}>{t(OUTCOMES.find((o) => o.id === outcome)!.label[0], OUTCOMES.find((o) => o.id === outcome)!.label[1])}</span>
                <button className="link-btn" onClick={() => setPhase('outcome')}>{t('غيّر', 'Change')} <kbd>⌫</kbd></button>
              </div>
              {outcome !== 'lost' ? (
                <>
                  <label className="field">{t('الخطوة الجاية', 'Next step')}
                    <input ref={noteRef} className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('اكتب الخطوة الجاية…', 'Write the next step…')}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void save(); } if (e.key === 'Escape') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }} />
                  </label>
                  <div className="q-dates" role="radiogroup" aria-label={t('ميعاد المتابعة', 'Follow-up date')}>
                    {DATE_PRESETS.map((p) => (
                      <button key={p.key} role="radio" aria-checked={preset === p.key} className="q-date" onClick={() => setPreset(p.key)}>
                        <kbd>{p.key}</kbd><span>{t(p.label[0], p.label[1])}</span>{p.days != null ? <small className="num">{fDateLong(dueFor(p.days, today), lang).split('،')[0]}</small> : null}
                      </button>
                    ))}
                  </div>
                </>
              ) : <p className="hint">{t('هنسألك عن سبب الخسارة، وبعدها ننقلك للي بعده.', 'We’ll ask for the lost reason, then move to the next one.')}</p>}
              <div className="row wrap" style={{ gap: 10 }}>
                <button className="btn btn--accent" onClick={() => void save()} disabled={busy}>{t('احفظ وكمّل', 'Save & next')}<kbd className="kbd-on">Enter</kbd></button>
                {outcome === 'meeting' ? <button className="btn" onClick={() => actions.book(active)}><Icon name="calendar" />{t('احجز الميعاد', 'Book the slot')}</button> : null}
                <span className="faint" style={{ fontSize: 12.5 }}>{t('E لتعديل الخطوة', 'E to edit the step')}</span>
              </div>
            </div>
          )}
        </article>
      )}

      {ordered.length > (active ? 1 : 0) ? (
        <ol className="q-list" aria-label={t('اللي بعده', 'Up next')}>
          {ordered.filter((q) => q.lead.id !== activeId).slice(0, 8).map((q) => (
            <li key={q.lead.id}>
              <button className="q-row" onClick={() => open(q.lead.id)}>
                <span className="q-row__n num">{String(ordered.indexOf(q) + 1).padStart(2, '0')}</span>
                <span className="q-row__t"><b>{leadName(q.lead)}</b><small>{t(REASON_LABEL[q.reason][0], REASON_LABEL[q.reason][1])}{q.days ? ' · ' + toAr(q.days, lang) + t(' يوم', 'd') : ''}</small></span>
                <span className="q-row__s">{v(q.lead.stage)}</span>
              </button>
            </li>
          ))}
          {ordered.length - (active ? 1 : 0) > 8 ? <li className="q-list__more faint">+{toAr(ordered.length - (active ? 1 : 0) - 8, lang)} {t('كمان', 'more')}</li> : null}
        </ol>
      ) : null}
    </section>
  );
}

/** What you need on screen while dialling: the notes and the last three touches. */
function LeadContext({ lead }: { lead: Lead }) {
  const { t, v, lang } = useI18n();
  const q = useLead(lead.id);
  const acts = (q.data?.activities || []).slice().sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 3);
  return (
    <div className="q-ctx">
      {lead.notes ? <p className="q-ctx__note">“{lead.notes}”</p> : null}
      {q.isLoading ? <div className="stack" style={{ gap: 6 }}><Skel h={14} w="70%" r={3} /><Skel h={14} w="50%" r={3} /></div> : acts.length ? (
        <ul className="q-ctx__log">
          {acts.map((a) => <li key={a.id}><span className="faint num">{ago(a.date, lang)}</span><span>{v(a.kind)} · {a.summary}</span></li>)}
        </ul>
      ) : <p className="faint" style={{ margin: 0, fontSize: 13 }}>{t('مفيش تواصل متسجّل قبل كده.', 'No contact logged yet.')}</p>}
    </div>
  );
}

/* ================================ next-best actions ================================ */

function NextActions({ list, loadingQuotes, onCall }: { list: NextAction[]; loadingQuotes: boolean; onCall: (id: string) => void }) {
  const { t, lang } = useI18n();
  const actions = useActions();
  const openLead = useOpenLead();
  const counts = countByKind(list);
  const detail = (a: NextAction) => {
    const n = toAr(a.days, lang);
    switch (a.kind) {
      case 'overdue-followup': return a.task ? a.task.task + ' · ' + t('متأخرة ' + n + ' يوم', n + 'd late') : t('المتابعة متأخرة ' + n + ' يوم', 'Follow-up ' + n + 'd late');
      case 'hot-no-contact': return a.lead?.lastContact ? t('آخر تواصل من ' + n + ' يوم', 'Last contact ' + n + 'd ago') : t('محدش كلّمه خالص', 'Never contacted');
      case 'meeting-no-outcome': return (a.booking?.meetingType || '') + ' · ' + fTime(a.booking?.start, lang) + ' ' + rel(a.booking?.start, lang);
      case 'quote-waiting': return (a.quote?.id || '') + ' · ' + t('من ' + n + ' يوم', n + 'd ago');
      case 'renewal-soon': return t('التجديد بعد ' + n + ' يوم', 'Renews in ' + n + 'd');
    }
  };
  const run = (a: NextAction) => {
    const l = a.lead;
    if (!l) return;
    if (a.kind === 'overdue-followup') onCall(l.id);
    else if (a.kind === 'hot-no-contact' || a.kind === 'quote-waiting') actions.whatsapp(l);
    else if (a.kind === 'meeting-no-outcome') openLead(l.id, 'log');
    else openLead(l.id, 'money');
  };
  return (
    <section className="f-actions" data-tour="actions" aria-labelledby="na-h">
      <div className="f-sec">
        <span className="f-sec__no num">02</span>
        <h2 id="na-h">{t('أهم الخطوات الجاية', 'Next best actions')}</h2>
      </div>
      <div className="na-tally" aria-hidden="true">
        {(Object.keys(counts) as (keyof typeof counts)[]).map((k) => <span key={k} className={counts[k] ? 'on' : ''}><b className="num">{toAr(counts[k], lang)}</b>{t(ACTION_LABEL[k].title[0], ACTION_LABEL[k].title[1])}</span>)}
      </div>
      {list.length ? (
        <ol className="na-list">
          {list.map((a) => (
            <li key={a.id} className={'na na--s' + a.severity}>
              <span className="na__sev" aria-label={t('الأهمية ', 'Severity ') + a.severity} />
              <button className="na__main" onClick={() => a.lead && openLead(a.lead.id)}>
                <small>{t(ACTION_LABEL[a.kind].title[0], ACTION_LABEL[a.kind].title[1])}</small>
                <b>{a.lead ? leadName(a.lead) : a.task?.task || '—'}</b>
                <span className="faint">{detail(a)}</span>
              </button>
              {a.lead ? <button className="btn btn--sm na__cta" onClick={() => run(a)}>{t(ACTION_LABEL[a.kind].cta[0], ACTION_LABEL[a.kind].cta[1])}</button> : null}
            </li>
          ))}
        </ol>
      ) : loadingQuotes ? <div className="stack"><Skel h={56} r={4} /><Skel h={56} r={4} /></div> : <Empty icon="check" title={t('مفيش حاجة فايتاك', 'Nothing is slipping')}>{t('لا متابعات متأخرة ولا عروض مستنية. برافو.', 'No overdue follow-ups, no waiting quotes. Nice.')}</Empty>}
    </section>
  );
}

/* ================================ today's agenda ================================ */

function Agenda({ meetings, tasks }: { meetings: ReturnType<typeof useBoot>['bookings']; tasks: ReturnType<typeof useBoot>['tasks'] }) {
  const { t, lang } = useI18n();
  const ops = useLeadOps();
  const openLead = useOpenLead();
  return (
    <section className="f-agenda" aria-labelledby="ag-h">
      <div className="f-sec">
        <span className="f-sec__no num">03</span>
        <h2 id="ag-h">{t('أجندة النهارده', 'Today’s agenda')}</h2>
      </div>
      {!meetings.length && !tasks.length ? <p className="faint" style={{ margin: 0 }}>{t('مفيش اجتماعات ولا مهام النهارده.', 'No meetings or tasks today.')}</p> : null}
      <ul className="ag-list">
        {meetings.map((b) => (
          <li key={b.id} className="ag ag--meet">
            <span className="ag__time num">{fTime(b.start, lang)}</span>
            <button className="ag__t" onClick={() => openLead(b.leadId, 'log')}><b>{b.business || b.name}</b><small>{b.meetingType} · {b.platform}</small></button>
            {b.meetLink ? <a className="btn btn--sm" href={b.meetLink} target="_blank" rel="noopener noreferrer"><Icon name="video" />{t('ادخل', 'Join')}</a> : null}
          </li>
        ))}
        {tasks.map((x) => (
          <li key={x.id} className={'ag' + (isLate(x) ? ' ag--late' : '')}>
            <label className="ag__check"><input type="checkbox" onChange={() => ops.setTask(x, 'تمت')} aria-label={t('خلصت: ', 'Done: ') + x.task} /></label>
            <button className="ag__t" onClick={() => x.leadId && openLead(x.leadId, 'tasks')}><b>{x.task}</b><small>{x.leadName || '—'} · {isLate(x) ? t('متأخرة · ', 'late · ') : ''}{rel(x.due, lang)}</small></button>
            <Avatar name={x.owner} size="xs" />
          </li>
        ))}
      </ul>
    </section>
  );
}
