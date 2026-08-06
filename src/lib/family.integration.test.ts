import { afterEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { familyMemberships, users } from "@/db/schema";
import { MAX_FAMILY_MEMBERS, joinFamily, previewInvite, removeFamilyMember, resolveEntitlement } from "./family";

// Integration test against the real dev DB (no separate test DB exists — see vitest.setup.ts).
// Only ever touches disposable rows it creates itself under a unique email suffix, cleaned up in
// afterEach; never reads or writes any real user's data.

const runId = Date.now();
let nextUserSuffix = 0;
const createdUserIds: string[] = [];

afterEach(async () => {
  if (createdUserIds.length > 0) {
    await db.delete(familyMemberships).where(inArray(familyMemberships.ownerUserId, createdUserIds));
    await db.delete(familyMemberships).where(inArray(familyMemberships.memberUserId, createdUserIds));
    await db.delete(users).where(inArray(users.id, createdUserIds));
    createdUserIds.length = 0;
  }
});

async function makeUser(overrides: Partial<typeof users.$inferInsert> = {}) {
  const [user] = await db
    .insert(users)
    .values({
      email: `test-family-${runId}-${nextUserSuffix++}@example.com`,
      name: "Test User",
      ...overrides,
    })
    .returning();
  createdUserIds.push(user.id);
  return user;
}

async function makeFamilyOwner() {
  return makeUser({ subscriptionStatus: "active", planType: "family", familyInviteToken: `token-${runId}-${nextUserSuffix}` });
}

describe("resolveEntitlement", () => {
  it("grants access to a member whose owner has an active family plan", async () => {
    const owner = await makeFamilyOwner();
    const member = await makeUser();
    await db.insert(familyMemberships).values({ ownerUserId: owner.id, memberUserId: member.id });

    const result = await resolveEntitlement(member);
    expect(result).toEqual({ hasAccess: true, viaFamilyOwnerId: owner.id });
  });

  it("denies access once the owner's subscription has lapsed", async () => {
    const owner = await makeFamilyOwner();
    await db.update(users).set({ subscriptionStatus: "canceled" }).where(eq(users.id, owner.id));
    const member = await makeUser();
    await db.insert(familyMemberships).values({ ownerUserId: owner.id, memberUserId: member.id });

    const result = await resolveEntitlement(member);
    expect(result).toEqual({ hasAccess: false, viaFamilyOwnerId: owner.id });
  });
});

describe("joinFamily / previewInvite / removeFamilyMember", () => {
  it("joins successfully, then removal frees the slot for someone else", async () => {
    const owner = await makeFamilyOwner();
    const memberA = await makeUser();

    const preview = await previewInvite(owner.familyInviteToken!, memberA.id);
    expect(preview).toEqual({ ok: true, ownerName: owner.name, slotsAvailable: MAX_FAMILY_MEMBERS });

    const joinResult = await joinFamily(memberA.id, owner.familyInviteToken!);
    expect(joinResult).toEqual({ ok: true });
    expect(await resolveEntitlement(memberA)).toEqual({ hasAccess: true, viaFamilyOwnerId: owner.id });

    const removed = await removeFamilyMember(owner.id, memberA.id);
    expect(removed).toBe(true);
    expect(await resolveEntitlement(memberA)).toEqual({ hasAccess: false, viaFamilyOwnerId: null });

    const memberB = await makeUser();
    const rejoin = await joinFamily(memberB.id, owner.familyInviteToken!);
    expect(rejoin).toEqual({ ok: true });
  });

  it("lets a member leave on their own", async () => {
    const owner = await makeFamilyOwner();
    const member = await makeUser();
    await joinFamily(member.id, owner.familyInviteToken!);

    const left = await removeFamilyMember(member.id, member.id);
    expect(left).toBe(true);
    expect(await resolveEntitlement(member)).toEqual({ hasAccess: false, viaFamilyOwnerId: null });
  });

  it("rejects removal by someone who is neither the owner nor the member themselves", async () => {
    const owner = await makeFamilyOwner();
    const member = await makeUser();
    const bystander = await makeUser();
    await joinFamily(member.id, owner.familyInviteToken!);

    const removed = await removeFamilyMember(bystander.id, member.id);
    expect(removed).toBe(false);
    expect(await resolveEntitlement(member)).toEqual({ hasAccess: true, viaFamilyOwnerId: owner.id });
  });

  it("rejects a second join by an already-joined member", async () => {
    const owner = await makeFamilyOwner();
    const member = await makeUser();
    await joinFamily(member.id, owner.familyInviteToken!);

    const secondAttempt = await joinFamily(member.id, owner.familyInviteToken!);
    expect(secondAttempt).toEqual({ ok: false, reason: "already_member" });
  });

  it("rejects the owner joining their own family", async () => {
    const owner = await makeFamilyOwner();
    const result = await joinFamily(owner.id, owner.familyInviteToken!);
    expect(result).toEqual({ ok: false, reason: "is_owner" });
  });

  it("rejects an unknown token", async () => {
    const someone = await makeUser();
    const result = await joinFamily(someone.id, `nonexistent-${runId}`);
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it(
    "rejects joining once the family is full",
    async () => {
      const owner = await makeFamilyOwner();
      for (let i = 0; i < MAX_FAMILY_MEMBERS; i++) {
        const member = await makeUser();
        await joinFamily(member.id, owner.familyInviteToken!);
      }

      const oneMore = await makeUser();
      const result = await joinFamily(oneMore.id, owner.familyInviteToken!);
      expect(result).toEqual({ ok: false, reason: "full" });
    },
    20000,
  );

  // The suite's first concurrent-write test — proves withFamilyLock actually serializes the
  // count-then-insert, not just that the sequential business logic is right. Without the
  // advisory lock, both concurrent calls could read count=3 (< MAX_FAMILY_MEMBERS=4) before
  // either insert lands, overfilling the family to 5 members instead of capping at 4.
  it(
    "only lets exactly one of two concurrent joins through when a single slot remains",
    async () => {
      const owner = await makeFamilyOwner();
      for (let i = 0; i < MAX_FAMILY_MEMBERS - 1; i++) {
        const member = await makeUser();
        await joinFamily(member.id, owner.familyInviteToken!);
      }

      const candidateA = await makeUser();
      const candidateB = await makeUser();
      const [resultA, resultB] = await Promise.all([
        joinFamily(candidateA.id, owner.familyInviteToken!),
        joinFamily(candidateB.id, owner.familyInviteToken!),
      ]);

      const results = [resultA, resultB];
      const succeeded = results.filter((r) => r.ok);
      const failed = results.filter((r) => !r.ok);
      expect(succeeded).toHaveLength(1);
      expect(failed).toEqual([{ ok: false, reason: "full" }]);

      const finalCount = await db.select().from(familyMemberships).where(eq(familyMemberships.ownerUserId, owner.id));
      expect(finalCount).toHaveLength(MAX_FAMILY_MEMBERS);
    },
    20000,
  );
});
