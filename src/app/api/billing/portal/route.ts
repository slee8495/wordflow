import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authErrorResponse, requireProfile } from "@/lib/authProfile";
import { getStripe } from "@/lib/stripe";

// Opens Stripe's own hosted Billing Portal (cancel/upgrade/update card) for a profile that's
// already checked out at least once.
export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const profile = await requireProfile();
    const [user] = await db.select().from(users).where(eq(users.id, profile.userId!)).limit(1);
    if (!user?.stripeCustomerId) {
      return NextResponse.json({ error: "no_stripe_customer" }, { status: 400 });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${req.nextUrl.origin}/settings`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to open billing portal", detail: message }, { status: 500 });
  }
}
