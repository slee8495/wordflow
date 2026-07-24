"use client";

import { useState } from "react";
import { useUiLanguage } from "./UiLanguageProvider";

// Rendered by Today/Reading in place of their content whenever the signed-in profile's `plan`
// isn't entitled (see UserProvider's `plan.hasAccess`) — mirrors AuthScreen's role for the signed-
// out case. The real enforcement is server-side (requireEntitledProfile() 402s); this is just a
// friendlier prompt than a raw fetch error.
export function PaywallScreen() {
  const { t } = useUiLanguage();
  const [starting, setStarting] = useState(false);

  async function startCheckout() {
    if (starting) return;
    setStarting(true);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setStarting(false);
      }
    } catch {
      setStarting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">{t("plan.paywallTitle")}</p>
      <p className="text-sm text-[var(--ink-soft)]">{t("plan.paywallHint")}</p>
      <button
        onClick={startCheckout}
        disabled={starting}
        className="rounded-lg bg-[var(--clay-deep)] px-3 py-2 text-sm font-medium text-[var(--paper-raised)] disabled:opacity-50"
      >
        {starting ? t("plan.startingCheckout") : t("plan.subscribeCta")}
      </button>
    </div>
  );
}
