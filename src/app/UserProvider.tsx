"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut, useSession } from "next-auth/react";

// "loading": session status still resolving, or (once signed in) still waiting on /api/profile/me.
// "signedOut": no Google session.
// "needsProfile": signed in, but this Google account has no linked profile yet — onboarding.
// "ready": signed in and linked to a profile; `name` is populated.
type AuthStatus = "loading" | "signedOut" | "needsProfile" | "ready";

export type PlanInfo = {
  hasAccess: boolean;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  compFreeForever: boolean;
  compFreeUntil: string | null;
};

type UserContextValue = {
  status: AuthStatus;
  // Non-null only when status === "ready" — mirrors the old pre-auth shape so most consumers
  // only need to check `name` the same way they always did.
  name: string | null;
  // Set in the same response/effect as `name`, so by the time `name !== null`, `plan` is
  // guaranteed already populated too — no loading-flash risk for paywall checks.
  plan: PlanInfo | null;
  signInWithGoogle: () => void;
  logout: () => void;
  // Onboarding action: claims an existing pre-auth profile by name, or creates a new one if that
  // name isn't taken. Throws on failure (e.g. "name_taken") so the caller can show an error.
  claimOrCreateProfile: (name: string) => Promise<void>;
  // Re-fetches /api/profile/me — used after redeeming a passphrase or returning from Stripe
  // Checkout/the Billing Portal, so `plan` reflects the change without a full page reload.
  refreshPlan: () => Promise<void>;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status: sessionStatus } = useSession();
  const [name, setName] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);

  const refreshPlan = useCallback(async () => {
    const res = await fetch("/api/profile/me");
    const data: { status: string; name?: string; plan?: PlanInfo } = await res.json();
    setName(data.status === "ready" ? (data.name ?? null) : null);
    setPlan(data.status === "ready" ? (data.plan ?? null) : null);
  }, []);

  useEffect(() => {
    if (sessionStatus !== "authenticated") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(null);
      setPlan(null);
      setProfileChecked(false);
      return;
    }
    let cancelled = false;
    fetch("/api/profile/me")
      .then((res) => res.json())
      .then((data: { status: string; name?: string; plan?: PlanInfo }) => {
        if (cancelled) return;
        setName(data.status === "ready" ? (data.name ?? null) : null);
        setPlan(data.status === "ready" ? (data.plan ?? null) : null);
        setProfileChecked(true);
      })
      .catch(() => {
        if (cancelled) return;
        setProfileChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionStatus]);

  const status: AuthStatus =
    sessionStatus === "loading"
      ? "loading"
      : sessionStatus === "unauthenticated"
        ? "signedOut"
        : !profileChecked
          ? "loading"
          : name
            ? "ready"
            : "needsProfile";

  const signInWithGoogle = useCallback(() => {
    nextAuthSignIn("google");
  }, []);

  const logout = useCallback(() => {
    setName(null);
    setPlan(null);
    setProfileChecked(false);
    nextAuthSignOut();
  }, []);

  const claimOrCreateProfile = useCallback(
    async (nextName: string) => {
      const trimmed = nextName.trim();
      if (!trimmed) return;
      const res = await fetch("/api/profile/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "claim_failed");
      }
      await refreshPlan();
    },
    [refreshPlan],
  );

  // session is only read for its authenticated-ness (via sessionStatus) above — kept out of the
  // context value since no consumer needs raw Google profile data, just the app's own `name`.
  void session;

  return (
    <UserContext.Provider value={{ status, name, plan, signInWithGoogle, logout, claimOrCreateProfile, refreshPlan }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
