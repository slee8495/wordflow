import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authErrorResponse, requireProfile } from "@/lib/authProfile";
import { stripe } from "@/lib/stripe";

// Starts a Stripe Checkout session for the $3.99/mo subscription with a 7-day trial. Deliberately
// uses requireProfile(), not requireEntitledProfile() — this is how someone *without* access gets
// it. client_reference_id carries our own user id so the webhook can find the right row directly,
// without relying on email matching.
export async function POST(req: NextRequest) {
  try {
    const profile = await requireProfile();
    const session = await auth();
    const email = session?.user?.email ?? undefined;

    const [user] = await db.select().from(users).where(eq(users.id, profile.userId!)).limit(1);
    if (!user) throw new Error("linked user row not found");

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, user.id));
    }

    const origin = req.nextUrl.origin;
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      subscription_data: { trial_period_days: 7 },
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
