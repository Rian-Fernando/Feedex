/**
 * Attachment policy.
 *
 * One module owns every limit and every accepted type, because these numbers
 * have to agree in four places — the widget's file picker, the ingestion
 * validator, the settings UI that explains them, and the docs. When they drift,
 * the failure is a report that the reporter believes they sent.
 *
 * The allowlist is deliberately narrow and deliberately excludes SVG. An SVG is
 * a script container, and these bytes are served back from the application's
 * own origin; allowing one would be a stored-XSS primitive against the very
 * people triaging the report. Everything that is not a plain image is served
 * as a download rather than rendered, for the same reason.
 */

/** Most files one report may carry. */
export const MAX_ATTACHMENTS = 3;

/** Largest single decoded attachment, in bytes. */
export const MAX_ATTACHMENT_BYTES = 512 * 1024;

/** Largest combined decoded payload for one report, in bytes. */
export const MAX_ATTACHMENTS_TOTAL_BYTES = 1024 * 1024;

/** Types rendered inline in the dashboard. */
export const INLINE_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

/** Types accepted but only ever offered as a download. */
export const DOWNLOAD_ONLY_TYPES = ['text/plain', 'application/json', 'application/pdf'] as const;

export const ALLOWED_ATTACHMENT_TYPES: readonly string[] = [
  ...INLINE_IMAGE_TYPES,
  ...DOWNLOAD_ONLY_TYPES,
];

/** `accept` attribute for a file input, matching the allowlist above. */
export const ATTACHMENT_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,.txt,.log,.json,.pdf';

export function isAllowedAttachmentType(mimeType: string): boolean {
  return ALLOWED_ATTACHMENT_TYPES.includes(mimeType);
}

export function isInlineImage(mimeType: string): boolean {
  return (INLINE_IMAGE_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Decoded byte length of a base64 string, computed without decoding it.
 *
 * Used to reject an oversized upload before it is turned into a Buffer, so a
 * hostile payload cannot cost us the allocation it was aiming for.
 */
export function base64ByteLength(value: string): number {
  const length = value.length;
  if (length === 0) return 0;

  let padding = 0;
  if (value.charCodeAt(length - 1) === 61) padding += 1;
  if (value.charCodeAt(length - 2) === 61) padding += 1;

  return Math.floor((length * 3) / 4) - padding;
}

/** Human-readable size, e.g. "184 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
