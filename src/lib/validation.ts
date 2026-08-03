import { z } from 'zod';

import {
  feedbackCategory,
  feedbackPriority,
  feedbackStatus,
  projectEnvironment,
  projectStatus,
} from '@/lib/db/schema';
import {
  MAX_ATTACHMENTS,
  MAX_ATTACHMENTS_TOTAL_BYTES,
  MAX_ATTACHMENT_BYTES,
  base64ByteLength,
  isAllowedAttachmentType,
} from '@/lib/attachments';

/**
 * Validation contracts shared by server actions, the public API, and the
 * widget. Defining them once means a rule tightened here is enforced on every
 * ingress path, and the inferred types stay aligned with the database enums.
 */

/* --------------------------------- Shared --------------------------------- */

/**
 * Characters that are invisible in prose but useful for spoofing and for
 * breaking downstream exports: control characters, zero-width joiners, BOMs.
 * Stripping them is defence in depth — React escapes on render — and mainly
 * keeps stored data clean for exports and future integrations.
 */
const INVISIBLE_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B-\u200D\uFEFF]/g;

const sanitizedText = (max: number) =>
  z
    .string()
    .transform((value) => value.replace(INVISIBLE_CHARS, '').trim())
    .pipe(z.string().max(max));

const requiredText = (min: number, max: number, label: string) =>
  sanitizedText(max).pipe(z.string().min(min, `${label} must be at least ${min} characters.`));

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(320)
  .email('Enter a valid email address.');

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(200, 'That password is too long.')
  // Deliberately not requiring symbol classes: length is the stronger signal and
  // composition rules push people toward predictable substitutions.
  .refine((value) => value.trim().length >= 10, 'Use at least 10 non-whitespace characters.');

/**
 * Hostname without scheme or path, e.g. `app.example.com`. Used to scope widget
 * ingestion to the origins a project actually runs on.
 */
export const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(255)
  .regex(
    /^(?:localhost|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,})$/,
    'Enter a bare hostname, such as example.com.',
  );

export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Enter a hex colour such as #B58BF9.');

/* ---------------------------------- Auth ---------------------------------- */

export const registerSchema = z.object({
  name: requiredText(2, 120, 'Name'),
  email: emailSchema,
  password: passwordSchema,
  workspaceName: requiredText(2, 120, 'Workspace name').optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.').max(200),
});

export const updateProfileSchema = z.object({
  name: requiredText(2, 120, 'Name'),
  email: emailSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.').max(200),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'The passwords do not match.',
    path: ['confirmPassword'],
  });

/* -------------------------------- Workspace -------------------------------- */

export const updateWorkspaceSchema = z.object({
  name: requiredText(2, 120, 'Workspace name'),
  defaultPriority: z.enum(feedbackPriority.enumValues).optional(),
  defaultEnvironment: z.enum(projectEnvironment.enumValues).optional(),
});

/* --------------------------------- Projects -------------------------------- */

export const widgetSettingsSchema = z.object({
  position: z.enum(['bottom-right', 'bottom-left']).default('bottom-right'),
  accentColor: hexColorSchema.default('#B58BF9'),
  buttonLabel: sanitizedText(32).default('Feedback'),
  title: sanitizedText(64).default('Send feedback'),
  description: sanitizedText(160).default('Found a bug or have an idea? Let us know.'),
  successMessage: sanitizedText(160).default('Thanks — your feedback has been received.'),
  launcherIcon: z.enum(['chat', 'bug', 'spark', 'none']).default('chat'),
  requireEmail: z.boolean().default(false),
  attachmentsEnabled: z.boolean().default(true),
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  categories: z
    .array(z.enum(feedbackCategory.enumValues))
    .min(1, 'Enable at least one category.')
    .default(['bug', 'feature', 'ui', 'other']),
});

export const createProjectSchema = z.object({
  name: requiredText(2, 120, 'Project name'),
  description: sanitizedText(500).optional(),
  domain: domainSchema.optional().or(z.literal('')),
  environment: z.enum(projectEnvironment.enumValues).default('production'),
  color: hexColorSchema.default('#B58BF9'),
});

export const updateProjectSchema = createProjectSchema.extend({
  status: z.enum(projectStatus.enumValues).optional(),
});

/* --------------------------------- Feedback -------------------------------- */

/**
 * Client context accepted from the widget.
 *
 * Every field is optional and bounded. The widget is untrusted input running on
 * a third party's page, so nothing here may be assumed present or well-formed.
 */
