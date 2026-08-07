"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthScreen } from "@/app/AuthScreen";
import { useUiLanguage } from "@/app/UiLanguageProvider";
import { useUser } from "@/app/UserProvider";
import { referralRedeemPrompt, type UiStringKey } from "@/lib/i18n";

type PreviewResult =
  | { ok: true; referrerName: string | null; slotsAvailable: number }
  | { ok: false; reason: "not_found" | "full" | "already_redeemed" | "is_self" | "not_eligible" };

// Shareable link a paying subscriber hands a friend (see Settings' "친구 초대" panel) — this is
// where it lands. Gated by the same useUser().status !== "ready" -> AuthScreen pattern used
// everywhere else, so someone who isn't signed in yet gets the normal sign-in/onboarding flow
// before ever seeing the accept screen (so the redeemer's own account exists before eligibility
// is checked).
export default function ReferralRedeemPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { status, refreshPlan } = useUser();
  const { uiLang, t } = useUiLanguage();
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<UiStringKey | null>(null);

  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;
    fetch(`/api/referral/invite/preview?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data: PreviewResult) => {
        if (!cancelled) setPreview(data);
      })
      .catch(() => {
        if (!cancelled) setPreview({ ok: false, reason: "not_found" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, token]);

  async function accept() {
    if (accepting) return;
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch("/api/referral/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        setError("referral.redeem.failed");
        setAccepting(false);
        return;
      }
      await refreshPlan();
      router.push("/settings");
    } catch {
      setError("referral.redeem.failed");
      setAccepting(false);
    }
  }

  if (status !== "ready") {
    return <AuthScreen />;
  }

  if (loading) {
    return <p className="text-sm text-[var(--ink-soft)]">{t("referral.redeem.loading")}</p>;
  }

  if (accepting) {
    return <p className="text-sm text-[var(--ink-soft)]">{t("referral.redeem.accepting")}</p>;
  }

  if (!preview || !preview.ok) {
    const reason = preview?.reason ?? "not_found";
    return <p className="text-sm text-[var(--ink)]">{t(`referral.redeem.reason.${reason}` as UiStringKey)}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg font-semibold text-[var(--ink)]">{referralRedeemPrompt(uiLang, preview.referrerName)}</p>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{t(error)}</p>}
      <button
        onClick={accept}
        disabled={accepting}
        className="w-fit rounded-lg bg-[var(--clay-deep)] px-4 py-2 text-sm font-medium text-[var(--paper-raised)] disabled:opacity-50"
      >
        {t("referral.redeem.acceptCta")}
      </button>
    </div>
  );
}
