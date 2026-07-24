import Stripe from "stripe";

// Lazily instantiated — constructing Stripe eagerly at module scope throws immediately if
// STRIPE_SECRET_KEY isn't set, which broke the production build (Next.js imports every route's
// modules during build-time page-data collection, before any request/env check ever runs).
// Deferring construction until a request actually needs it means the app still builds/deploys
// fine before Stripe credentials exist; only calling a billing route without them fails.
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (!cached) cached = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return cached;
}
