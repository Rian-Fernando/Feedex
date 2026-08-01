import 'server-only';

import { eq, sql } from 'drizzle-orm';

import { getDb, type Database } from '@/lib/db';
import { users, type User } from '@/lib/db/schema';
import { createId, ID_PREFIX } from '@/lib/ids';
import { AppError } from '@/lib/errors';
import { fakeVerify, hashPassword, verifyPassword } from '@/lib/auth/password';
import type { RegisterInput } from '@/lib/validation';
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
