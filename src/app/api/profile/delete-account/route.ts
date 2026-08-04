import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, users } from "@/db/schema";
import { authErrorResponse, requireProfile } from "@/lib/authProfile";
import { getStripe } from "@/lib/stripe";

// Permanently deletes the signed-in profile and its account. Cancels any live Stripe
// subscription first (so someone who deletes their account doesn't keep getting billed with
// no way back into Settings to stop it). Deleting the profile row cascades to readings,
// push_subscriptions, and deep_reading_logs; deleting the user row cascades to accounts/sessions
// — see src/db/schema.ts. Both are deleted explicitly rather than relying on profiles.userId's
// "set null" cascade, which would only unlink the profile and leave all its data behind.
export async function POST() {
  try {
    const profile = await requireProfile();
    const [user] = await db.select().from(users).where(eq(users.id, profile.userId!)).limit(1);

    if (user?.stripeSubscriptionId) {
      await getStripe()
        .subscriptions.cancel(user.stripeSubscriptionId)
        .catch(() => {
          // Already canceled or otherwise gone — proceed with deletion regardless.
        });
    }

    await db.delete(profiles).where(eq(profiles.id, profile.id));
    if (profile.userId) {
      await db.delete(users).where(eq(users.id, profile.userId));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to delete account", detail: message }, { status: 500 });
  }
}
