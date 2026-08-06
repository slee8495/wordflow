import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { familyMemberships, users, type User } from "@/db/schema";
import { hasActiveAccess, type EntitlementFields } from "@/lib/entitlement";

// Advisory locks share one global keyspace with generateReading.ts's own locks (namespaces 1 and
// 2 there) — a distinct namespace here keeps a family owner's user id from ever colliding with an
// unrelated profile/curriculum-item id.
const LOCK_NAMESPACE_FAMILY = 3;

// Serializes any check-then-insert sequence for a given owner's family behind a Postgres
// transaction-scoped advisory lock. Without this, two people redeeming the same invite link at
// the same instant, with exactly one slot left, could both pass the "count < MAX" check before
// either row is inserted, overfilling the family — the same race class as generateReading.ts's
// withProfileLock/withCurriculumItemLock, which this mirrors exactly. ownerUserId is a text UUID,
// so it's folded into the int4 the two-arg pg_advisory_xact_lock overload expects via hashtext().
async function withFamilyLock<T>(ownerUserId: string, fn: () => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_NAMESPACE_FAMILY}, hashtext(${ownerUserId}))`);
    return fn();
  });
}

export const MAX_FAMILY_MEMBERS = 4; // + 1 owner = 5 total

// Always derived fresh from the live Stripe price id, never trusted from Checkout-time intent —
// self-healing if a subscription is ever modified outside the app's own Checkout flow. Returns
// null for an unrecognized price (a future promo, a manual Dashboard change) rather than guessing.
export function resolvePlanType(priceId: string | null): "individual" | "family" | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_ID) return "individual";
  if (priceId === process.env.STRIPE_FAMILY_PRICE_ID) return "family";
  return null;
}

export type EntitlementResolution = { hasAccess: boolean; viaFamilyOwnerId: string | null };

// PURE — no DB access, so it's unit-testable with plain object fixtures (see entitlement.test.ts's
// style). Checked in this order: a user's own access always wins; otherwise a family member only
// inherits access while their owner's plan is CURRENTLY "family" AND currently active — an owner
// who downgrades to individual (still subscriptionStatus "active", just paying for one seat) must
// stop covering former members immediately, not keep funding them because they're still "active".
export function resolveEntitlementDecision(
  user: EntitlementFields,
  membership: { ownerUserId: string } | null,
  owner: (EntitlementFields & { planType: string | null }) | null,
): EntitlementResolution {
  if (hasActiveAccess(user)) return { hasAccess: true, viaFamilyOwnerId: null };
  if (membership && owner && owner.planType === "family" && hasActiveAccess(owner)) {
    return { hasAccess: true, viaFamilyOwnerId: membership.ownerUserId };
  }
  return { hasAccess: false, viaFamilyOwnerId: membership?.ownerUserId ?? null };
}

// Thin DB wrapper around resolveEntitlementDecision — used by requireEntitledProfile and
// /api/profile/me. Nothing here is cached: a membership row and the owner's current billing state
// are re-read on every call, so access starts/stops exactly when the owner's subscription does.
export async function resolveEntitlement(user: User): Promise<EntitlementResolution> {
  const [membership] = await db
    .select({ ownerUserId: familyMemberships.ownerUserId })
    .from(familyMemberships)
    .where(eq(familyMemberships.memberUserId, user.id))
    .limit(1);

  if (!membership) return resolveEntitlementDecision(user, null, null);

  const [owner] = await db.select().from(users).where(eq(users.id, membership.ownerUserId)).limit(1);
  return resolveEntitlementDecision(user, membership, owner ?? null);
}

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

// Lazily creates the owner's invite link on first request rather than at signup/checkout time —
// most subscribers never open the family-invite UI at all.
export async function getOrCreateInviteToken(ownerUserId: string): Promise<string> {
  const [existing] = await db
    .select({ familyInviteToken: users.familyInviteToken })
    .from(users)
    .where(eq(users.id, ownerUserId))
    .limit(1);
  if (existing?.familyInviteToken) return existing.familyInviteToken;

  const token = generateToken();
  await db.update(users).set({ familyInviteToken: token }).where(eq(users.id, ownerUserId));
  return token;
}

// Invalidates the previous link — the only way to close off a leaked/screenshotted invite, since
// the token itself is persistent and reusable by design (see joinFamily's "slots are reusable"
// behavior) rather than single-use/expiring.
export async function regenerateInviteToken(ownerUserId: string): Promise<string> {
  const token = generateToken();
  await db.update(users).set({ familyInviteToken: token }).where(eq(users.id, ownerUserId));
  return token;
}

export type InviteFailureReason = "not_found" | "full" | "already_member" | "is_owner";

async function findOwnerByToken(token: string): Promise<User | null> {
  const [owner] = await db.select().from(users).where(eq(users.familyInviteToken, token)).limit(1);
  return owner ?? null;
}

async function countMembers(ownerUserId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(familyMemberships)
    .where(eq(familyMemberships.ownerUserId, ownerUserId));
  return row?.count ?? 0;
}

async function existingMembershipFor(memberUserId: string) {
  const [membership] = await db
    .select({ ownerUserId: familyMemberships.ownerUserId })
    .from(familyMemberships)
    .where(eq(familyMemberships.memberUserId, memberUserId))
    .limit(1);
  return membership ?? null;
}

// Read-only check before the join page commits to anything — lets the UI show a real owner name
// ("OO님의 가족 플랜에 참여하시겠어요?") or a specific reason it can't proceed, instead of a bare
// error only surfacing after the user taps accept.
export async function previewInvite(
  token: string,
  viewerUserId: string,
): Promise<{ ok: true; ownerName: string | null; slotsAvailable: number } | { ok: false; reason: InviteFailureReason }> {
  const owner = await findOwnerByToken(token);
  if (!owner) return { ok: false, reason: "not_found" };
  if (owner.id === viewerUserId) return { ok: false, reason: "is_owner" };
  if (await existingMembershipFor(viewerUserId)) return { ok: false, reason: "already_member" };

  const count = await countMembers(owner.id);
  if (count >= MAX_FAMILY_MEMBERS) return { ok: false, reason: "full" };

  return { ok: true, ownerName: owner.name, slotsAvailable: MAX_FAMILY_MEMBERS - count };
}

// The actual race-guarded mutation — re-validates everything previewInvite already checked, but
// inside the advisory lock, since state can change between a preview read and the accept tap.
export async function joinFamily(
  memberUserId: string,
  token: string,
): Promise<{ ok: true } | { ok: false; reason: InviteFailureReason }> {
  const owner = await findOwnerByToken(token);
  if (!owner) return { ok: false, reason: "not_found" };
  if (owner.id === memberUserId) return { ok: false, reason: "is_owner" };

  return withFamilyLock(owner.id, async () => {
    if (await existingMembershipFor(memberUserId)) return { ok: false, reason: "already_member" };

    const count = await countMembers(owner.id);
    if (count >= MAX_FAMILY_MEMBERS) return { ok: false, reason: "full" };

    await db.insert(familyMemberships).values({ ownerUserId: owner.id, memberUserId });
    return { ok: true };
  });
}

// Owner removing one of their members, or a member removing themselves ("leave") — one endpoint,
// authorized either way. No lock needed: deleting a row is safe unconditionally, unlike the
// capacity-checked insert above.
export async function removeFamilyMember(actingUserId: string, targetUserId: string): Promise<boolean> {
  const membership = await existingMembershipFor(targetUserId);
  if (!membership) return false;
  if (membership.ownerUserId !== actingUserId && targetUserId !== actingUserId) return false;

  await db.delete(familyMemberships).where(eq(familyMemberships.memberUserId, targetUserId));
  return true;
}
