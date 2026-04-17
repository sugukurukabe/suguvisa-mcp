import { describe, it, expect } from 'vitest';
import { SUGUVISA_SCOPES, ALL_SCOPES, type Scope } from '../scopes.js';

describe('scopes', () => {
  it('should have 14 scopes defined', () => {
    expect(ALL_SCOPES.length).toBe(13);
  });

  it('should have all scopes as keys in SUGUVISA_SCOPES', () => {
    for (const scope of ALL_SCOPES) {
      expect(SUGUVISA_SCOPES[scope]).toBeDefined();
      expect(typeof SUGUVISA_SCOPES[scope]).toBe('string');
    }
  });

  it('should include read, generate, validate, write, admin categories', () => {
    const categories = new Set(ALL_SCOPES.map((s: Scope) => s.split(':')[0]));
    expect(categories).toContain('read');
    expect(categories).toContain('generate');
    expect(categories).toContain('validate');
    expect(categories).toContain('write');
    expect(categories).toContain('admin');
    expect(categories).toContain('review');
  });
});
