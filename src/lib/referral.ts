import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { referralGrants, users, type User } from "@/db/schema";
import { dateStringInTimezone, shiftDateString } from "@/lib/date";

// Advisory locks share one global keyspace with generateReading.ts's locks (1, 2) and
// family.ts's (3) — a distinct namespace here keeps a referrer's user id from ever colliding
// with an unrelated id from either of those.
const LOCK_NAMESPACE_REFERRAL = 4;

// Mirrors withFamilyLock in family.ts exactly — serializes any check-then-insert sequence for a
// given referrer's grant count, so two people redeeming the same link at once with 1 slot left
// can't both pass the "count < MAX" check before either row is inserted.
async function withReferralLock<T>(referrerUserId: string, fn: () => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_NAMESPACE_REFERRAL}, hashtext(${referrerUserId}))`);
    return fn();
  });
}

export const MAX_REFERRALS = 3;
export const REFERRAL_GRANT_DAYS = 14;

// Only an actual paying subscriber (individual or family owner — a real Stripe subscription,
// active or still in trial) can hand out gift trials; family members and comp-only users can't.
function isEligibleReferrer(user: User): boolean {
  return user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing";
}

// The gift is for people who have never subscribed before — stripeSubscriptionId is set the
// first time anyone ever completes Checkout and is never cleared afterward (even once canceled),
// so this also blocks a lapsed subscriber from re-entering through a referral link for a second
// free ride.
function isNewSignup(user: User): boolean {
  return user.stripeSubscriptionId === null;
}

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function getOrCreateReferralToken(referrerUserId: string): Promise<string> {
  const [existing] = await db
    .select({ referralToken: users.referralToken })
    .from(users)
    .where(eq(users.id, referrerUserId))
    .limit(1);
  if (existing?.referralToken) return existing.referralToken;

  const token = generateToken();
  await db.update(users).set({ referralToken: token }).where(eq(users.id, referrerUserId));
  return token;
}

export async function regenerateReferralToken(referrerUserId: string): Promise<string> {
  const token = generateToken();
  await db.update(users).set({ referralToken: token }).where(eq(users.id, referrerUserId));
  return token;
}

export type ReferralFailureReason = "not_found" | "full" | "already_redeemed" | "is_self" | "not_eligible";

async function findReferrerByToken(token: string): Promise<User | null> {
  const [referrer] = await db.select().from(users).where(eq(users.referralToken, token)).limit(1);
  return referrer ?? null;
}

async function countGrants(referrerUserId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(referralGrants)
    .where(eq(referralGrants.referrerUserId, referrerUserId));
  return row?.count ?? 0;
}

async function alreadyRedeemedBy(referredUserId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: referralGrants.id })
    .from(referralGrants)
    .where(eq(referralGrants.referredUserId, referredUserId))
    .limit(1);
  return Boolean(row);
}

export async function previewReferral(
  token: string,
  viewer: User,
): Promise<{ ok: true; referrerName: string | null; slotsAvailable: number } | { ok: false; reason: ReferralFailureReason }> {
  const referrer = await findReferrerByToken(token);
  if (!referrer || !isEligibleReferrer(referrer)) return { ok: false, reason: "not_found" };
  if (referrer.id === viewer.id) return { ok: false, reason: "is_self" };
  if (!isNewSignup(viewer)) return { ok: false, reason: "not_eligible" };
  if (await alreadyRedeemedBy(viewer.id)) return { ok: false, reason: "already_redeemed" };

  const count = await countGrants(referrer.id);
  if (count >= MAX_REFERRALS) return { ok: false, reason: "full" };

  return { ok: true, referrerName: referrer.name, slotsAvailable: MAX_REFERRALS - count };
}

// The actual race-guarded mutation — re-validates everything previewReferral already checked,
// inside the advisory lock, since state can change between a preview read and the accept tap.
// Grants REFERRAL_GRANT_DAYS via compFreeUntil (same mechanism as /api/admin/grant), taking the
// later of any existing compFreeUntil and the new date rather than blindly overwriting — low-
// probability edge case (an admin already granted this brand-new account some comp days), but
// costs nothing to not make anyone worse off.
export async function redeemReferral(
  referred: User,
  token: string,
): Promise<{ ok: true } | { ok: false; reason: ReferralFailureReason }> {
  const referrer = await findReferrerByToken(token);
  if (!referrer || !isEligibleReferrer(referrer)) return { ok: false, reason: "not_found" };
  if (referrer.id === referred.id) return { ok: false, reason: "is_self" };
  if (!isNewSignup(referred)) return { ok: false, reason: "not_eligible" };

  return withReferralLock(referrer.id, async () => {
    if (await alreadyRedeemedBy(referred.id)) return { ok: false, reason: "already_redeemed" };

    const count = await countGrants(referrer.id);
    if (count >= MAX_REFERRALS) return { ok: false, reason: "full" };

    const grantedUntil = shiftDateString(dateStringInTimezone("UTC"), REFERRAL_GRANT_DAYS);
    const compFreeUntil = referred.compFreeUntil && referred.compFreeUntil > grantedUntil ? referred.compFreeUntil : grantedUntil;

    await db.insert(referralGrants).values({ referrerUserId: referrer.id, referredUserId: referred.id });
    await db.update(users).set({ compFreeUntil }).where(eq(users.id, referred.id));

    return { ok: true };
  });
}
