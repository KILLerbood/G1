import { lazy, Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { useBootstrap, usePulse } from '../api/queries';
import { BootCtx } from './boot';
import { ActionsProvider, useActions } from './actions';
import { useI18n } from '../i18n';
import { useTheme } from './theme';
import { useAuth } from '../auth/AuthProvider';
import { Icon } from '../components/Icon';
import { Avatar, Skel } from '../components/ui';
import { NotificationsBell } from '../components/NotificationsPanel';
import { CommandPalette, type PaletteAction } from '../components/CommandPalette';
import { AnnouncementBanner, UrgentModal } from '../components/Announcements';
import { errorText } from '../api/errors';
import { LostReasonProvider } from '../features/lead/mutations';
import { GuideButton, StepTour, markTourSeen, tourSeen } from '../features/guide/Guide';
import { isLate } from '../lib/rules';
import { useOnline } from '../lib/hooks';
import type { Bootstrap } from '../api/schemas';
import { api } from '../api/endpoints';
import { refreshDevice } from '../lib/push';
import { NAV, isActive, navByKey } from './nav';
import { chord, digitOf, keyboardBusy } from './chord';

const LeadDrawer = lazy(() => import('../features/lead/LeadView').then((m) => ({ default: m.LeadDrawer })));

/** The G1 mark: a vermilion block with the M, set like a newspaper nameplate. */
export function Mark({ size = 30 }: { size?: number }) {
  return <span className="g-mark" style={{ width: size, height: size, fontSize: size * 0.56 }} aria-hidden="true">M</span>;
}
export function Nameplate() {
  return <span className="g-nameplate" dir="ltr"><Mark /><span className="g-nameplate__txt"><b>Magmafy</b><small>Focus CRM</small></span></span>;
}

export function Shell() {
  const { t, lang } = useI18n();
  const boot = useBootstrap();
  if (boot.isLoading || (!boot.data && !boot.isError)) return <BootSkeleton />;
  if (!boot.data) {
    return (
      <div className="g-auth g-auth--single">
        <div className="g-auth__form">
          <Nameplate />
          <h1 className="display" style={{ fontSize: 40, margin: '24px 0 8px' }}>{t('الـ CRM مافتحش', 'The CRM didn’t load')}</h1>
          <p className="muted">{errorText(boot.error, lang)}</p>
          <button className="btn btn--primary btn--plain" onClick={() => boot.refetch()}>{t('حمّل تاني', 'Reload')}</button>
        </div>
      </div>
    );
  }
  return (
    <BootCtx.Provider value={boot.data}>
      <LostReasonProvider reasons={boot.data.lists['سبب الخسارة'] || []}>
        <ActionsProvider>
          <ShellFrame boot={boot.data} refreshing={boot.isFetching} onRefresh={() => boot.refetch()} />
        </ActionsProvider>
      </LostReasonProvider>
    </BootCtx.Provider>
  );
}

function ShellFrame({ boot, refreshing, onRefresh }: { boot: Bootstrap; refreshing: boolean; onRefresh: () => void }) {
  const { t, lang, setLang } = useI18n();
  const { theme, pref, setPref } = useTheme();
  const { signOut, authed } = useAuth();
  const actions = useActions();
  const nav = useNavigate();
  const loc = useLocation();
  const [params, setParams] = useSearchParams();
  const pulse = usePulse(authed);
  const online = useOnline();
  const [update, setUpdate] = useState(false);
  const pushKey = boot.settings.pushKey;
  useEffect(() => { if (pushKey) void refreshDevice(api, pushKey); }, [pushKey]);
  useEffect(() => { const on = () => setUpdate(true); window.addEventListener('mg-update', on); return () => window.removeEventListener('mg-update', on); }, []);
  const [cmdk, setCmdk] = useState(false);
  const [tour, setTour] = useState(false);
  const [guide, setGuide] = useState(false);
  const me = boot.me;
  const lateTasks = boot.tasks.filter((x) => isLate(x) && (x.owner === me.name || me.isAdmin)).length;
  const unreadMsgs = pulse.data?.unread.messages ?? boot.inbox?.unread ?? 0;
  const unreadAnns = pulse.data?.unread.announcements ?? boot.announcements.filter((a) => !a.seenAt).length;
  const unreadNotifs = pulse.data?.unread.notifications ?? 0;
  const counts: Record<string, number> = { '/tasks': lateTasks, '/inbox': unreadMsgs, '/announcements': unreadAnns };
  const leadId = params.get('lead');
  const current = NAV.find((n) => isActive(n.path, loc.pathname));

  // First run: the step tour, once per person per device, when nothing else is open.
  const myEmail = me.email;
  useEffect(() => {
    if (tourSeen(myEmail)) return;
    let tries = 0;
    const id = window.setInterval(() => {
      tries++;
      if (!document.querySelector('[role="dialog"]')) { window.clearInterval(id); setTour(true); }
      else if (tries > 20) window.clearInterval(id);
    }, 1500);
    return () => window.clearInterval(id);
  }, [myEmail]);
  const closeTour = () => { markTourSeen(myEmail); setTour(false); };
  useEffect(() => { window.scrollTo({ top: 0 }); }, [loc.pathname]);
  useEffect(() => { document.title = (current ? t(current.label[0], current.label[1]) + ' · ' : '') + 'Magmafy Focus'; }, [current, t]);

  // Keyboard: Ctrl/⌘+K and «/» search · N quick add (Shift+N full form) · T task · B booking · M message · ? guide · G+1…9 pages.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdk(true); return; }
      const { typing, dialog } = keyboardBusy();
      if (typing || dialog || e.ctrlKey || e.metaKey || e.altKey) return;
      if (Date.now() - chord.g < 1200) {
        const d = digitOf(e);
        const n = d ? navByKey(d) : undefined;
        chord.g = 0;
        if (n) { e.preventDefault(); e.stopPropagation(); nav(n.path); return; }
      }
      if (e.code === 'KeyG') { chord.g = Date.now(); return; }
      if (e.key === '/') { e.preventDefault(); setCmdk(true); }
      else if (e.code === 'KeyN') { e.preventDefault(); if (e.shiftKey) actions.newLead(); else actions.quickAdd(); }
      else if (e.code === 'KeyT') { e.preventDefault(); actions.newTask(); }
      else if (e.code === 'KeyB') { e.preventDefault(); actions.book(); }
      else if (e.code === 'KeyM') { e.preventDefault(); actions.newThread(); }
      else if (e.key === '?' || e.key === '؟') { e.preventDefault(); setGuide(true); }
    };
    // Capture phase, so a G+number chord wins over page shortcuts that also use digits.
    window.addEventListener('keydown', on, true);
    return () => window.removeEventListener('keydown', on, true);
  }, [actions, nav]);

  const onAction = (a: PaletteAction) => {
    if (a === 'quick') actions.quickAdd();
    else if (a === 'lead') actions.newLead();
    else if (a === 'task') actions.newTask();
    else if (a === 'book') actions.book();
    else if (a === 'message') actions.newThread();
    else if (a === 'announcement') actions.editAnnouncement();
    else if (a === 'tour') setTour(true);
    else if (a === 'guide') setGuide(true);
    else onRefresh();
  };

  const AddMenu = ({ mobile }: { mobile?: boolean }) => (
    <Menu.Root>
      <Menu.Trigger asChild>
        {mobile
          ? <button className="g-dock__add" aria-label={t('إضافة', 'Add')} data-tour="add"><Icon name="plus" size={26} /></button>
          : <button className="g-add" data-tour="add" aria-label={t('إضافة (N)', 'Add (N)')}><Icon name="plus" /><span>{t('إضافة', 'Add')}</span></button>}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className="menu" side={mobile ? 'top' : 'bottom'} align={mobile ? 'center' : 'end'} sideOffset={10}>
          <Menu.Item className="menu__item" onSelect={actions.quickAdd}><Icon name="bolt" />{t('عميل سريع (سطر واحد)', 'Quick lead (one line)')}<kbd className="menu__kbd">N</kbd></Menu.Item>
          <Menu.Item className="menu__item" onSelect={actions.newLead}><Icon name="userplus" />{t('عميل بالتفاصيل', 'Lead with details')}<kbd className="menu__kbd">⇧N</kbd></Menu.Item>
          <Menu.Item className="menu__item" onSelect={() => actions.newTask()}><Icon name="tasks" />{t('مهمة', 'Task')}<kbd className="menu__kbd">T</kbd></Menu.Item>
          <Menu.Item className="menu__item" onSelect={() => actions.book()}><Icon name="calendar" />{t('اجتماع', 'Meeting')}<kbd className="menu__kbd">B</kbd></Menu.Item>
          <Menu.Item className="menu__item" onSelect={actions.newThread}><Icon name="inbox" />{t('رسالة للفريق', 'Team message')}<kbd className="menu__kbd">M</kbd></Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );

  return (
    <>
      <a className="skip" href="#main">{t('تخطّى للمحتوى', 'Skip to content')}</a>
      <div className="g-shell">
        <div className="g-brand"><NavLink to="/" aria-label="Magmafy Focus"><Nameplate /></NavLink></div>
        <header className="g-top">
          <NavLink to="/" className="g-top__mark show-sm" aria-label="Magmafy Focus"><Mark size={30} /></NavLink>
          <div className="g-top__where hide-sm"><span className="num">{current?.key ? String(current.key).padStart(2, '0') : '—'}</span>{current ? t(current.label[0], current.label[1]) : ''}</div>
          <button className="g-search" onClick={() => setCmdk(true)} data-tour="search" aria-label={t('بحث وأوامر (Ctrl+K)', 'Search and commands (Ctrl+K)')}>
            <Icon name="search" /><span className="hide-sm">{t('دوّر على عميل، صفحة، أو أمر…', 'Search clients, pages, actions…')}</span><kbd className="hide-sm">Ctrl K</kbd>
          </button>
          <span className="grow show-sm" />
          <span className="hide-sm"><AddMenu /></span>
          <NotificationsBell unread={unreadNotifs} />
          <Menu.Root>
            <Menu.Trigger asChild>
              <button className="g-me" aria-label={t('قايمة الحساب', 'Account menu')}><Avatar name={me.name} size="sm" /><span className="hide-sm">{me.name.split(/\s+/)[0]}</span></button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content className="menu" align="end" sideOffset={8}>
                <div className="menu__me"><Avatar name={me.name} size="sm" /><div style={{ minWidth: 0 }}><b>{me.name}</b><small className="faint ltr">{me.email}</small></div></div>
                <Menu.Separator className="menu__sep" />
                <Menu.Item className="menu__item" onSelect={() => nav('/profile')}><Icon name="user" />{t('حسابي', 'Profile')}</Menu.Item>
                <Menu.Item className="menu__item" onSelect={() => nav('/settings')}><Icon name="settings" />{t('الإعدادات', 'Settings')}</Menu.Item>
                <Menu.Item className="menu__item" onSelect={() => setGuide(true)}><Icon name="sparkle" />{t('كيف يعمل؟', 'How it works')}<kbd className="menu__kbd">?</kbd></Menu.Item>
                <Menu.Item className="menu__item" onSelect={onRefresh}><Icon name="refresh" />{refreshing ? t('بيتحدّث…', 'Refreshing…') : t('تحديث البيانات', 'Refresh data')}</Menu.Item>
                <Menu.Separator className="menu__sep" />
                <div className="menu__label">{t('المظهر', 'Appearance')}</div>
                {([['light', 'sun', t('ورق (فاتح)', 'Paper (light)')], ['dark', 'moon', t('ليلي', 'Night')], ['auto', 'monitor', t('حسب الجهاز', 'System')]] as const).map(([k, ic, l]) => (
                  <Menu.Item key={k} className="menu__item" onSelect={() => setPref(k)}><Icon name={ic} />{l}{pref === k ? <Icon name="check" className="menu__check" /> : null}</Menu.Item>
                ))}
                <Menu.Item className="menu__item" onSelect={() => setLang(lang === 'ar' ? 'en' : 'ar')}><Icon name="globe" />{lang === 'ar' ? 'English' : 'العربية'}</Menu.Item>
                {boot.settings.sheetUrl ? <Menu.Item className="menu__item" onSelect={() => window.open(boot.settings.sheetUrl, '_blank', 'noopener')}><Icon name="template" />{t('افتح الشيت', 'Open the sheet')}</Menu.Item> : null}
                <Menu.Separator className="menu__sep" />
                <Menu.Item className="menu__item" onSelect={() => signOut()}><Icon name="logout" />{t('خروج', 'Sign out')}</Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </header>

        <nav className="g-rail" aria-label={t('القائمة الرئيسية', 'Main menu')} data-tour="nav">
          {(['work', 'team', 'more'] as const).map((g) => (
            <div className="g-rail__grp" key={g}>
              <div className="g-rail__h">{g === 'work' ? t('الشغل', 'Work') : g === 'team' ? t('الفريق', 'Team') : t('المزيد', 'More')}</div>
              {NAV.filter((n) => n.group === g).map((n) => {
                const c = counts[n.path] || 0;
                const on = isActive(n.path, loc.pathname);
                return (
                  <NavLink key={n.path} to={n.path} end className={'g-link' + (g === 'more' ? ' g-link--sm' : '')} aria-current={on ? 'page' : undefined} aria-label={t(n.label[0], n.label[1]) + (c ? ' (' + c + ')' : '')}>
                    {g !== 'more' ? <span className="g-link__n num">{String(n.key).padStart(2, '0')}</span> : <Icon name={n.icon} className="g-link__ic" />}
                    <span className="g-link__l">{t(n.label[0], n.label[1])}</span>
                    {c ? <span className={'g-link__c num' + (n.path === '/tasks' ? ' is-bad' : '')}>{c > 99 ? '99+' : c}</span> : null}
                  </NavLink>
                );
              })}
            </div>
          ))}
          <div className="g-rail__foot">
            <button className="link-btn" onClick={() => setPref(theme === 'dark' ? 'light' : 'dark')}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />{theme === 'dark' ? t('ورق', 'Paper') : t('ليلي', 'Night')}</button>
            <button className="link-btn" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}><Icon name="globe" size={15} />{lang === 'ar' ? 'EN' : 'ع'}</button>
          </div>
        </nav>

        <div className="g-banner">
          {!online ? <div className="banner banner--عاجل" role="alert"><span className="pulse-dot" />{t('مفيش نت دلوقتي. البيانات اللي قدامك للقراية بس لحد ما النت يرجع.', 'You’re offline. What you see is read-only until you’re back online.')}</div> : null}
          {update ? (
            <div className="banner" role="status"><Icon name="sparkle" size={16} /><span className="grow">{t('فيه نسخة جديدة من الموقع.', 'A new version is available.')}</span>
              <button className="btn btn--sm btn--primary btn--plain" onClick={() => { navigator.serviceWorker?.getRegistration().then((r) => (r?.waiting ? r.waiting.postMessage('skip') : location.reload())); }}>{t('حدّث', 'Update')}</button></div>
          ) : null}
          <AnnouncementBanner boot={boot} />
        </div>

        <main className="g-main" id="main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <nav className="g-dock" aria-label={t('التنقل', 'Navigation')} data-tour="nav">
        {([['/', 'bolt', t('يومي', 'Focus')], ['/contacts', 'contacts', t('العملاء', 'Clients')]] as const).map(([p, ic, l]) => (
          <NavLink key={p} to={p} end={p === '/'} className="g-dock__it" aria-current={isActive(p, loc.pathname) ? 'page' : undefined}><Icon name={ic} /><span>{l}</span></NavLink>
        ))}
        <AddMenu mobile />
        {([['/tasks', 'tasks', t('المهام', 'Tasks')], ['/more', 'more', t('المزيد', 'More')]] as const).map(([p, ic, l]) => (
          <NavLink key={p} to={p} className="g-dock__it" aria-current={isActive(p, loc.pathname) ? 'page' : undefined}>
            <span className="g-dock__ic"><Icon name={ic} />{p === '/tasks' && lateTasks ? <span className="g-dot" aria-hidden="true" /> : null}{p === '/more' && unreadMsgs ? <span className="g-dot" aria-hidden="true" /> : null}</span><span>{l}</span>
          </NavLink>
        ))}
      </nav>

      <GuideButton open={guide} onOpenChange={setGuide} onTour={() => setTour(true)} sheetUrl={boot.settings.sheetUrl} />
      <Suspense fallback={null}>{leadId ? <LeadDrawer id={leadId} onClose={() => setParams((p) => { const n = new URLSearchParams(p); n.delete('lead'); n.delete('ltab'); return n; })} /> : null}</Suspense>
      <CommandPalette boot={boot} open={cmdk} onOpenChange={setCmdk} onAction={onAction} />
      <StepTour open={tour} onClose={closeTour} />
      <UrgentModal pulse={pulse.data} boot={boot} />
    </>
  );
}

function BootSkeleton() {
  return (
    <div className="g-shell" aria-busy="true">
      <div className="g-brand"><Nameplate /></div>
      <header className="g-top"><Skel h={36} w="40%" r={4} /></header>
      <nav className="g-rail">{[0, 1, 2, 3, 4, 5, 6].map((i) => <Skel key={i} h={20} w="70%" r={3} />)}</nav>
      <main className="g-main">
        <div className="stack" style={{ gap: 22 }}>
          <Skel h={16} w="30%" r={3} />
          <Skel h={84} w="70%" r={4} />
          <Skel h={10} w="100%" r={2} />
          <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)' }}><Skel h={360} r={6} /><Skel h={360} r={6} /></div>
        </div>
      </main>
    </div>
  );
}
