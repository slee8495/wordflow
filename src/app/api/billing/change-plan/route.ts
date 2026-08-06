import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authErrorResponse, requireProfile } from "@/lib/authProfile";
import { resolvePlanType } from "@/lib/family";
import { getStripe } from "@/lib/stripe";

// Upgrades/downgrades an existing active/trialing subscription between the individual and family
// prices, in place (same subscription id) with Stripe proration — the "가족 플랜으로 전환" action
// in Settings. Not routed through the Billing Portal: this account's portal configuration doesn't
// persist a switchable-products allowlist via the API in the installed Stripe API version, so the
// swap is done directly via the Subscriptions API instead. Writes the new state synchronously
// (not just waiting on the webhook) so the UI updates immediately; the webhook fires too and just
// redundantly re-confirms the same values.
export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const profile = await requireProfile();

    const body = await req.json().catch(() => null);
    const targetPlan = body?.plan === "family" ? "family" : body?.plan === "individual" ? "individual" : null;
    if (!targetPlan) return NextResponse.json({ error: "invalid_plan" }, { status: 400 });

    const [user] = await db.select().from(users).where(eq(users.id, profile.userId!)).limit(1);
    if (
      !user?.stripeSubscriptionId ||
      !(user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing")
    ) {
      return NextResponse.json({ error: "no_active_subscription" }, { status: 400 });
    }
    if (user.planType === targetPlan) {
      return NextResponse.json({ error: "already_on_plan" }, { status: 400 });
    }

    const newPriceId = targetPlan === "family" ? process.env.STRIPE_FAMILY_PRICE_ID! : process.env.STRIPE_PRICE_ID!;
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    const itemId = subscription.items.data[0].id;

    const updated = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: "create_prorations",
    });

    const planType = resolvePlanType(updated.items.data[0].price.id);
    await db
      .update(users)
      .set({
        subscriptionStatus: updated.status,
        currentPeriodEnd: new Date(updated.items.data[0].current_period_end * 1000),
        planType,
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({ ok: true, planType });
  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "failed to change plan", detail: message }, { status: 500 });
  }
}
