import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/endpoints';
import { qk, refreshAfterWrite, upsertLead } from '../../api/queries';
import { useBoot } from '../../app/boot';
import { Modal, useToast } from '../../components/overlay';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n';
import { errorText } from '../../api/errors';
import { parseQuick } from '../../lib/format';
import { leadName } from '../../lib/rules';
import { useOpenLead } from '../lead/useOpenLead';

/** One line, one Enter: «معرض النور 0551234567» becomes a new lead owned by you. Opened by «+» or N anywhere. */
export function QuickAddModal({ onClose, onFull }: { onClose: () => void; onFull: () => void }) {
  const { t, lang } = useI18n();
  const boot = useBoot();
  const qc = useQueryClient();
  const toast = useToast();
  const openLead = useOpenLead();
  const [text, setText] = useState('');
  const [hot, setHot] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [dup, setDup] = useState<string>('');
  const p = parseQuick(text);

  async function submit() {
    if (busy) return;
    if (!p.name) { setErr(t('اكتب اسم العميل أو النشاط', 'Type the client or business name')); return; }
    setBusy(true); setErr(''); setDup('');
    try {
      const r = await api.saveLead({ business: p.name, phone: p.phone, owner: boot.me.name, type: 'محتمل', stage: 'جديد', source: 'تواصل مباشر (Outreach)', priority: hot ? 'عالية' : 'متوسطة' });
      if (!r.ok && r.error === 'duplicate') { setDup(r.id || ''); setBusy(false); return; }
      upsertLead(qc, r.lead);
      refreshAfterWrite(qc);
      qc.invalidateQueries({ queryKey: qk.boot });
      toast(t('اتضاف ', 'Added ') + leadName(r.lead));
      onClose();
    } catch (e) { setErr(errorText(e, lang)); setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} title={t('إضافة سريعة', 'Quick add')} onSubmit={submit}
      footer={<>
        <button className="btn btn--primary btn--plain" onClick={submit} disabled={busy}>{busy ? t('بنضيف…', 'Adding…') : t('ضيف', 'Add')}<kbd className="kbd-on">Enter</kbd></button>
        <button className="btn btn--ghost" onClick={onFull}>{t('الفورم الكامل', 'Full form')}</button>
      </>}>
      <label className="field">{t('الاسم والرقم في سطر واحد', 'Name and phone on one line')}
        <input className="input input--xl" value={text} onChange={(e) => { setText(e.target.value); setErr(''); setDup(''); }} placeholder={t('مثال: معرض النور 0551234567', 'e.g. Al Noor Showroom 0551234567')} autoFocus aria-describedby="qa-preview" />
      </label>
      <div id="qa-preview" className="qa-preview" aria-live="polite">
        <span><small>{t('الاسم', 'Name')}</small><b>{p.name || '—'}</b></span>
        <span><small>{t('الجوال', 'Phone')}</small><b className="num ltr">{p.phone || '—'}</b></span>
        <span><small>{t('المسؤول', 'Owner')}</small><b>{boot.me.name}</b></span>
      </div>
      <label className="check"><input type="checkbox" checked={hot} onChange={(e) => setHot(e.target.checked)} />{t('مهتم جدًا (أولوية عالية)', 'Very interested (high priority)')}</label>
      {err ? <p className="field__err" role="alert">{err}</p> : null}
      {dup ? (
        <div className="callout callout--warn" role="alert"><Icon name="alert" /><div className="grow"><b>{t('العميل ده متسجّل قبل كده', 'This client already exists')}</b></div>
          {boot.leads.some((l) => l.id === dup) ? <button className="btn btn--sm" onClick={() => { onClose(); openLead(dup); }}>{t('افتح الموجود', 'Open existing')}</button> : null}</div>
      ) : null}
    </Modal>
  );
}
