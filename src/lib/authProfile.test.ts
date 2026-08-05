import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, selectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  selectMock: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/db", () => ({ db: { select: selectMock } }));

// Chainable stub matching drizzle's db.select().from(...).where(...).limit(...) shape, resolving
// to whatever row array the test configures.
function queryReturning(rows: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(rows)),
  };
  return chain;
}

import { authErrorResponse, PaymentRequiredError, ProfileNotLinkedError, requireEntitledProfile, requireProfile, UnauthenticatedError } from "./authProfile";

describe("requireProfile", () => {
  beforeEach(() => {
    authMock.mockReset();
    selectMock.mockReset();
  });

  it("throws UnauthenticatedError when there's no session", async () => {
    authMock.mockResolvedValue(null);
    await expect(requireProfile()).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("throws ProfileNotLinkedError when the signed-in user has no linked profile", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    selectMock.mockReturnValue(queryReturning([]));
    await expect(requireProfile()).rejects.toBeInstanceOf(ProfileNotLinkedError);
  });

  it("returns the linked profile when one exists", async () => {
    const profile = { id: 42, userId: "user-1", name: "test" };
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    selectMock.mockReturnValue(queryReturning([profile]));
    await expect(requireProfile()).resolves.toEqual(profile);
  });
});

describe("requireEntitledProfile", () => {
  beforeEach(() => {
    authMock.mockReset();
    selectMock.mockReset();
  });

  it("throws PaymentRequiredError when the linked user has no active access", async () => {
    const profile = { id: 42, userId: "user-1", name: "test" };
    const user = { id: "user-1", compFreeForever: false, compFreeUntil: null, subscriptionStatus: "canceled" };
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    selectMock.mockReturnValueOnce(queryReturning([profile])).mockReturnValueOnce(queryReturning([user]));
    await expect(requireEntitledProfile()).rejects.toBeInstanceOf(PaymentRequiredError);
  });

  it("returns the profile when the linked user has active access", async () => {
    const profile = { id: 42, userId: "user-1", name: "test" };
    const user = { id: "user-1", compFreeForever: false, compFreeUntil: null, subscriptionStatus: "trialing" };
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    selectMock.mockReturnValueOnce(queryReturning([profile])).mockReturnValueOnce(queryReturning([user]));
    await expect(requireEntitledProfile()).resolves.toEqual(profile);
  });
});

describe("authErrorResponse", () => {
  it("maps each known error to its documented status code", async () => {
    expect((await authErrorResponse(new UnauthenticatedError())!.json()).error).toBe("unauthenticated");
    expect(authErrorResponse(new UnauthenticatedError())!.status).toBe(401);
    expect(authErrorResponse(new ProfileNotLinkedError())!.status).toBe(409);
    expect(authErrorResponse(new PaymentRequiredError())!.status).toBe(402);
  });

  it("returns null for unrelated errors, so callers fall through to a generic 500", () => {
    expect(authErrorResponse(new Error("boom"))).toBeNull();
  });
});
