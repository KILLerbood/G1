import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { useI18n } from '../../i18n';
import { Icon } from '../../components/Icon';
import { config } from '../../config';
import { store } from '../../lib/storage';
import { FLOW, SHORTCUTS, TOUR, placeCard, type Rect } from './steps';

export const tourKey = (email: string) => 'g1-toured:' + email.toLowerCase();
export const tourSeen = (email: string) => store.get(tourKey(email)) === '1';
export const markTourSeen = (email: string) => store.set(tourKey(email), '1');

/** The small «كيف يعمل؟» button in the bottom corner + the panel it opens. */
export function GuideButton({ open, onOpenChange, onTour, sheetUrl }: { open: boolean; onOpenChange: (o: boolean) => void; onTour: () => void; sheetUrl?: string }) {
  const { t } = useI18n();
  return (
    <>
      <button className="g-help" onClick={() => onOpenChange(true)} aria-haspopup="dialog" data-tour-skip>
        <span className="g-help__q" aria-hidden="true">؟</span>{t('كيف يعمل؟', 'How it works')}
      </button>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="scrim" />
          <Dialog.Content className="guide" aria-describedby="guide-lede">
            <div className="guide__head">
              <span className="f-kicker"><span className="f-kicker__no">{t('الدليل', 'Guide')}</span></span>
              <Dialog.Close className="ibtn ibtn--sm" aria-label={t('إغلاق', 'Close')}><Icon name="close" /></Dialog.Close>
            </div>
            <Dialog.Title className="guide__title display">{t('كيف يعمل؟', 'How it works')}</Dialog.Title>
            <p id="guide-lede" className="guide__lede">{t('النظام ده معمول عشان تعمل حاجة واحدة كل مرة: تكلّم العميل الصح في الوقت الصح. ده كل اللي محتاج تعرفه.', 'This system is built so you do one thing at a time: talk to the right client at the right moment. Here is all you need to know.')}</p>

            <h3 className="guide__h"><span className="num">01</span>{t('رحلة العميل', 'The client journey')}</h3>
            <ol className="flow">
              {FLOW.map((f, i) => (
                <li key={f.id}><span className="flow__n num">{i + 1}</span><b>{t(f.title[0], f.title[1])}</b><span>{t(f.body[0], f.body[1])}</span></li>
              ))}
            </ol>

            <h3 className="guide__h"><span className="num">02</span>{t('البيانات بتتحفظ فين؟', 'Where does the data live?')}</h3>
            <div className="guide__data">
              <p>{t('كل حاجة متسجلة في Google Sheet واحد (تبويب لكل نوع: العملاء، التواصل، المهام، الاجتماعات، الفواتير…). Google Apps Script هو اللي بيقرا ويكتب فيه، وبيبعت الإيميلات والتنبيهات.', 'Everything lives in one Google Sheet (a tab per kind: clients, contacts, tasks, meetings, billing…). Google Apps Script reads and writes it, and sends the emails and alerts.')}</p>
              {config.mock
                ? <p className="callout callout--warn" style={{ margin: 0 }}><Icon name="sparkle" />{t('إنت دلوقتي في وضع التجربة: البيانات وهمية ومتخزنة في المتصفح بس، ومفيش حاجة بتروح للشيت.', 'You are in demo mode: the data is sample data kept in this browser only; nothing goes to the sheet.')}</p>
                : sheetUrl ? <a className="btn btn--sm" href={sheetUrl} target="_blank" rel="noopener noreferrer"><Icon name="template" />{t('افتح الشيت', 'Open the sheet')}</a> : null}
              <p className="faint" style={{ margin: 0, fontSize: 13 }}>{t('تقدّم يومك (طابور المكالمات) محفوظ على الجهاز ده، والمكالمات نفسها بتتسجل في الشيت كتواصل ومهام.', 'Your day progress (the call queue) is kept on this device; the calls themselves are logged to the sheet as contacts and tasks.')}</p>
            </div>

            <h3 className="guide__h"><span className="num">03</span>{t('أهم ٥ اختصارات', 'Top 5 shortcuts')}</h3>
            <dl className="guide__keys">
              {SHORTCUTS.map(([keys, label]) => <div key={label[1]}><dt>{keys.map((k) => <kbd key={k}>{k}</kbd>)}</dt><dd>{t(label[0], label[1])}</dd></div>)}
            </dl>

            <h3 className="guide__h"><span className="num">04</span>{t('جولة سريعة', 'Quick tour')}</h3>
            <p className="faint" style={{ marginTop: 0 }}>{t(TOUR.length + ' خطوات على الشاشة نفسها، أقل من دقيقة.', TOUR.length + ' steps on the real screen, under a minute.')}</p>
            <button className="btn btn--accent" onClick={() => { onOpenChange(false); setTimeout(onTour, 120); }}><Icon name="next" className="flip" />{t('ابدأ الجولة', 'Start the tour')}</button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

/** A step tour that spotlights the real element of each step (data-tour="…") and explains it. */
export function StepTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, dir } = useI18n();
  const nav = useNavigate();
  const loc = useLocation();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const step = TOUR[i];
  useEffect(() => { if (open) setI(0); }, [open]);
  useEffect(() => { if (open && step.path && loc.pathname !== step.path) nav(step.path); }, [open, step, loc.pathname, nav]);

  const measure = useCallback(() => {
    if (!open) return;
    const el = [...document.querySelectorAll<HTMLElement>('[data-tour="' + step.target + '"]')].find((x) => x.getBoundingClientRect().width > 0);
    const r = el?.getBoundingClientRect();
    const box = r ? { top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 } : null;
    setRect(box);
    const c = cardRef.current?.getBoundingClientRect();
    const p = placeCard(box ? { ...box, height: Math.min(box.height, window.innerHeight * 0.6) } : null, { width: c?.width || 360, height: c?.height || 220 }, { width: window.innerWidth, height: window.innerHeight });
    setPos({ top: p.top, left: p.left });
  }, [open, step]);
  useLayoutEffect(() => {
    if (!open) return;
    const el = [...document.querySelectorAll<HTMLElement>('[data-tour="' + step.target + '"]')].find((x) => x.getBoundingClientRect().width > 0);
    el?.scrollIntoView({ block: 'nearest' });
    measure();
    const id = window.setTimeout(measure, 250);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { window.clearTimeout(id); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [open, step, measure, loc.pathname]);
  useEffect(() => { if (open) cardRef.current?.focus(); }, [open, i]);

  if (!open) return null;
  const last = i === TOUR.length - 1;
  return (
    <div className="tourx" role="dialog" aria-modal="true" aria-labelledby="tourx-t" aria-describedby="tourx-b"
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        const fwd = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight', back = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
        if (e.key === fwd) { e.preventDefault(); if (last) onClose(); else setI(i + 1); }
        if (e.key === back && i > 0) { e.preventDefault(); setI(i - 1); }
      }}>
      <div className="tourx__veil" onClick={onClose} />
      {rect ? <div className="tourx__spot" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} aria-hidden="true" /> : null}
      <div ref={cardRef} className="tourx__card" tabIndex={-1} style={{ top: pos.top, left: pos.left }}>
        <div className="tourx__meta"><span className="num">{String(i + 1).padStart(2, '0')} / {String(TOUR.length).padStart(2, '0')}</span><span className="tourx__bar"><i style={{ width: ((i + 1) / TOUR.length) * 100 + '%' }} /></span></div>
        <h2 id="tourx-t" className="display">{t(step.title[0], step.title[1])}</h2>
        <p id="tourx-b">{t(step.body[0], step.body[1])}</p>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn--accent btn--sm" onClick={() => (last ? onClose() : setI(i + 1))}>{last ? t('تمام، يلا', 'Done') : t('التالي', 'Next')}</button>
          {i > 0 ? <button className="btn btn--ghost btn--sm" onClick={() => setI(i - 1)}>{t('السابق', 'Back')}</button> : null}
          <span className="grow" />
          {!last ? <button className="link-btn" onClick={onClose}>{t('تخطّي', 'Skip')}</button> : null}
        </div>
      </div>
    </div>
  );
}
