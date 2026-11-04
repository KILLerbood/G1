import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { useI18n } from '../i18n';
import { useTheme } from '../app/theme';
import type { Bootstrap, Lead } from '../api/schemas';
import { leadMatches } from '../lib/format';
import { recentLeads } from '../lib/recent';
import { leadName } from '../lib/rules';
import { Icon } from './Icon';
import { useOpenLead } from '../features/lead/useOpenLead';
import { useActions } from '../app/actions';
import { NAV } from '../app/nav';
import { rankBy } from './palette';

export type PaletteAction = 'quick' | 'lead' | 'task' | 'book' | 'message' | 'announcement' | 'tour' | 'guide' | 'refresh';
type Cmd = { id: string; group: string; label: string; sub?: string; icon: string; run: () => void; keys?: string; lead?: Lead };

/** Ctrl/⌘+K: clients, pages and actions in one list. Enter opens; Shift+Enter on a client opens WhatsApp. */
export function CommandPalette({ boot, open, onOpenChange, onAction }: { boot: Bootstrap; open: boolean; onOpenChange: (o: boolean) => void; onAction: (a: PaletteAction) => void }) {
  const { t, lang, setLang } = useI18n();
  const { theme, setPref } = useTheme();
  const nav = useNavigate();
  const openLead = useOpenLead();
  const actions = useActions();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) { setQ(''); setSel(0); } }, [open]);

  const cmds = useMemo<Cmd[]>(() => {
    const A = t('أوامر', 'Actions');
    const acts: Cmd[] = [
      { id: 'a-start', group: A, label: t('ابدأ طابور المكالمات', 'Start the call queue'), icon: 'phone', keys: 'Space', run: () => nav('/?start=1') },
      { id: 'a-quick', group: A, label: t('إضافة سريعة لعميل', 'Quick-add a lead'), icon: 'plus', keys: 'N', run: () => onAction('quick') },
      { id: 'a-lead', group: A, label: t('عميل جديد بالتفاصيل', 'New lead with details'), icon: 'userplus', keys: '⇧N', run: () => onAction('lead') },
      { id: 'a-task', group: A, label: t('مهمة جديدة', 'New task'), icon: 'tasks', keys: 'T', run: () => onAction('task') },
      { id: 'a-book', group: A, label: t('احجز اجتماع', 'Book a meeting'), icon: 'calendar', keys: 'B', run: () => onAction('book') },
      { id: 'a-msg', group: A, label: boot.me.isAdmin ? t('رسالة جديدة', 'New message') : t('رسالة للإدارة', 'Message the admins'), icon: 'inbox', keys: 'M', run: () => onAction('message') },
      ...(boot.me.isAdmin ? [{ id: 'a-ann', group: A, label: t('إعلان جديد', 'New announcement'), icon: 'megaphone', run: () => onAction('announcement') }] : []),
      { id: 'a-guide', group: A, label: t('كيف يعمل؟', 'How it works'), icon: 'sparkle', keys: '?', run: () => onAction('guide') },
      { id: 'a-tour', group: A, label: t('جولة سريعة', 'Quick tour'), icon: 'next', run: () => onAction('tour') },
      { id: 'a-refresh', group: A, label: t('تحديث البيانات', 'Refresh data'), icon: 'refresh', run: () => onAction('refresh') },
      { id: 'a-theme', group: A, label: theme === 'dark' ? t('الوضع الفاتح', 'Light mode') : t('الوضع الليلي', 'Night mode'), icon: theme === 'dark' ? 'sun' : 'moon', run: () => setPref(theme === 'dark' ? 'light' : 'dark') },
      { id: 'a-lang', group: A, label: lang === 'ar' ? 'English' : 'العربية', icon: 'globe', run: () => setLang(lang === 'ar' ? 'en' : 'ar') }
    ];
    const pages: Cmd[] = NAV.map((n) => ({ id: 'p' + n.path, group: t('الصفحات', 'Pages'), label: t(n.label[0], n.label[1]), icon: n.icon, keys: n.key ? 'G ' + n.key : undefined, run: () => nav(n.path) }));
    return [...acts, ...pages];
  }, [boot.me.isAdmin, lang, nav, onAction, setLang, setPref, t, theme]);

  const results = useMemo(() => {
    const asCmd = (l: Lead, group: string): Cmd => ({ id: group[0] + l.id, group, label: leadName(l), sub: [l.name !== leadName(l) ? l.name : '', l.city, l.stage].filter(Boolean).join(' · '), icon: 'contacts', run: () => openLead(l.id), lead: l });
    if (!q.trim()) {
      const recents = recentLeads().map((id) => boot.leads.find((l) => l.id === id)).filter((l): l is Lead => !!l).map((l) => asCmd(l, t('آخر اللي فتحته', 'Recent')));
      return [...recents, ...cmds];
    }
    const leads = boot.leads.filter((l) => leadMatches(l, q)).slice(0, 8).map((l) => asCmd(l, t('العملاء', 'Clients')));
    const other = rankBy(cmds, q, (c) => [c.label, c.group]);
    return [...leads, ...other];
  }, [q, boot.leads, cmds, openLead, t]);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [sel]);
  const run = (c: Cmd | undefined, alt = false) => {
    if (!c) return;
    onOpenChange(false);
    setTimeout(() => (alt && c.lead ? actions.whatsapp(c.lead) : c.run()), 0);
  };

  let lastGroup = '';
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content className="cmdk" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">{t('بحث وأوامر', 'Search and commands')}</Dialog.Title>
          <div className="cmdk__bar"><Icon name="search" /><input className="cmdk__in" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('دوّر على عميل، صفحة، أو أمر…', 'Search clients, pages or actions…')}
            role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-label={t('بحث', 'Search')} aria-activedescendant={results[sel] ? 'cmd-' + results[sel].id : undefined}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((x) => Math.min(results.length - 1, x + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((x) => Math.max(0, x - 1)); }
              if (e.key === 'Enter') { e.preventDefault(); run(results[sel], e.shiftKey); }
            }} /><kbd>Esc</kbd></div>
          <div className="cmdk__list" id="cmdk-list" role="listbox" ref={listRef}>
            {results.length === 0 ? <div className="empty"><b>{t('مفيش نتايج', 'No results')}</b>{t('جرّب اسم تاني أو جزء من رقم الجوال.', 'Try another name or part of the phone number.')}</div> : results.map((c, i) => {
              const head = c.group !== lastGroup ? (lastGroup = c.group) : null;
              return (
                <div key={c.id}>
                  {head ? <div className="cmdk__grp">{head}</div> : null}
                  <div id={'cmd-' + c.id} className="cmdk__item" role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={(e) => run(c, e.shiftKey)}>
                    <Icon name={c.icon} /><span className="cmdk__lbl">{c.label}{c.sub ? <span className="faint"> · {c.sub}</span> : null}</span>
                    {c.lead && i === sel ? <small className="cmdk__alt"><kbd>⇧ Enter</kbd> {t('واتساب', 'WhatsApp')}</small> : c.keys ? <small><kbd>{c.keys}</kbd></small> : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="cmdk__foot" aria-hidden="true"><span><kbd>↑</kbd><kbd>↓</kbd> {t('تنقّل', 'move')}</span><span><kbd>Enter</kbd> {t('افتح', 'open')}</span><span><kbd>⇧ Enter</kbd> {t('واتساب للعميل', 'WhatsApp a client')}</span></div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
