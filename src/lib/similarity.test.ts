import { describe, expect, it } from 'vitest';

import { findDuplicates, similarity, tokenize } from './similarity';

/**
 * These assertions are about the false-positive rate as much as the hit rate.
 * A duplicate suggestion that is usually wrong is worse than none: people stop
 * reading it, and then miss the one time it was right.
 */

const item = (id: string, title: string, description: string, path?: string) => ({
  id,
  title,
  description,
  context: path ? { path } : {},
});

describe('tokenize', () => {
  it('drops stopwords and short words', () => {
    expect([...tokenize('The export button is not working')]).toEqual([
      'export',
      'button',
      'working',
    ]);
  });

  it('ignores punctuation and case', () => {
    expect(tokenize('Export, EXPORT; export!')).toEqual(new Set(['export']));
  });
});

describe('similarity', () => {
  it('is 1 for identical token sets and 0 for disjoint ones', () => {
    expect(similarity(tokenize('export button broken'), tokenize('export button broken'))).toBe(1);
    expect(similarity(tokenize('export button'), tokenize('login redirect'))).toBe(0);
  });

  it('is 0 when either side has no meaningful tokens', () => {
    expect(similarity(tokenize('the and is'), tokenize('export button'))).toBe(0);
  });
});

describe('findDuplicates', () => {
  const target = item(
    'a',
    'Export button does nothing',
    'The export button on reports does nothing when clicked.',
    '/reports',
  );

  it('finds the same bug described in similar words', () => {
    const results = findDuplicates(target, [
      item(
        'b',
        'Export button not working',
        'Clicking the export button on the reports page does nothing.',
        '/reports',
      ),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0]!.item.id).toBe('b');
    expect(results[0]!.reasons.some((r) => r.includes('same page'))).toBe(true);
  });

  it('does not pair unrelated reports that share a page', () => {
    const results = findDuplicates(target, [
      item('c', 'Add a dark mode', 'Please add a dark theme to the dashboard.', '/reports'),
    ]);

    expect(results).toHaveLength(0);
  });

  it('never suggests the report itself', () => {
    expect(findDuplicates(target, [target])).toHaveLength(0);
  });

  it('ranks the closest match first', () => {
    const results = findDuplicates(target, [
      item('d', 'Export is slow', 'The export on reports takes a while.', '/reports'),
      item(
        'e',
        'Export button does nothing',
        'The export button on reports does nothing when clicked.',
        '/reports',
      ),
    ]);

    expect(results[0]!.item.id).toBe('e');
  });

  it('returns at most five, so the panel stays a shortlist', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      item(
        `x${i}`,
        'Export button does nothing',
        'The export button on reports does nothing when clicked.',
        '/reports',
      ),
    );

    expect(findDuplicates(target, many)).toHaveLength(5);
  });
});
