/**
 * Text similarity, without a model.
 *
 * Duplicate detection here is deliberately mechanical: token overlap and a
 * shared page, nothing learned and nothing inferred. That keeps the v1
 * no-AI constraint intact, runs in a millisecond, and — more usefully — is
 * explainable. A reviewer can see exactly why two reports were paired, which
 * matters because the product never merges anything on its own. It only
 * suggests; a person decides.
 *
 * The approach is Jaccard similarity over word sets with stopwords removed.
 * That handles the case this exists for — the same bug described twice in
 * different words — and honestly fails at paraphrase, which is the price of
 * not having a model.
 */

/**
 * Words too common to carry signal.
 *
 * Without this, every pair of English sentences looks alike: two reports
 * sharing only "the", "is", and "when" would score as related.
 */
const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'been',
  'but',
  'by',
  'can',
  'cannot',
  'did',
  'do',
  'does',
  'for',
  'from',
  'get',
  'gets',
  'had',
  'has',
  'have',
  'how',
  'i',
  'if',
  'in',
  'is',
  'it',
  'its',
  'just',
  'me',
  'my',
  'not',
  'of',
  'on',
  'or',
  'so',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'they',
  'this',
  'to',
  'too',
  'up',
  'was',
  'we',
  'were',
  'what',
  'when',
  'which',
  'while',
  'why',
  'will',
  'with',
  'you',
  'your',
]);

/** Lowercased words of three characters or more, stopwords removed. */
export function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 3 && !STOPWORDS.has(word)),
  );
}

/** Jaccard similarity: shared tokens over total distinct tokens. 0 to 1. */
export function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;

  let shared = 0;
  for (const token of a) {
    if (b.has(token)) shared += 1;
  }

  const union = a.size + b.size - shared;
  return union === 0 ? 0 : shared / union;
}

export interface DuplicateCandidate<T> {
  item: T;
  score: number;
  /** Why it was paired, shown to the person deciding. */
  reasons: string[];
}

/**
 * Ranks existing reports against a new one.
 *
 * Arriving on the same page is treated as corroborating evidence rather than
 * as a match on its own — two people can hit the same page for unrelated
 * reasons — so it raises a text score rather than producing one.
 */
export function findDuplicates<
  T extends { id: string; title: string; description: string; context: { path?: string } },
>(target: T, candidates: T[], threshold = 0.32): Array<DuplicateCandidate<T>> {
  const targetTokens = tokenize(`${target.title} ${target.description}`);
  const targetPath = target.context?.path;

  const scored: Array<DuplicateCandidate<T>> = [];

  for (const candidate of candidates) {
    if (candidate.id === target.id) continue;

    const tokens = tokenize(`${candidate.title} ${candidate.description}`);
    const text = similarity(targetTokens, tokens);
    const samePath = Boolean(targetPath && candidate.context?.path === targetPath);

    // A modest, bounded bump. Enough to surface a genuine pair that words alone
    // would have missed, not enough to pair two unrelated reports from a busy
    // page.
    const score = Math.min(1, text + (samePath ? 0.12 : 0));
    if (score < threshold) continue;

    const reasons: string[] = [`${Math.round(text * 100)}% wording overlap`];
    if (samePath) reasons.push(`same page (${targetPath})`);

    scored.push({ item: candidate, score, reasons });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, 5);
}
