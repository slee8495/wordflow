import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { constructEventMock, retrieveSubscriptionMock, updateMock, setMock, whereMock } = vi.hoisted(() => {
  const whereMock = vi.fn(() => Promise.resolve());
  const setMock = vi.fn(() => ({ where: whereMock }));
  const updateMock = vi.fn(() => ({ set: setMock }));
  return {
    constructEventMock: vi.fn(),
    retrieveSubscriptionMock: vi.fn(),
    updateMock,
    setMock,
    whereMock,
  };
});

vi.mock("@/db", () => ({ db: { update: updateMock } }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: { constructEvent: constructEventMock },
    subscriptions: { retrieve: retrieveSubscriptionMock },
  }),
}));

import { POST } from "./route";

function makeRequest(body: string) {
  return new NextRequest("https://wordflow-jade.vercel.app/api/billing/webhook", {
    method: "POST",
    body,
    headers: { "stripe-signature": "test-sig" },
  });
}

describe("billing webhook", () => {
  beforeEach(() => {
    constructEventMock.mockReset();
    retrieveSubscriptionMock.mockReset();
    updateMock.mockClear();
    setMock.mockClear();
    whereMock.mockClear();
  });

  it("rejects a request with an invalid signature", async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("checkout.session.completed writes customer/subscription/status/period-end/planType", async () => {
    constructEventMock.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          client_reference_id: "user-1",
          customer: "cus_123",
          subscription: "sub_123",
        },
      },
    });
    retrieveSubscriptionMock.mockResolvedValue({
      status: "trialing",
      items: { data: [{ current_period_end: 1_700_000_000, price: { id: "price_unrecognized" } }] },
    });

    const res = await POST(makeRequest("{}"));

    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(setMock).toHaveBeenCalledWith({
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      subscriptionStatus: "trialing",
      currentPeriodEnd: new Date(1_700_000_000 * 1000),
      planType: null, // "price_unrecognized" doesn't match STRIPE_PRICE_ID or STRIPE_FAMILY_PRICE_ID
    });
  });

  it("customer.subscription.updated re-fetches current state and syncs by stripeCustomerId, not user id", async () => {
    // The route re-fetches via stripe.subscriptions.retrieve() rather than trusting this event's
    // embedded snapshot (Stripe doesn't guarantee delivery order) — only `id` from the event is
    // actually used, the written fields come from the mocked retrieve() response below.
    constructEventMock.mockReturnValue({
      type: "customer.subscription.updated",
      data: { object: { id: "sub_456" } },
    });
    retrieveSubscriptionMock.mockResolvedValue({
      customer: "cus_456",
      status: "active",
      items: { data: [{ current_period_end: 1_800_000_000, price: { id: "price_unrecognized" } }] },
    });

    const res = await POST(makeRequest("{}"));

    expect(res.status).toBe(200);
    expect(retrieveSubscriptionMock).toHaveBeenCalledWith("sub_456");
    expect(setMock).toHaveBeenCalledWith({
      subscriptionStatus: "active",
      currentPeriodEnd: new Date(1_800_000_000 * 1000),
      planType: null,
    });
  });

  it("customer.subscription.deleted syncs the canceled status the same way", async () => {
    constructEventMock.mockReturnValue({
      type: "customer.subscription.deleted",
      data: {
        object: {
          customer: "cus_456",
          status: "canceled",
          items: { data: [{ current_period_end: 1_800_000_000 }] },
        },
      },
    });

    const res = await POST(makeRequest("{}"));

    expect(res.status).toBe(200);
    expect(setMock).toHaveBeenCalledWith({
      subscriptionStatus: "canceled",
      currentPeriodEnd: new Date(1_800_000_000 * 1000),
    });
  });

  it("ignores event types it doesn't handle, without touching the DB", async () => {
    constructEventMock.mockReturnValue({ type: "invoice.paid", data: { object: {} } });
    const res = await POST(makeRequest("{}"));
    expect(res.status).toBe(200);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
