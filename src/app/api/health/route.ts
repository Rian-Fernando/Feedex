import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';

import { databaseDriver, getDb } from '@/lib/db';

/**
 * Liveness and readiness probe.
 *
 * Executes a trivial query so the check fails when the process is up but the
 * database is unreachable, which is the failure mode worth alerting on.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const startedAt = Date.now();

  try {
    const db = await getDb();
    await db.execute(sql`select 1`);

    return NextResponse.json({
      status: 'ok',
      driver: databaseDriver(),
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[feedex] health check failed', error);
    return NextResponse.json(
      { status: 'error', driver: databaseDriver(), timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
