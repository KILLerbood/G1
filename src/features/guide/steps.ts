/* The «كيف يعمل؟» guide: content + the pure geometry of the step tour. */

export type TourStep = { target: string; title: [string, string]; body: [string, string]; path?: string };

/** The step tour walks the real screen: each step points at an element marked data-tour="…". */
export const TOUR: TourStep[] = [
  { target: 'nav', path: '/', title: ['الفهرس', 'The index'], body: ['كل صفحات النظام هنا بالترتيب: يومك، العملاء، المسار، المهام… الرقم جنب كل صفحة هو اختصارها مع G.', 'Every page, in order: your day, clients, pipeline, tasks… The number next to each page is its G-shortcut.'] },
  { target: 'progress', path: '/', title: ['تقدّم يومك', 'Your day’s progress'], body: ['الشريط ده بيتملى مع كل مكالمة بتسجّل نتيجتها. هدفك توصله للآخر.', 'This bar fills with every call you log. The goal is to reach the end.'] },
  { target: 'queue', path: '/', title: ['طابور المكالمات', 'The call queue'], body: ['اضغط Space يفتح أول عميل. سجّل النتيجة بزرار واحد (1 رد، 2 مردّش، 3 اجتماع، 4 كسبناه، 5 خسرناه)، اختار ميعاد المتابعة، وEnter ينقلك للي بعده.', 'Press Space to open the first lead. Log the outcome with one key (1–5), pick the follow-up date, and Enter moves to the next one.'] },
  { target: 'actions', path: '/', title: ['أهم الخطوات الجاية', 'Next best actions'], body: ['النظام بيدوّر لك على اللي ممكن يفوتك: متابعات متأخرة، عملاء مهتمين محدش كلمهم، اجتماعات من غير نتيجة، عروض مستنية رد، وتجديدات قربت.', 'The system finds what could slip: overdue follow-ups, hot leads with no contact, meetings without outcome, quotes awaiting reply and renewals.'] },
  { target: 'add', title: ['إضافة سريعة', 'Quick add'], body: ['زرار + أو حرف N في أي صفحة: اكتب الاسم والرقم في سطر واحد وEnter.', 'The + button or N on any page: type a name and a phone on one line and press Enter.'] },
  { target: 'search', title: ['دوّر على أي حاجة', 'Find anything'], body: ['Ctrl+K يفتح البحث: عملاء، صفحات، وأوامر. Shift+Enter على عميل يفتح واتساب على طول.', 'Ctrl+K opens search: clients, pages and commands. Shift+Enter on a client opens WhatsApp right away.'] }
];

export type Rect = { top: number; left: number; width: number; height: number };
export type Placement = { top: number; left: number; side: 'below' | 'above' | 'center' };

/**
 * Where to put the tour card next to a highlighted element: below it if there is room, else above,
 * else centred on screen. Always kept inside the viewport with a 12px margin.
 */
export function placeCard(target: Rect | null, card: { width: number; height: number }, vp: { width: number; height: number }, gap = 14): Placement {
  const m = 12;
  const clampX = (x: number) => Math.max(m, Math.min(vp.width - card.width - m, x));
  if (!target || target.width === 0) return { top: Math.max(m, (vp.height - card.height) / 2), left: clampX((vp.width - card.width) / 2), side: 'center' };
  const left = clampX(target.left + target.width / 2 - card.width / 2);
  const below = target.top + target.height + gap;
  if (below + card.height <= vp.height - m) return { top: below, left, side: 'below' };
  const above = target.top - gap - card.height;
  if (above >= m) return { top: above, left, side: 'above' };
  return { top: Math.max(m, (vp.height - card.height) / 2), left: clampX((vp.width - card.width) / 2), side: 'center' };
}

/** The flow the guide explains, in order. */
export const FLOW: { id: string; title: [string, string]; body: [string, string] }[] = [
  { id: 'lead', title: ['عميل محتمل', 'Lead'], body: ['بيدخل من حجز على الموقع، فحص الجاهزية، أو بتضيفه إنت بزرار +.', 'Comes in from a website booking, the readiness check, or you add it with +.'] },
  { id: 'follow', title: ['متابعة', 'Follow-up'], body: ['كل مكالمة أو واتساب بتتسجل، وكل متابعة ليها ميعاد بيظهر في طابور يومك.', 'Every call or WhatsApp is logged, and every follow-up has a date that lands in your daily queue.'] },
  { id: 'deal', title: ['صفقة', 'Deal'], body: ['اجتماع، عرض سعر، تفاوض: العميل بيتحرك في المسار مرحلة مرحلة.', 'Meeting, quote, negotiation: the lead moves along the pipeline stage by stage.'] },
  { id: 'client', title: ['عميل', 'Client'], body: ['لما يوافق بيبقى «عميل نشط» بقيمة شهرية وميعاد تجديد.', 'Once they agree they become an «active client» with a monthly value and a renewal date.'] },
  { id: 'billing', title: ['فواتير', 'Billing'], body: ['عرض السعر بيتحول لفواتير ومدفوعات من تبويب «الفواتير» في ملف العميل.', 'The quote turns into invoices and payments from the «Billing» tab on the client.'] }
];

export const SHORTCUTS: [string[], [string, string]][] = [
  [['Ctrl', 'K'], ['بحث وأوامر', 'Search & commands']],
  [['N'], ['إضافة سريعة لعميل', 'Quick-add a lead']],
  [['Space'], ['افتح العميل الجاي في الطابور', 'Open the next lead in the queue']],
  [['1', '…', '5'], ['سجّل نتيجة المكالمة', 'Log the call outcome']],
  [['W'], ['واتساب للعميل المفتوح', 'WhatsApp the open lead']]
];
