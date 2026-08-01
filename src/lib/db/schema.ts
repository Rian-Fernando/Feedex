import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

/* -------------------------------------------------------------------------- */
/*                                   Enums                                    */
/* -------------------------------------------------------------------------- */

export const workspaceRole = pgEnum('workspace_role', ['owner', 'admin', 'member', 'viewer']);

export const projectEnvironment = pgEnum('project_environment', [
  'production',
  'staging',
  'development',
]);

export const projectStatus = pgEnum('project_status', ['active', 'paused', 'archived']);

export const feedbackCategory = pgEnum('feedback_category', [
  'bug',
  'feature',
  'ui',
  'performance',
  'content',
  'question',
  'other',
]);

export const feedbackStatus = pgEnum('feedback_status', [
  'open',
  'in_progress',
  'testing',
  'resolved',
  'closed',
]);

export const feedbackPriority = pgEnum('feedback_priority', ['low', 'medium', 'high', 'critical']);

export const apiKeyType = pgEnum('api_key_type', ['public', 'secret']);

export const activityAction = pgEnum('activity_action', [
  'workspace.created',
  'project.created',
  'project.updated',
  'project.archived',
  'project.deleted',
  'feedback.created',
  'feedback.status_changed',
  'feedback.priority_changed',
  'feedback.category_changed',
  'feedback.assigned',
  'feedback.deleted',
  'note.created',
  'api_key.created',
  'api_key.revoked',
  'member.invited',
  'member.removed',
]);

/* -------------------------------------------------------------------------- */
/*                              Identity & access                             */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: varchar('email', { length: 320 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    /**
     * Null for accounts that only ever authenticate through an OAuth provider.
     * Credentials auth writes a scrypt hash here.
     */
    passwordHash: text('password_hash'),
    avatarUrl: text('avatar_url'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    /** Per-user UI preferences (theme, density). Free-form by design. */
    preferences: jsonb('preferences')
      .$type<UserPreferences>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_email_unique').on(sql`lower(${table.email})`)],
);

/**
 * External identity links. Empty today — credentials auth is the only enabled
 * strategy — but present so that adding GitHub or Google OAuth is a matter of
 * inserting rows rather than migrating the identity model.
 */
export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 64 }).notNull(),
    providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    scope: text('scope'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
    index('accounts_user_id_idx').on(table.userId),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    /** SHA-256 of the opaque token. The raw token only ever lives in the cookie. */
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
);

/* -------------------------------------------------------------------------- */
/*                                 Tenancy                                    */
/* -------------------------------------------------------------------------- */

export const workspaces = pgTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 64 }).notNull(),
    /** Defaults applied to every new project created in this workspace. */
    settings: jsonb('settings')
      .$type<WorkspaceSettings>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('workspaces_slug_unique').on(table.slug)],
);

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: workspaceRole('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    index('workspace_members_user_id_idx').on(table.userId),
  ],
);

/* -------------------------------------------------------------------------- */
/*                                  Projects                                  */
/* -------------------------------------------------------------------------- */

export const projects = pgTable(
  'projects',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    slug: varchar('slug', { length: 64 }).notNull(),
    description: text('description'),
    /** Bare hostname, e.g. "rianfernando.com". Used for ingestion origin checks. */
    domain: varchar('domain', { length: 255 }),
    environment: projectEnvironment('environment').notNull().default('production'),
    status: projectStatus('status').notNull().default('active'),
    /** Accent colour used by the widget and by project chips in the dashboard. */
    color: varchar('color', { length: 16 }).notNull().default('#B58BF9'),
    widgetSettings: jsonb('widget_settings')
      .$type<WidgetSettings>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('projects_workspace_slug_unique').on(table.workspaceId, table.slug),
    index('projects_workspace_id_idx').on(table.workspaceId),
  ],
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    type: apiKeyType('type').notNull(),
    name: varchar('name', { length: 120 }).notNull().default('Default'),
    /**
     * Public keys are stored verbatim: they are published in client-side
     * snippets and grant nothing beyond "submit feedback to this project".
     * Secret keys are stored only as an HMAC digest.
     */
    keyHash: text('key_hash').notNull(),
    /** First characters of the key, shown in the UI to identify a rotated key. */
    keyPrefix: varchar('key_prefix', { length: 24 }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('api_keys_key_hash_unique').on(table.keyHash),
    index('api_keys_project_id_idx').on(table.projectId),
  ],
);

/* -------------------------------------------------------------------------- */
/*                                  Feedback                                  */
/* -------------------------------------------------------------------------- */

export const feedback = pgTable(
  'feedback',
  {
    id: text('id').primaryKey(),
    /**
     * Denormalised from `projects` so that every workspace-scoped query can be
     * satisfied without a join. Enforced by the service layer on write.
     */
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    /** Per-project incrementing reference, e.g. FDX-14. */
    reference: integer('reference').notNull(),

    title: varchar('title', { length: 200 }).notNull(),
    description: text('description').notNull(),

    category: feedbackCategory('category').notNull().default('other'),
    status: feedbackStatus('status').notNull().default('open'),
    priority: feedbackPriority('priority').notNull().default('medium'),

    reporterEmail: varchar('reporter_email', { length: 320 }),
    reporterName: varchar('reporter_name', { length: 120 }),

    /** Captured client context. Widened over time without a migration. */
    context: jsonb('context')
      .$type<FeedbackContext>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    tags: jsonb('tags')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    screenshotUrl: text('screenshot_url'),

    assignedToId: text('assigned_to_id').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('feedback_project_reference_unique').on(table.projectId, table.reference),
    index('feedback_workspace_created_idx').on(table.workspaceId, table.createdAt),
    index('feedback_project_status_idx').on(table.projectId, table.status),
    index('feedback_workspace_status_idx').on(table.workspaceId, table.status),
    index('feedback_assigned_to_idx').on(table.assignedToId),
  ],
);