export const feedbackContextSchema = z
  .object({
    url: z.string().max(2048).optional(),
    path: z.string().max(1024).optional(),
    referrer: z.string().max(2048).optional(),
    browser: sanitizedText(64).optional(),
    browserVersion: sanitizedText(32).optional(),
    os: sanitizedText(64).optional(),
    device: z.enum(['desktop', 'tablet', 'mobile']).optional(),
    viewport: z
      .object({
        width: z.number().int().min(0).max(20000),
        height: z.number().int().min(0).max(20000),
      })
      .optional(),
    screen: z
      .object({
        width: z.number().int().min(0).max(20000),
        height: z.number().int().min(0).max(20000),
      })
      .optional(),
    language: sanitizedText(32).optional(),
    timezone: sanitizedText(64).optional(),
    userAgent: sanitizedText(512).optional(),
    custom: z.record(z.string().max(64), z.string().max(512)).optional(),
  })
  .strip();

/** Payload accepted by `POST /api/v1/feedback` from the widget. */
/**
 * One uploaded screenshot or file.
 *
 * The declared `type` is checked against the allowlist rather than trusted, and
 * the size is derived from the base64 itself rather than from any client-stated
 * length — a payload that lies about its size would otherwise get to allocate
 * whatever it wanted.
 */
export const attachmentSchema = z.object({
  name: sanitizedText(255).default('attachment'),
  type: z.string().max(128).refine(isAllowedAttachmentType, 'That file type is not accepted.'),
  /** Base64 without a data-URL prefix. */
  data: z
    .string()
    .min(1)
    .max(Math.ceil((MAX_ATTACHMENT_BYTES * 4) / 3) + 8, 'That file is too large.')
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Malformed attachment payload.')
    .refine(
      (value) => base64ByteLength(value) <= MAX_ATTACHMENT_BYTES,
      `Each file must be under ${Math.round(MAX_ATTACHMENT_BYTES / 1024)} KB.`,
    ),
});

export const submitFeedbackSchema = z.object({
  publicKey: z.string().min(8).max(128),
  category: z.enum(feedbackCategory.enumValues).default('other'),
  title: sanitizedText(200).optional(),
  description: requiredText(5, 5000, 'Description'),
  email: emailSchema.optional().or(z.literal('')),
  name: sanitizedText(120).optional(),
  context: feedbackContextSchema.optional(),
  attachments: z
    .array(attachmentSchema)
    .max(MAX_ATTACHMENTS)
    .optional()
    .refine(
      (files) =>
        !files ||
        files.reduce((total, file) => total + base64ByteLength(file.data), 0) <=
          MAX_ATTACHMENTS_TOTAL_BYTES,
      `Attachments must total under ${Math.round(MAX_ATTACHMENTS_TOTAL_BYTES / 1024)} KB.`,
    ),
});

export const updateFeedbackSchema = z.object({
  title: requiredText(3, 200, 'Title').optional(),
  status: z.enum(feedbackStatus.enumValues).optional(),
  priority: z.enum(feedbackPriority.enumValues).optional(),
  category: z.enum(feedbackCategory.enumValues).optional(),
  assignedToId: z.string().max(64).nullable().optional(),
  tags: z.array(sanitizedText(32)).max(12).optional(),
});

export const createNoteSchema = z.object({
  body: requiredText(1, 4000, 'Note'),
});

/** Query parameters for the feedback list view and the REST API. */
export const feedbackFilterSchema = z.object({
  projectId: z.string().max(64).optional(),
  status: z.enum(feedbackStatus.enumValues).optional(),
  priority: z.enum(feedbackPriority.enumValues).optional(),
  category: z.enum(feedbackCategory.enumValues).optional(),
  q: z.string().trim().max(200).optional(),
  sort: z.enum(['newest', 'oldest', 'priority']).default('newest'),
  /** Accepted so the view toggle survives `safeParse`; the page reads it directly. */
  view: z.enum(['list', 'board']).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export const createApiKeySchema = z.object({
  name: requiredText(1, 120, 'Key name').default('Default'),
  type: z.enum(['public', 'secret']),
});

/* ---------------------------------- Types ---------------------------------- */

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type WidgetSettingsInput = z.infer<typeof widgetSettingsSchema>;
export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
export type UpdateFeedbackInput = z.infer<typeof updateFeedbackSchema>;
export type FeedbackFilterInput = z.infer<typeof feedbackFilterSchema>;

/** Flattens a Zod error into the `fieldErrors` shape used by `ActionResult`. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    (result[key] ??= []).push(issue.message);
  }
  return result;
}
