import 'server-only';

import { and, eq, sql } from 'drizzle-orm';

import { getDb, type Database } from '@/lib/db';
import { accounts, users, type User } from '@/lib/db/schema';
import { createId, ID_PREFIX } from '@/lib/ids';
import { AppError } from '@/lib/errors';
import { fakeVerify, hashPassword, verifyPassword } from '@/lib/auth/password';
import type { RegisterInput } from '@/lib/validation';
import type { OAuthProfile, TokenSet } from '@/lib/auth/oauth';
import { createWorkspace } from './workspaces';

/**
 * Credentials-based account management.
 *
 * The `accounts` table already models external identity links, so adding an
 * OAuth provider later means adding a `signInWithProvider` function beside
 * these rather than reshaping the user model. Nothing here assumes a password
 * exists — `users.password_hash` is nullable for exactly that reason.
 */

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(users)
    // Matches the functional unique index on lower(email).
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Creates a user and their first workspace in one transaction.
 *
 * A user without a workspace has nowhere to put projects, so the two are
 * created together rather than leaving an intermediate state to repair later.
 */
export async function registerUser(
  input: RegisterInput,
): Promise<{ user: User; workspaceId: string }> {
  const db = await getDb();

  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw AppError.conflict('An account with that email already exists.');
  }

  const passwordHash = await hashPassword(input.password);
  const userId = createId(ID_PREFIX.user);

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(users)
      .values({
        id: userId,
        email: input.email,
        name: input.name,
        passwordHash,
        preferences: { theme: 'system' },
      })
      .returning();

    const user = inserted[0];
    if (!user) throw new Error('Failed to create user.');

    const workspace = await createWorkspace(
      { name: input.workspaceName?.trim() || defaultWorkspaceName(input.name), ownerId: user.id },
      tx as unknown as Database,
    );

    return { user, workspaceId: workspace.id };
  });
}

function defaultWorkspaceName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? name;
  return `${first}'s workspace`;
}

/**
 * Verifies credentials.
 *
 * Returns `null` for both an unknown email and a wrong password, and burns
 * equivalent CPU time in the unknown-email case, so responses do not disclose
 * which addresses are registered.
 */