/** Internal, team-only notes. Never exposed through the public API. */
export const feedbackNotes = pgTable(
  'feedback_notes',
  {
    id: text('id').primaryKey(),
    feedbackId: text('feedback_id')
      .notNull()
      .references(() => feedback.id, { onDelete: 'cascade' }),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('feedback_notes_feedback_id_idx').on(table.feedbackId, table.createdAt)],
);

/* -------------------------------------------------------------------------- */
/*                                  Activity                                  */
/* -------------------------------------------------------------------------- */

export const activities = pgTable(
  'activities',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Null when the actor is the widget (an anonymous end user) or the API. */
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: activityAction('action').notNull(),
    /** Loose reference; the target row may since have been deleted. */
    targetType: varchar('target_type', { length: 32 }).notNull(),
    targetId: text('target_id').notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('activities_workspace_created_idx').on(table.workspaceId, table.createdAt)],
);

/**
 * Fixed-window rate limiting for unauthenticated ingestion.
 *
 * Stored in Postgres rather than memory so the limit holds across serverless
 * instances. Swapping in Redis later means replacing this table's accessor,
 * not the call sites.
 */
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').primaryKey(),
    count: integer('count').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('rate_limits_expires_at_idx').on(table.expiresAt)],
);

/* -------------------------------------------------------------------------- */
/*                                 Relations                                  */
/* -------------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(workspaceMembers),
  sessions: many(sessions),
  accounts: many(accounts),
}));

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  projects: many(projects),
  feedback: many(feedback),
  activities: many(activities),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, { fields: [workspaceMembers.userId], references: [users.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [projects.workspaceId], references: [workspaces.id] }),
  feedback: many(feedback),
  apiKeys: many(apiKeys),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  project: one(projects, { fields: [apiKeys.projectId], references: [projects.id] }),
}));

export const feedbackRelations = relations(feedback, ({ one, many }) => ({
  project: one(projects, { fields: [feedback.projectId], references: [projects.id] }),
  workspace: one(workspaces, { fields: [feedback.workspaceId], references: [workspaces.id] }),
  assignedTo: one(users, { fields: [feedback.assignedToId], references: [users.id] }),
  notes: many(feedbackNotes),
}));

export const feedbackNotesRelations = relations(feedbackNotes, ({ one }) => ({
  feedback: one(feedback, { fields: [feedbackNotes.feedbackId], references: [feedback.id] }),
  author: one(users, { fields: [feedbackNotes.authorId], references: [users.id] }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  workspace: one(workspaces, { fields: [activities.workspaceId], references: [workspaces.id] }),
  actor: one(users, { fields: [activities.actorId], references: [users.id] }),
}));

/* -------------------------------------------------------------------------- */
/*                              JSONB payload types                           */
/* -------------------------------------------------------------------------- */

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  density?: 'comfortable' | 'compact';
}

export interface WorkspaceSettings {
  defaultPriority?: (typeof feedbackPriority.enumValues)[number];
  defaultEnvironment?: (typeof projectEnvironment.enumValues)[number];
  defaultCategories?: (typeof feedbackCategory.enumValues)[number][];
}

export interface WidgetSettings {
  position?: 'bottom-right' | 'bottom-left';
  accentColor?: string;
  buttonLabel?: string;
  title?: string;
  description?: string;
  successMessage?: string;
  requireEmail?: boolean;
  categories?: (typeof feedbackCategory.enumValues)[number][];
  theme?: 'light' | 'dark' | 'auto';
}

/**
 * Client context captured by the widget.
 *
 * Every field is optional: the widget must keep working if a browser withholds
 * a value, and new fields (session replay ids, build SHAs) can be appended
 * without a migration.
 */
export interface FeedbackContext {
  url?: string;
  path?: string;
  referrer?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  device?: 'desktop' | 'tablet' | 'mobile';
  viewport?: { width: number; height: number };
  screen?: { width: number; height: number };
  language?: string;
  timezone?: string;
  userAgent?: string;
  /** Arbitrary key/value pairs attached by the host application. */
  custom?: Record<string, string>;
}

/* -------------------------------------------------------------------------- */
/*                                Inferred types                              */
/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;
export type FeedbackNote = typeof feedbackNotes.$inferSelect;
export type Activity = typeof activities.$inferSelect;

export type WorkspaceRole = (typeof workspaceRole.enumValues)[number];
export type FeedbackCategory = (typeof feedbackCategory.enumValues)[number];
export type FeedbackStatus = (typeof feedbackStatus.enumValues)[number];
export type FeedbackPriority = (typeof feedbackPriority.enumValues)[number];
export type ProjectEnvironment = (typeof projectEnvironment.enumValues)[number];
export type ProjectStatus = (typeof projectStatus.enumValues)[number];
export type ActivityAction = (typeof activityAction.enumValues)[number];
