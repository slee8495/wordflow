import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveEntitlementDecision, resolvePlanType } from "./family";

const solo = { compFreeForever: false, compFreeUntil: null, subscriptionStatus: null };
const activeOwner = { compFreeForever: false, compFreeUntil: null, subscriptionStatus: "active", planType: "family" };

describe("resolvePlanType", () => {
  const originalIndividual = process.env.STRIPE_PRICE_ID;
  const originalFamily = process.env.STRIPE_FAMILY_PRICE_ID;

  beforeEach(() => {
    process.env.STRIPE_PRICE_ID = "price_individual_test";
    process.env.STRIPE_FAMILY_PRICE_ID = "price_family_test";
  });

  afterEach(() => {
    process.env.STRIPE_PRICE_ID = originalIndividual;
    process.env.STRIPE_FAMILY_PRICE_ID = originalFamily;
  });

  it("maps the individual and family price ids to their plan type", () => {
    expect(resolvePlanType("price_individual_test")).toBe("individual");
    expect(resolvePlanType("price_family_test")).toBe("family");
  });

  it("returns null for a price id that matches neither (future promo, manual dashboard change, etc.)", () => {
    expect(resolvePlanType("price_something_else")).toBeNull();
  });

  it("returns null for a null price id", () => {
    expect(resolvePlanType(null)).toBeNull();
  });
});

describe("resolveEntitlementDecision", () => {
  it("grants access via the user's own subscription, regardless of any membership", () => {
    const user = { ...solo, subscriptionStatus: "active" };
    const result = resolveEntitlementDecision(user, { ownerUserId: "owner-1" }, activeOwner);
    expect(result).toEqual({ hasAccess: true, viaFamilyOwnerId: null });
  });

  it("denies access for a solo user with no membership and no active subscription", () => {
    const result = resolveEntitlementDecision(solo, null, null);
    expect(result).toEqual({ hasAccess: false, viaFamilyOwnerId: null });
  });

  it("grants access to a member whose owner is on an active family plan", () => {
    const result = resolveEntitlementDecision(solo, { ownerUserId: "owner-1" }, activeOwner);
    expect(result).toEqual({ hasAccess: true, viaFamilyOwnerId: "owner-1" });
  });

  it("denies access to a member whose owner's subscription has lapsed", () => {
    const lapsedOwner = { ...activeOwner, subscriptionStatus: "canceled" };
    const result = resolveEntitlementDecision(solo, { ownerUserId: "owner-1" }, lapsedOwner);
    expect(result).toEqual({ hasAccess: false, viaFamilyOwnerId: "owner-1" });
  });

  it("denies access to a member whose owner downgraded to individual, even though the owner's subscription is still active", () => {
    const downgradedOwner = { ...activeOwner, planType: "individual" };
    const result = resolveEntitlementDecision(solo, { ownerUserId: "owner-1" }, downgradedOwner);
    expect(result).toEqual({ hasAccess: false, viaFamilyOwnerId: "owner-1" });
  });

  it("grants access to a member whose owner has permanent comp access instead of a paid family subscription", () => {
    const compOwner = { compFreeForever: true, compFreeUntil: null, subscriptionStatus: null, planType: "family" };
    const result = resolveEntitlementDecision(solo, { ownerUserId: "owner-1" }, compOwner);
    expect(result).toEqual({ hasAccess: true, viaFamilyOwnerId: "owner-1" });
  });

  it("denies access when the membership row exists but the owner can't be found", () => {
    const result = resolveEntitlementDecision(solo, { ownerUserId: "owner-1" }, null);
    expect(result).toEqual({ hasAccess: false, viaFamilyOwnerId: "owner-1" });
  });
});
