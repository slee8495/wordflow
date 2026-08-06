import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { db } from "@/db";
import { users } from "@/db/schema";
import { resolvePlanType } from "@/lib/family";
import { getStripe } from "@/lib/stripe";

// Keeps `users.stripeCustomerId/stripeSubscriptionId/subscriptionStatus/currentPeriodEnd` in sync
// with Stripe's own source of truth. App Router route handlers don't auto-parse the body, so
// req.text() here is genuinely the raw payload Stripe's signature was computed over.
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "invalid signature", detail: message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (userId && customerId && subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await db
          .update(users)
          .set({
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            subscriptionStatus: subscription.status,
            currentPeriodEnd: new Date(subscription.items.data[0].current_period_end * 1000),
            planType: resolvePlanType(subscription.items.data[0].price.id),
          })
          .where(eq(users.id, userId));
      }
      break;
    }
    case "customer.subscription.updated": {
      // Stripe doesn't guarantee webhook delivery order, and a Billing Portal proration upgrade
      // fires several events in quick succession — re-fetching current state (rather than trusting
      // this specific event's embedded snapshot) means a stale/out-of-order event can't land after
      // a newer one and briefly write back an old price/status.
      const eventSubscription = event.data.object as Stripe.Subscription;
      const subscription = await stripe.subscriptions.retrieve(eventSubscription.id);
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      await db
        .update(users)
        .set({
          subscriptionStatus: subscription.status,
          currentPeriodEnd: new Date(subscription.items.data[0].current_period_end * 1000),
          planType: resolvePlanType(subscription.items.data[0].price.id),
        })
        .where(eq(users.stripeCustomerId, customerId));
      break;
    }
    case "customer.subscription.deleted": {
      // status: "canceled" here is unambiguous and terminal — no re-fetch needed the way
      // .updated needs one above.
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      await db
        .update(users)
        .set({
          subscriptionStatus: subscription.status,
          currentPeriodEnd: new Date(subscription.items.data[0].current_period_end * 1000),
        })
        .where(eq(users.stripeCustomerId, customerId));
      break;
    }
  }

  return NextResponse.json({ received: true });
}
