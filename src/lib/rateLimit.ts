import { sql } from "drizzle-orm";
import { db } from "@/db";
import { NextRequest } from "next/server";

// Fixed-window rate limiter backed by Postgres (see rate_limits in src/db/schema.ts) — this app's
// traffic is small enough that a single upserted row per key beats standing up Redis/Upstash for
// it. The window resets lazily: a request outside the current window resets the count to 1 rather
// than a background job sweeping expired windows.
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const rows = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limits.window_start < now() - (${windowSeconds} || ' seconds')::interval THEN 1
        ELSE rate_limits.count + 1
      END,
      window_start = CASE
        WHEN rate_limits.window_start < now() - (${windowSeconds} || ' seconds')::interval THEN now()
        ELSE rate_limits.window_start
      END
    RETURNING count
  `);
  const count = Number(rows[0]?.count ?? 0);
  return count <= limit;
}

// Vercel sets x-forwarded-for on every request; req.ip isn't populated in the App Router.
// Falls back to "unknown" (a shared bucket) rather than throwing — better to rate-limit
// conservatively than to let a missing header bypass the limiter entirely.
export function clientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
