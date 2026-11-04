import { describe, expect, it } from 'vitest';
import { waPhone, waLink, suggestTemplate, WA_TEMPLATES } from '../whatsapp';

describe('waPhone', () => {
  it('normalises Saudi, Egyptian and international formats', () => {
    expect(waPhone('0551234567')).toBe('966551234567');
    expect(waPhone('551234567')).toBe('966551234567');
    expect(waPhone('+966 55 123 4567')).toBe('966551234567');
    expect(waPhone('00966551234567')).toBe('966551234567');
    expect(waPhone('01012345678')).toBe('201012345678');
    expect(waPhone('٠٥٥١٢٣٤٥٦٧')).toBe('966551234567');
    expect(waPhone('+971 50 123 4567')).toBe('971501234567');
  });
  it('rejects things that are not phones', () => {
    expect(waPhone('')).toBe('');
    expect(waPhone('12345')).toBe('');
  });
});

describe('waLink', () => {
  it('encodes the Arabic text', () => {
    expect(waLink('0551234567', 'أهلًا يا فهد')).toBe('https://wa.me/966551234567?text=' + encodeURIComponent('أهلًا يا فهد'));
    expect(waLink('', '')).toBe('https://wa.me/');
  });
});

describe('suggestTemplate', () => {
  it('picks a template meant for the stage', () => {
    expect(suggestTemplate({ stage: 'عرض مرسل' }).id).toBe('g1-quote');
    expect(suggestTemplate({ stage: 'اجتماع محجوز' }).id).toBe('g1-confirm');
    expect(suggestTemplate({ stage: '???' }).id).toBe(WA_TEMPLATES[0].id);
  });
  it('never uses the forbidden demo name', () => {
    expect(WA_TEMPLATES.map((t) => t.body + t.name).join(' ')).not.toMatch(/(^|[^خ])سارة/);
  });
});
