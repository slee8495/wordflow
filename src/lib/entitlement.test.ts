import { describe, expect, it } from "vitest";
import { hasActiveAccess } from "./entitlement";

const base = { compFreeForever: false, compFreeUntil: null, subscriptionStatus: null };

describe("hasActiveAccess", () => {
  it("grants access when compFreeForever is set, regardless of subscription", () => {
    expect(hasActiveAccess({ ...base, compFreeForever: true, subscriptionStatus: "canceled" })).toBe(true);
  });

  it("grants access when compFreeUntil is today or in the future", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(hasActiveAccess({ ...base, compFreeUntil: today })).toBe(true);

    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
    expect(hasActiveAccess({ ...base, compFreeUntil: future })).toBe(true);
  });

  it("denies access once compFreeUntil is in the past", () => {
    const yesterday = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString().slice(0, 10);
    expect(hasActiveAccess({ ...base, compFreeUntil: yesterday })).toBe(false);
  });

  it("grants access for trialing or active Stripe subscriptions", () => {
    expect(hasActiveAccess({ ...base, subscriptionStatus: "trialing" })).toBe(true);
    expect(hasActiveAccess({ ...base, subscriptionStatus: "active" })).toBe(true);
  });

  it("denies access for lapsed/canceled/past_due subscriptions with no comp grant", () => {
    expect(hasActiveAccess({ ...base, subscriptionStatus: "canceled" })).toBe(false);
    expect(hasActiveAccess({ ...base, subscriptionStatus: "past_due" })).toBe(false);
    expect(hasActiveAccess(base)).toBe(false);
  });

  it("comp grant wins even when the Stripe subscription has lapsed", () => {
    expect(hasActiveAccess({ ...base, compFreeForever: true, subscriptionStatus: "past_due" })).toBe(true);
  });
});
