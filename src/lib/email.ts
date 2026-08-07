import 'server-only';

import { appUrl } from '@/config/env';
import { siteConfig } from '@/config/site';

/**
 * Transactional email, through Resend's HTTP API.
 *
 * Written against `fetch` rather than the SDK for the same reason the GitHub
 * client is: one endpoint is called, and the SDK brings a dependency tree to
 * reach it.
 *
 * **Email is optional.** With no `RESEND_API_KEY` configured, every send is a
 * no-op that returns cleanly — the product does not degrade, it simply does
 * not email. That matters because the promise elsewhere is that Feedex needs a
 * database and nothing else, and a feature that turns a missing API key into a
 * crash would quietly break that.
 *
 * Nothing here ever throws into a request path. A notification is a courtesy;
 * failing to send one must never fail the thing that triggered it.
 */

const ENDPOINT = 'https://api.resend.com/emails';

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative. Some clients prefer it, and spam filters expect it. */
  text: string;
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  if (!emailConfigured()) return false;

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!response.ok) {
      console.error('[feedex] email send failed', response.status, await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('[feedex] email send threw', error);
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Trims a body to something an email should carry, on a word boundary. */
function excerpt(text: string, max = 400): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, collapsed.lastIndexOf(' ', max))}…`;
}

export interface NewFeedbackEmail {
  to: string;
  projectName: string;
  reference: number;
  title: string;
  description: string;
  category: string;
  priority: string;
  feedbackId: string;
  page?: string;
}

/**
 * A new-report notification.
 *
 * Hand-written markup rather than a template library: it is one email, and
 * email clients are a compatibility problem — inline styles, tables, no
 * flexbox — that a React renderer would obscure rather than solve.
 */
export function newFeedbackEmail(input: NewFeedbackEmail): SendEmailInput {
  const url = new URL(`/dashboard/feedback/${input.feedbackId}`, appUrl()).toString();
  const body = excerpt(input.description);

  const text = [
    `New ${input.category.toLowerCase()} in ${input.projectName}`,
    '',
    input.title,
    '',
    body,
    '',
    input.page ? `Page: ${input.page}` : '',
    `Priority: ${input.priority}`,
    '',
    `View it: ${url}`,
  ]
    .filter(Boolean)
    .join('\n');

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f1ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#17101f">
    <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e3ded2">
      <tr>
        <td style="padding:24px 24px 8px">
          <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#8d8778">
            ${escapeHtml(input.projectName)} · #${input.reference}
          </p>
          <h1 style="margin:8px 0 0;font-size:18px;line-height:1.35;font-weight:600">
            ${escapeHtml(input.title)}
          </h1>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 24px 0">
          <p style="margin:0;font-size:14px;line-height:1.6;color:#4a4356;white-space:pre-wrap">${escapeHtml(body)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px 0">
          <p style="margin:0;font-size:13px;color:#8d8778">
            ${escapeHtml(input.category)} · ${escapeHtml(input.priority)} priority${
              input.page ? ` · ${escapeHtml(input.page)}` : ''
            }
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 24px 24px">
          <a href="${url}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600">
            Open in ${siteConfig.name}
          </a>
        </td>
      </tr>
    </table>
    <p style="max-width:560px;margin:16px auto 0;font-size:12px;color:#8d8778;text-align:center">
      You are receiving this because notifications are on for ${escapeHtml(input.projectName)}.
      Turn them off in Settings.
    </p>
  </body>
</html>`;

  return { to: input.to, subject: `${input.title} · ${input.projectName}`, html, text };
}
