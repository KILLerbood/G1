import { describe, expect, it } from 'vitest';
import { NAV, isActive, navByKey } from '../nav';

describe('nav', () => {
  it('marks only the most specific item active', () => {
    expect(isActive('/', '/')).toBe(true);
    expect(isActive('/', '/tasks')).toBe(false);
    expect(isActive('/sales-tools/pipeline', '/sales-tools/pipeline')).toBe(true);
    expect(isActive('/sales-tools', '/sales-tools/pipeline')).toBe(false);
    expect(isActive('/sales-tools', '/sales-tools')).toBe(true);
    expect(isActive('/companies', '/companies/abc')).toBe(true);
  });
  it('has unique 1-9 keys for G+number', () => {
    const keys = NAV.map((n) => n.key).filter(Boolean);
    expect(new Set(keys).size).toBe(keys.length);
    expect(navByKey('1')?.path).toBe('/');
    expect(navByKey('0')).toBeUndefined();
  });
});
