import type { Lead } from '../../api/schemas';
import { digits, latinDigits } from '../../lib/format';

/**
 * Phone → the international digits wa.me wants (no +, no leading zeros).
 * Saudi mobiles typed locally (05XXXXXXXX / 5XXXXXXXX) get 966; Egyptian ones (01XXXXXXXXX) get 20;
 * 00-prefixed numbers lose the 00. Anything shorter than 8 digits is not a phone: ''.
 */
export function waPhone(raw: string): string {
  let d = digits(latinDigits(String(raw || '')));
  if (d.startsWith('00')) d = d.slice(2);
  if (/^05\d{8}$/.test(d)) d = '966' + d.slice(1);
  else if (/^5\d{8}$/.test(d)) d = '966' + d;
  else if (/^01[0125]\d{8}$/.test(d)) d = '20' + d.slice(1);
  else if (/^0\d{8,}$/.test(d)) d = d.slice(1);
  return d.length >= 8 ? d : '';
}

/** https://wa.me/<phone>?text=<message>. Without a phone, wa.me lets the person pick the chat. */
export function waLink(phone: string, text: string): string {
  const p = waPhone(phone);
  return 'https://wa.me/' + p + (text ? '?text=' + encodeURIComponent(text) : '');
}

/** G1's built-in WhatsApp messages (friendly Gulf/Egyptian-neutral Arabic). Variables use the CRM's {{…}} names. */
export type WaTemplate = { id: string; name: string; body: string; when: string[] };
export const WA_TEMPLATES: WaTemplate[] = [
  { id: 'g1-hello', name: 'أول تواصل', when: ['جديد'], body: 'أهلًا {{الاسم}} 👋\nمعاك {{المرسل}} من Magmafy. وصلنا اهتمامك بخصوص {{النشاط}}، تحب نحدد مكالمة قصيرة 10 دقايق نفهم فيها اللي محتاجه؟' },
  { id: 'g1-missed', name: 'بعد مكالمة مردّش فيها', when: ['جديد', 'تم التواصل'], body: 'أهلًا {{الاسم}}، حاولت أكلمك من شوية ومعرفتش أوصلك 🙏\nإيه أنسب وقت أتصل بيك فيه النهارده أو بكرة؟' },
  { id: 'g1-confirm', name: 'تأكيد الاجتماع', when: ['اجتماع محجوز'], body: 'أهلًا {{الاسم}}، بأكد معاك ميعادنا {{الموعد}}.\nرابط الاجتماع: {{رابط_الاجتماع}}\nمستنيينك 🌟' },
  { id: 'g1-quote', name: 'متابعة عرض السعر', when: ['عرض مرسل', 'تفاوض'], body: 'أهلًا {{الاسم}}، حبيت أطمن إن عرض {{النشاط}} وصلك وواضح.\nلو في أي نقطة محتاجة توضيح أو تعديل قولّي ونظبطها سوا.' },
  { id: 'g1-renew', name: 'تجديد الاشتراك', when: ['عميل نشط'], body: 'أهلًا {{الاسم}}، اشتراك {{النشاط}} معانا قرّب يتجدد.\nحابب نراجع النتايج سوا ونخطط للشهر الجاي؟' },
  { id: 'g1-thanks', name: 'شكر بعد الاتفاق', when: ['عميل نشط'], body: 'أهلًا {{الاسم}}، شكرًا على ثقتك في Magmafy 🙌\nأنا {{المرسل}} ومعاك خطوة بخطوة. أول حاجة هنبعتلك قايمة باللي محتاجينه للبداية.' },
  { id: 'g1-revive', name: 'إعادة تنشيط', when: ['متوقف', 'خسرناه'], body: 'أهلًا {{الاسم}}، من زمان ما اتكلمناش 😊\nعندنا أفكار جديدة ممكن تفرق مع {{النشاط}} في {{المدينة}}. تحب أبعتلك ملخص سريع؟' }
];

/** The best template for a lead right now: one meant for its stage, else the first one. */
export function suggestTemplate(lead: Pick<Lead, 'stage'>, list: WaTemplate[] = WA_TEMPLATES): WaTemplate {
  return list.find((t) => t.when.includes(lead.stage)) || list[0];
}
