import { describe, expect, it } from 'vitest';
import { matchScore, rankBy } from '../palette';

describe('matchScore', () => {
  it('scores exact > prefix > word prefix > contains > scattered words', () => {
    expect(matchScore('المهام', 'المهام')).toBe(100);
    expect(matchScore('المهام اليومية', 'المه')).toBe(80);
    expect(matchScore('مهمة جديدة', 'جدي')).toBe(60);
    expect(matchScore('التقارير', 'قار')).toBe(40);
    expect(matchScore('معرض الفخامة', 'الرياض فخامه', 'الرياض')).toBe(20);
    expect(matchScore('الإعدادات', 'xyz')).toBe(0);
  });
  it('folds Arabic spelling (أ/ا, ة/ه)', () => {
    expect(matchScore('الأناقة', 'الاناقه')).toBe(100);
  });
  it('matches everything when empty', () => { expect(matchScore('x', '')).toBe(1); });
});

describe('rankBy', () => {
  it('sorts by score and keeps order for ties', () => {
    const items = ['التقارير', 'المسار', 'مسار المبيعات', 'الإعدادات'];
    expect(rankBy(items, 'مسار', (x) => [x])).toEqual(['مسار المبيعات', 'المسار']);
    expect(rankBy(items, '', (x) => [x])).toEqual(items);
  });
});
