import { dateStringInTimezone } from "@/lib/date";

export type EntitlementFields = {
  compFreeForever: boolean;
  compFreeUntil: string | null;
  subscriptionStatus: string | null;
};

// Whether a user currently has access to the paid parts of the app (Today's daily reading,
// Reading's book/chapter browser). Comp access (family passphrase / admin-granted) always wins
// over Stripe status, so a lapsed subscription never revokes a comp grant. subscriptionStatus is
// never computed here — it's a straight mirror of Stripe's own status, written only by
// /api/billing/webhook.
export function hasActiveAccess(user: EntitlementFields): boolean {
  if (user.compFreeForever) return true;
  if (user.compFreeUntil && user.compFreeUntil >= dateStringInTimezone("UTC")) return true;
  return user.subscriptionStatus === "trialing" || user.subscriptionStatus === "active";
}
