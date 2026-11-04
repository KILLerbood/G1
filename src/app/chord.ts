/** Shared keyboard state between the shell and pages (G then a number = go to page N). */
export const chord = { g: 0 };
export const chordActive = () => Date.now() - chord.g < 1200;

/** True when the keyboard is busy elsewhere: typing in a field, or any dialog is open. */
export function keyboardBusy(): { typing: boolean; dialog: boolean } {
  const el = document.activeElement as HTMLElement | null;
  const typing = !!el && (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable);
  return { typing, dialog: !!document.querySelector('[role="dialog"]') };
}
/** Digit pressed, whatever the keyboard layout (Arabic-Indic digits and the numpad too). */
export function digitOf(e: KeyboardEvent): string {
  const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
  if (m) return m[1];
  const i = '٠١٢٣٤٥٦٧٨٩'.indexOf(e.key);
  return i >= 0 ? String(i) : /^\d$/.test(e.key) ? e.key : '';
}
