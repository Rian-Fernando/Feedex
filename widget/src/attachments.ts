/**
 * Turning a picked file into something safe to send.
 *
 * Screenshots are the whole point of this feature and they are also the worst
 * case for size: a full-page grab off a high-DPI display is routinely several
 * megabytes, which is far past what the server accepts. Rejecting those would
 * make the feature useless exactly when someone is trying to report a visual
 * bug, so images are downscaled in the browser instead, and only the result is
 * uploaded. A 2560-wide screenshot becomes a ~200 KB JPEG that still shows the
 * problem clearly.
 *
 * Non-images cannot be re-encoded, so they are simply held to the cap.
 */

export interface PreparedAttachment {
  name: string;
  type: string;
  /** Base64 without the data-URL prefix, which is what the API expects. */
  data: string;
  /** Decoded size, for the total-payload check before submitting. */
  size: number;
  /** Object URL for the thumbnail, or null for a non-image. */
  preview: string | null;
}

export interface AttachmentLimits {
  maxCount: number;
  maxBytes: number;
  maxTotalBytes: number;
  accept: string;
}

export const DEFAULT_LIMITS: AttachmentLimits = {
  maxCount: 3,
  maxBytes: 512 * 1024,
  maxTotalBytes: 1024 * 1024,
  accept: 'image/png,image/jpeg,image/webp,image/gif,.txt,.log,.json,.pdf',
};

/** Longest edge, in CSS pixels, that a downscaled screenshot is reduced to. */
const MAX_IMAGE_EDGE = 1600;

/** Quality ladder walked until the encoded image fits under the cap. */
const QUALITY_STEPS = [0.82, 0.7, 0.58, 0.45];

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export function isImage(type: string): boolean {
  return IMAGE_TYPES.indexOf(type) !== -1;
}

/** Strips the `data:...;base64,` prefix a FileReader produces. */
function stripDataUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
}

function base64Size(base64: string): number {
  let padding = 0;
  if (base64.charAt(base64.length - 1) === '=') padding += 1;
  if (base64.charAt(base64.length - 2) === '=') padding += 1;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That image could not be read.'));
    image.src = url;
  });
}

/**
 * Downscales and re-encodes an image until it fits under `maxBytes`.
 *
 * GIFs are passed through untouched when they already fit: drawing one to a
 * canvas would flatten it to its first frame, and an animation is often the
 * only way a reporter can show a timing or transition bug.
 */
async function compressImage(
  file: File,
  maxBytes: number,
): Promise<{ data: string; type: string }> {
  const original = await readAsDataUrl(file);
  const originalBase64 = stripDataUrl(original);

  if (file.type === 'image/gif') {
    if (base64Size(originalBase64) <= maxBytes) {
      return { data: originalBase64, type: 'image/gif' };
    }
    throw new Error('That GIF is too large. Please attach a still image instead.');
  }

  // Already small enough: keep the original bytes and the original format,
  // which for a PNG screenshot means keeping it lossless.
  if (base64Size(originalBase64) <= maxBytes) {
    return { data: originalBase64, type: file.type };
  }

  const image = await loadImage(original);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('That image could not be processed.');

  // Screenshots of light UIs are usually PNGs with transparency; flattening
  // onto white keeps JPEG from rendering those areas black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  for (const quality of QUALITY_STEPS) {
    const encoded = stripDataUrl(canvas.toDataURL('image/jpeg', quality));
    if (base64Size(encoded) <= maxBytes) return { data: encoded, type: 'image/jpeg' };
  }

  throw new Error('That image is too large to attach, even after compressing.');
}

/**
 * Validates and prepares one picked file.
 *
 * Throws with a message written for the person who picked the file, since the
 * widget shows it to them verbatim.
 */
export async function prepareAttachment(
  file: File,
  limits: AttachmentLimits,
): Promise<PreparedAttachment> {
  const type = file.type || 'application/octet-stream';

  if (isImage(type)) {
    const compressed = await compressImage(file, limits.maxBytes);
    return {
      name: file.name || 'screenshot.png',
      type: compressed.type,
      data: compressed.data,
      size: base64Size(compressed.data),
      preview: URL.createObjectURL(file),
    };
  }

  if (file.size > limits.maxBytes) {
    throw new Error(`Files must be under ${Math.round(limits.maxBytes / 1024)} KB.`);
  }

  const allowed = ['text/plain', 'application/json', 'application/pdf'];
  const resolved = resolveNonImageType(file, type);

  if (allowed.indexOf(resolved) === -1) {
    throw new Error('Images, text, JSON, and PDF files can be attached.');
  }

  const data = stripDataUrl(await readAsDataUrl(file));

  return {
    name: file.name || 'attachment',
    type: resolved,
    data,
    size: base64Size(data),
    preview: null,
  };
}

/**
 * Fills in a type for files the OS did not label.
 *
 * `.log` is the common case: browsers report it as an empty string, and it is
 * one of the more useful things to attach to a bug report.
 */
function resolveNonImageType(file: File, type: string): string {
  if (type && type !== 'application/octet-stream') return type;

  const name = file.name.toLowerCase();
  if (name.endsWith('.log') || name.endsWith('.txt')) return 'text/plain';
  if (name.endsWith('.json')) return 'application/json';
  if (name.endsWith('.pdf')) return 'application/pdf';

  return type;
}