export async function verifyCredentials(email: string, password: string): Promise<User | null> {
  const user = await findUserByEmail(email);

  if (!user?.passwordHash) {
    await fakeVerify();
    return null;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  return valid ? user : null;
}

export async function updateProfile(
  userId: string,
  input: { name: string; email: string },
): Promise<User> {
  const db = await getDb();

  const existing = await findUserByEmail(input.email);
  if (existing && existing.id !== userId) {
    throw AppError.conflict('That email is already in use.');
  }

  const rows = await db
    .update(users)
    .set({ name: input.name, email: input.email, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  const user = rows[0];
  if (!user) throw AppError.notFound('Account not found.');
  return user;
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const db = await getDb();
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];

  if (!user?.passwordHash) throw AppError.notFound('Account not found.');

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw AppError.validation('Your current password is incorrect.');

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function updatePreferences(
  userId: string,
  preferences: { theme?: 'light' | 'dark' | 'system'; density?: 'comfortable' | 'compact' },
): Promise<void> {
  const db = await getDb();
  const rows = await db
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  await db
    .update(users)
    .set({
      preferences: { ...(rows[0]?.preferences ?? {}), ...preferences },
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

/** Whether any account exists. Drives first-run onboarding copy. */
export async function hasAnyUser(): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select({ id: users.id }).from(users).limit(1);
  return rows.length > 0;
}

/* ------------------------------ OAuth sign-in ----------------------------- */

/**
 * Signs in (or signs up) through an external provider.
 *
 * Three cases, in order:
 *
 *   1. The provider account is already linked → sign that user in.
 *   2. No link, but a user exists with the same email → link them, *only* if
 *      the provider asserts the email is verified. Without that check, signing
 *      up at a provider with someone else's address would take over their
 *      workspace.
 *   3. Otherwise → create a user and their first workspace, exactly as
 *      password registration does.
 *
 * The result is an ordinary session either way; nothing downstream knows or
 * cares which strategy produced it.
 */
export async function signInWithProvider(input: {
  provider: string;
  profile: OAuthProfile;
  tokens: TokenSet;
}): Promise<{ user: User; created: boolean }> {
  const db = await getDb();
  const { provider, profile, tokens } = input;

  const linked = await db
    .select({ user: users })
    .from(accounts)
    .innerJoin(users, eq(accounts.userId, users.id))
    .where(
      and(
        eq(accounts.provider, provider),
        eq(accounts.providerAccountId, profile.providerAccountId),
      ),
    )
    .limit(1);

  const existingLink = linked[0];

  if (existingLink) {
    await db
      .update(accounts)
      .set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
      })
      .where(
        and(
          eq(accounts.provider, provider),
          eq(accounts.providerAccountId, profile.providerAccountId),
        ),
      );

    return { user: existingLink.user, created: false };
  }

  const byEmail = await findUserByEmail(profile.email);

  if (byEmail) {
    if (!profile.emailVerified) {
      throw AppError.forbidden(
        'An account already exists with that email. Sign in with your password first, or verify your email with the provider.',
      );
    }

    await db.insert(accounts).values({
      userId: byEmail.id,
      provider,
      providerAccountId: profile.providerAccountId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
    });

    // Fill in an avatar if the account never had one.
    if (!byEmail.avatarUrl && profile.avatarUrl) {
      await db
        .update(users)
        .set({ avatarUrl: profile.avatarUrl, updatedAt: new Date() })
        .where(eq(users.id, byEmail.id));
    }

    return { user: byEmail, created: false };
  }

  // New account. `password_hash` stays null — this user signs in only through
  // the provider until they set a password.
  const userId = createId(ID_PREFIX.user);

  const user = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(users)
      .values({
        id: userId,
        email: profile.email,
        name: profile.name,
        passwordHash: null,
        avatarUrl: profile.avatarUrl,
        emailVerifiedAt: profile.emailVerified ? new Date() : null,
        preferences: { theme: 'system' },
      })
      .returning();

    const created = inserted[0];
    if (!created) throw new Error('Failed to create user.');

    await tx.insert(accounts).values({
      userId: created.id,
      provider,
      providerAccountId: profile.providerAccountId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
    });

    await createWorkspace(
      { name: defaultWorkspaceName(created.name), ownerId: created.id },
      tx as unknown as Database,
    );

    return created;
  });

  return { user, created: true };
}

/** External identities linked to an account, for the settings page. */
export async function listLinkedAccounts(
  userId: string,
): Promise<Array<{ provider: string; createdAt: Date }>> {
  const db = await getDb();

  return db
    .select({ provider: accounts.provider, createdAt: accounts.createdAt })
    .from(accounts)
    .where(eq(accounts.userId, userId));
}

/** Whether this account can still sign in without the given provider. */
export async function canUnlinkProvider(userId: string, provider: string): Promise<boolean> {
  const db = await getDb();

  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (rows[0]?.passwordHash) return true;

  const linked = await listLinkedAccounts(userId);
  return linked.filter((entry) => entry.provider !== provider).length > 0;
}

/** Removes a provider link, refusing to strip the last way in. */
export async function unlinkProvider(userId: string, provider: string): Promise<void> {
  if (!(await canUnlinkProvider(userId, provider))) {
    throw AppError.validation(
      'That is the only way to sign in to this account. Set a password first.',
    );
  }

  const db = await getDb();
  await db
    .delete(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)));
}

/**
 * Stores a freshly-scoped provider token against the signed-in user.
 *
 * Separate from `signInWithProvider` because this is authorisation, not
 * authentication: the session already exists and must not be replaced. It also
 * refuses to attach a provider account that belongs to somebody else, which is
 * what stops one user's GitHub identity being bound to another user's Feedex
 * account by completing a consent screen at the right moment.
 */
export async function linkProviderToken(input: {
  userId: string;
  provider: string;
  profile: { providerAccountId: string; email: string };
  tokens: {
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date | null;
    scope: string | null;
  };
}): Promise<void> {
  const db = await getDb();

  const existing = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(
      and(
        eq(accounts.provider, input.provider),
        eq(accounts.providerAccountId, input.profile.providerAccountId),
      ),
    )
    .limit(1);

  if (existing[0] && existing[0].userId !== input.userId) {
    throw AppError.conflict(
      'That account is already connected to a different Feedex user. Sign out of it on the provider and try again.',
    );
  }

  await db
    .insert(accounts)
    .values({
      userId: input.userId,
      provider: input.provider,
      providerAccountId: input.profile.providerAccountId,
      accessToken: input.tokens.accessToken,
      refreshToken: input.tokens.refreshToken,
      expiresAt: input.tokens.expiresAt,
      scope: input.tokens.scope,
    })
    .onConflictDoUpdate({
      target: [accounts.provider, accounts.providerAccountId],
      set: {
        accessToken: input.tokens.accessToken,
        refreshToken: input.tokens.refreshToken,
        expiresAt: input.tokens.expiresAt,
        scope: input.tokens.scope,
      },
    });
}

/** The stored provider token for a user, or null if they have not connected. */
export async function getProviderToken(
  userId: string,
  provider: string,
): Promise<{ accessToken: string; scope: string | null } | null> {
  const db = await getDb();

  const rows = await db
    .select({ accessToken: accounts.accessToken, scope: accounts.scope })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)))
    .limit(1);

  const row = rows[0];
  if (!row?.accessToken) return null;

  return { accessToken: row.accessToken, scope: row.scope };
}
