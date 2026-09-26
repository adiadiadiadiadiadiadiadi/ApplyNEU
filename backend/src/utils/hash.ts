import { createHash } from 'node:crypto';

const PART_SEPARATOR = '\u0000';

export const normalizeForHash = (text: string): string =>
    text.trim().replace(/\s+/g, ' ').toLowerCase();

// Separated on NUL rather than a space: normalization emits spaces, so joining
// on one would let ('a b', 'c') and ('a', 'b c') hash identically.
export const normalizeAndHash = (...parts: string[]): string =>
    createHash('sha256')
        .update(parts.map(normalizeForHash).join(PART_SEPARATOR))
        .digest('hex');
