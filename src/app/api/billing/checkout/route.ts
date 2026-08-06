import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authErrorResponse, requireProfile } from "@/lib/authProfile";
import { getStripe } from "@/lib/stripe";

const TRIAL_DAYS = 14;

// Starts a Stripe Checkout session for either the $3.99/mo individual plan or the $9.99/mo family
// plan (up to 5 people, see src/lib/family.ts), both with a 14-day trial. Deliberately uses
// requireProfile(), not requireEntitledProfile() — this is how someone *without* access gets it.
// client_reference_id carries our own user id so the webhook can find the right row directly,
// without relying on email matching.
export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const profile = await requireProfile();
    const session = await auth();
    const email = session?.user?.email ?? undefined;

    const body = await req.json().catch(() => null);
    const plan = body?.plan === "family" ? "family" : "individual";

    const [user] = await db.select().from(users).where(eq(users.id, profile.userId!)).limit(1);
    if (!user) throw new Error("linked user row not found");

    // A second Checkout Session on top of an existing active/trialing subscription would create a
    // second subscription on the same customer — double billing. Upgrading/downgrading between
    // plans goes through the Billing Portal's proration flow instead (see /api/billing/portal).
    if (user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing") {
      return NextResponse.json({ error: "already_subscribed" }, { status: 400 });
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, user.id));
    }

    const priceId = plan === "family" ? process.env.STRIPE_FAMILY_PRICE_ID! : process.env.STRIPE_PRICE_ID!;

    const origin = req.nextUrl.origin;
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      // metadata here is a Dashboard debugging aid only — planType is always re-derived from the
      // subscription's actual price id by the webhook, never trusted from checkout-time intent.
      subscription_data: { trial_period_days: TRIAL_DAYS, metadata: { plan } },
      client_reference_id: user.id,
      success_url: `${origin}/settings?billing=success`,
      cancel_url: `${origin}/settings?billing=cancelled`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to start checkout", detail: message }, { status: 500 });
  }
}
