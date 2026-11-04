import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/endpoints';
import { qk, refreshAfterWrite, upsertLead } from '../../api/queries';
import type { Lead } from '../../api/schemas';
import { useBoot } from '../../app/boot';
import { Modal, useToast } from '../../components/overlay';
import { Brand } from '../../components/Icon';
import { useI18n } from '../../i18n';
import { errorText } from '../../api/errors';
import { fillTemplate, leadName, missingVars, templatesFor } from '../../lib/rules';
import { WA_TEMPLATES, suggestTemplate, waLink, waPhone, type WaTemplate } from './whatsapp';

/**
 * WhatsApp with Arabic templates: pick a message, it is filled with the lead's data, edit it,
 * then «افتح واتساب» opens wa.me with the text and logs the message on the lead (api.logWhatsApp).
 */
export function WhatsAppModal({ lead, onClose, onSent }: { lead: Lead; onClose: () => void; onSent?: () => void }) {
  const { t, lang } = useI18n();
  const boot = useBoot();
  const qc = useQueryClient();
  const toast = useToast();
  const list = useMemo<WaTemplate[]>(() => [
    ...WA_TEMPLATES,
    ...templatesFor(boot.templates, 'واتساب').map((x) => ({ id: x.id, name: x.name, body: x.body, when: x.stage ? [x.stage] : [] }))
  ], [boot.templates]);
  const first = suggestTemplate(lead, list);
  const [tid, setTid] = useState(first.id);
  const [text, setText] = useState(() => fillTemplate(first.body, lead, boot));
  const [busy, setBusy] = useState(false);
  const phone = waPhone(lead.phone);
  const missing = missingVars(text);
  const pick = (x: WaTemplate) => { setTid(x.id); setText(fillTemplate(x.body, lead, boot)); };

  async function send() {
    if (busy || !text.trim()) return;
    // Open first (still inside the click, so pop-up blockers allow it), then log.
    window.open(waLink(lead.phone, text.trim()), '_blank', 'noopener');
    setBusy(true);
    try {
      const name = list.find((x) => x.id === tid)?.name || '';
      const r = await api.logWhatsApp({ leadId: lead.id, text: text.trim(), template: name });
      if (r.lead) upsertLead(qc, r.lead);
      refreshAfterWrite(qc, lead.id);
      qc.invalidateQueries({ queryKey: qk.boot });
      toast(t('اتسجّل الواتساب على ', 'WhatsApp logged on ') + leadName(lead));
      onSent?.();
      onClose();
    } catch (e) { toast(errorText(e, lang), { err: true }); setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} size="lg" title={t('واتساب لـ ', 'WhatsApp ') + leadName(lead)} onSubmit={send}
      footer={<>
        <button className="btn btn--wa" onClick={send} disabled={busy || !text.trim()}><Brand name="wa" size={20} />{t('افتح واتساب وسجّل', 'Open WhatsApp & log')}</button>
        <button className="btn btn--ghost" onClick={onClose}>{t('إلغاء', 'Cancel')}</button>
        <span className="grow" />
        <span className="faint num ltr" style={{ alignSelf: 'center', fontSize: 13 }}>{phone ? '+' + phone : t('مفيش رقم: هتختار الشات بنفسك', 'No phone: you’ll pick the chat')}</span>
      </>}>
      <div className="wa">
        <div className="wa__list" role="listbox" aria-label={t('القوالب', 'Templates')}>
          {list.map((x) => (
            <button key={x.id} type="button" role="option" aria-selected={x.id === tid} className="wa__tpl" onClick={() => pick(x)}>
              <b>{x.name}</b>{x.when.includes(lead.stage) ? <small className="tag tag--acc">{t('مناسب للمرحلة', 'Fits the stage')}</small> : null}
            </button>
          ))}
        </div>
        <div className="wa__edit">
          <label className="field">{t('الرسالة', 'Message')}
            <textarea className="textarea wa__text" value={text} onChange={(e) => setText(e.target.value)} rows={8} dir="auto" />
          </label>
          {missing.length ? <p className="hint hint--warn">{t('فيه متغيرات ناقصة: ', 'Missing values: ')}{missing.join(' ')}</p> : <p className="hint">{t('النص اتملى ببيانات العميل. عدّل براحتك قبل ما تبعت.', 'Filled with the client’s data. Edit freely before sending.')}</p>}
        </div>
      </div>
    </Modal>
  );
}
