import { afterEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { referralGrants, users } from "@/db/schema";
import { MAX_REFERRALS, previewReferral, redeemReferral } from "./referral";

// Integration test against the real dev DB (no separate test DB exists — see vitest.setup.ts).
// Only ever touches disposable rows it creates itself under a unique email suffix, cleaned up in
// afterEach; never reads or writes any real user's data.

const runId = Date.now();
let nextUserSuffix = 0;
const createdUserIds: string[] = [];

afterEach(async () => {
  if (createdUserIds.length > 0) {
    await db.delete(referralGrants).where(inArray(referralGrants.referrerUserId, createdUserIds));
    await db.delete(referralGrants).where(inArray(referralGrants.referredUserId, createdUserIds));
    await db.delete(users).where(inArray(users.id, createdUserIds));
    createdUserIds.length = 0;
  }
});

async function makeUser(overrides: Partial<typeof users.$inferInsert> = {}) {
  const [user] = await db
    .insert(users)
    .values({
      email: `test-referral-${runId}-${nextUserSuffix++}@example.com`,
      name: "Test User",
      ...overrides,
    })
    .returning();
  createdUserIds.push(user.id);
  return user;
}

async function makeEligibleReferrer() {
  return makeUser({
    subscriptionStatus: "active",
    stripeSubscriptionId: `sub_${runId}_${nextUserSuffix}`,
    referralToken: `token-${runId}-${nextUserSuffix}`,
  });
}

async function makeNewSignup() {
  return makeUser(); // stripeSubscriptionId defaults to null
}

describe("previewReferral / redeemReferral", () => {
  it("grants 14 days of comp access to a new signup and counts against the referrer's cap", async () => {
    const referrer = await makeEligibleReferrer();
    const newcomer = await makeNewSignup();

    const preview = await previewReferral(referrer.referralToken!, newcomer);
    expect(preview).toEqual({ ok: true, referrerName: referrer.name, slotsAvailable: MAX_REFERRALS });

    const result = await redeemReferral(newcomer, referrer.referralToken!);
    expect(result).toEqual({ ok: true });

    const [updated] = await db.select().from(users).where(eq(users.id, newcomer.id)).limit(1);
    expect(updated.compFreeUntil).not.toBeNull();
    const daysFromNow = (new Date(updated.compFreeUntil!).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(daysFromNow).toBeGreaterThan(12.5); // ~14 days, allowing for test execution time
    expect(daysFromNow).toBeLessThan(15);
  });

  it("rejects a referrer trying to redeem their own link", async () => {
    const referrer = await makeEligibleReferrer();
    const result = await redeemReferral(referrer, referrer.referralToken!);
    expect(result).toEqual({ ok: false, reason: "is_self" });
  });

  it("rejects someone who has already subscribed before, even if currently lapsed", async () => {
    const referrer = await makeEligibleReferrer();
    const lapsedSubscriber = await makeUser({ stripeSubscriptionId: `sub_${runId}_lapsed`, subscriptionStatus: "canceled" });

    const preview = await previewReferral(referrer.referralToken!, lapsedSubscriber);
    expect(preview).toEqual({ ok: false, reason: "not_eligible" });

    const result = await redeemReferral(lapsedSubscriber, referrer.referralToken!);
    expect(result).toEqual({ ok: false, reason: "not_eligible" });
  });

  it("rejects redeeming a second time", async () => {
    const referrer = await makeEligibleReferrer();
    const newcomer = await makeNewSignup();
    await redeemReferral(newcomer, referrer.referralToken!);

    const secondAttempt = await redeemReferral(newcomer, referrer.referralToken!);
    expect(secondAttempt).toEqual({ ok: false, reason: "already_redeemed" });
  });

  it("rejects a token from a referrer who is no longer an active/trialing subscriber", async () => {
    const lapsedReferrer = await makeUser({
      subscriptionStatus: "canceled",
      stripeSubscriptionId: `sub_${runId}_lapsed_referrer`,
      referralToken: `token-${runId}-${nextUserSuffix}`,
    });
    const newcomer = await makeNewSignup();

    const result = await redeemReferral(newcomer, lapsedReferrer.referralToken!);
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it(
    "rejects redemption once the referrer has hit the cap",
    async () => {
      const referrer = await makeEligibleReferrer();
      for (let i = 0; i < MAX_REFERRALS; i++) {
        const newcomer = await makeNewSignup();
        await redeemReferral(newcomer, referrer.referralToken!);
      }

      const oneMore = await makeNewSignup();
      const result = await redeemReferral(oneMore, referrer.referralToken!);
      expect(result).toEqual({ ok: false, reason: "full" });
    },
    20000,
  );

  // Proves withReferralLock actually serializes the count-then-insert, not just that the
  // sequential business logic is right — same shape of test as family.integration.test.ts's race
  // test, against a separate advisory-lock namespace.
  it(
    "only lets exactly one of two concurrent redemptions through when a single slot remains",
    async () => {
      const referrer = await makeEligibleReferrer();
      for (let i = 0; i < MAX_REFERRALS - 1; i++) {
        const newcomer = await makeNewSignup();
        await redeemReferral(newcomer, referrer.referralToken!);
      }

      const candidateA = await makeNewSignup();
      const candidateB = await makeNewSignup();
      const [resultA, resultB] = await Promise.all([
        redeemReferral(candidateA, referrer.referralToken!),
        redeemReferral(candidateB, referrer.referralToken!),
      ]);

      const results = [resultA, resultB];
      const succeeded = results.filter((r) => r.ok);
      const failed = results.filter((r) => !r.ok);
      expect(succeeded).toHaveLength(1);
      expect(failed).toEqual([{ ok: false, reason: "full" }]);

      const finalCount = await db.select().from(referralGrants).where(eq(referralGrants.referrerUserId, referrer.id));
      expect(finalCount).toHaveLength(MAX_REFERRALS);
    },
    20000,
  );
});
