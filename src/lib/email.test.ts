import { afterEach, describe, expect, it } from 'vitest';

import { emailConfigured, newFeedbackEmail } from './email';

/**
 * The property that matters most here is that an unconfigured instance is a
 * working instance. Feedex promises it needs a database and nothing else, and
 * a notification feature that turns a missing API key into an error would
 * quietly break that promise.
 */

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('emailConfigured', () => {
  it('is false when neither variable is set', () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    expect(emailConfigured()).toBe(false);
  });

  it('is false with only half the configuration', () => {
    process.env.RESEND_API_KEY = 'test';
    delete process.env.EMAIL_FROM;
    expect(emailConfigured()).toBe(false);

    delete process.env.RESEND_API_KEY;
    process.env.EMAIL_FROM = 'a@b.test';
    expect(emailConfigured()).toBe(false);
  });

  it('is true only when both are present', () => {
    process.env.RESEND_API_KEY = 'test';
    process.env.EMAIL_FROM = 'a@b.test';
    expect(emailConfigured()).toBe(true);
  });
});

describe('newFeedbackEmail', () => {
  const base = {
    to: 'dev@example.test',
    projectName: 'Portfolio',
    reference: 42,
    title: 'Export button does nothing',
    description: 'The export button on the reports page does nothing when clicked.',
    category: 'Bug',
    priority: 'high',
    feedbackId: 'fbk_test',
  };

  it('carries the report into both the subject and the body', () => {
    const mail = newFeedbackEmail(base);

    expect(mail.subject).toContain('Export button does nothing');
    expect(mail.subject).toContain('Portfolio');
    expect(mail.html).toContain('Export button does nothing');
    expect(mail.text).toContain('The export button');
  });

  it('always includes a plain-text alternative', () => {
    // Some clients prefer it and spam filters expect it; an HTML-only message
    // scores worse for no benefit.
    expect(newFeedbackEmail(base).text.length).toBeGreaterThan(0);
  });

  it('escapes markup so a report cannot inject into the email', () => {
    const mail = newFeedbackEmail({
      ...base,
      title: '<img src=x onerror=alert(1)>',
      description: '</td></table><script>alert(1)</script>',
    });

    /*
      The property is that no tag is formed, not that the characters are
      absent. `onerror=` survives as inert text inside an escaped string, which
      is correct — what must not survive is a `<` that opens an element.
    */
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).not.toContain('<img');
    expect(mail.html).not.toContain('</td></table><');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.html).toContain('&lt;img');
  });

  it('truncates a long description rather than mailing the whole thing', () => {
    const mail = newFeedbackEmail({ ...base, description: 'word '.repeat(500) });
    expect(mail.text.length).toBeLessThan(1200);
    expect(mail.text).toContain('…');
  });

  it('links back to the report', () => {
    expect(newFeedbackEmail(base).html).toContain('/dashboard/feedback/fbk_test');
  });
});
