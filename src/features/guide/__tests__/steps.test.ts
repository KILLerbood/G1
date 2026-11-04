import { describe, expect, it } from 'vitest';
import { placeCard, TOUR, FLOW, SHORTCUTS } from '../steps';

const vp = { width: 1440, height: 900 };
const card = { width: 360, height: 200 };

describe('placeCard', () => {
  it('puts the card below the target when there is room', () => {
    const p = placeCard({ top: 100, left: 600, width: 200, height: 40 }, card, vp);
    expect(p.side).toBe('below');
    expect(p.top).toBe(154);
    expect(p.left).toBe(520);
  });
  it('flips above near the bottom and centres when neither fits', () => {
    expect(placeCard({ top: 800, left: 600, width: 200, height: 40 }, card, vp).side).toBe('above');
    expect(placeCard({ top: 150, left: 0, width: 200, height: 700 }, card, vp).side).toBe('center');
    expect(placeCard(null, card, vp).side).toBe('center');
  });
  it('stays inside the viewport horizontally', () => {
    expect(placeCard({ top: 10, left: 1400, width: 30, height: 30 }, card, vp).left).toBe(1440 - 360 - 12);
    expect(placeCard({ top: 10, left: 0, width: 10, height: 30 }, card, { width: 375, height: 700 }).left).toBe(12);
  });
});

describe('guide content', () => {
  it('explains the whole flow and five shortcuts', () => {
    expect(FLOW.map((f) => f.id)).toEqual(['lead', 'follow', 'deal', 'client', 'billing']);
    expect(SHORTCUTS).toHaveLength(5);
    expect(TOUR.length).toBeGreaterThanOrEqual(5);
    expect(new Set(TOUR.map((s) => s.target)).size).toBe(TOUR.length);
  });
});
