import { describe, it, expect } from '@jest/globals';
import { normalizeForHash, normalizeAndHash } from '../../src/utils/hash.ts';

describe('normalizeForHash', () => {
    it('trims, collapses whitespace runs, and lowercases', () => {
        expect(normalizeForHash('  Senior   Backend  Engineer  ')).toBe('senior backend engineer');
    });
});

describe('normalizeAndHash', () => {
    it('is stable across whitespace and case differences', () => {
        expect(normalizeAndHash('Apply  via   the portal')).toBe(normalizeAndHash('apply via the portal'));
    });

    it('differs when the text differs', () => {
        expect(normalizeAndHash('apply via the portal')).not.toBe(normalizeAndHash('apply via email'));
    });

    it('does not collide across part boundaries', () => {
        expect(normalizeAndHash('a b', 'c')).not.toBe(normalizeAndHash('a', 'b c'));
    });

    it('returns a sha256 hex digest', () => {
        expect(normalizeAndHash('anything')).toMatch(/^[0-9a-f]{64}$/);
    });
});
