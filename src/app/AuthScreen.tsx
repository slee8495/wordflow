"use client";

import { useState } from "react";
import { useUiLanguage } from "./UiLanguageProvider";
import { useUser } from "./UserProvider";

// Rendered by every page in place of its content whenever useUser().status !== "ready" — Today,
// Reading, and Settings all used to duplicate their own plain-name login form; now they all just
// render this, which itself branches on status (loading / signed out / needs onboarding).
export function AuthScreen() {
  const { status, signInWithGoogle, claimOrCreateProfile } = useUser();
  const { t } = useUiLanguage();
  const [nameInput, setNameInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "loading") {
    return <p className="text-sm text-[var(--ink-soft)]">{t("login.loading")}</p>;
  }

  if (status === "signedOut") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-[var(--ink-soft)]">{t("login.prompt")}</p>
        <button
          onClick={signInWithGoogle}
          className="rounded-lg bg-[var(--clay-deep)] px-3 py-2 text-sm font-medium text-[var(--paper-raised)]"
        >
          {t("login.signInWithGoogle")}
        </button>
      </div>
    );
  }

  // status === "needsProfile"
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!nameInput.trim() || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
          await claimOrCreateProfile(nameInput);
        } catch (err) {
          setError(err instanceof Error && err.message === "name_taken" ? "login.claimNameTaken" : "login.claimFailed");
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <p className="text-sm font-medium">{t("login.claimTitle")}</p>
      <p className="text-sm text-[var(--ink-soft)]">{t("login.claimHint")}</p>
      <input
        value={nameInput}
        onChange={(e) => setNameInput(e.target.value)}
        placeholder={t("login.namePlaceholder")}
        className="rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--clay)]"
      />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{t(error as Parameters<typeof t>[0])}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-[var(--clay-deep)] px-3 py-2 text-sm font-medium text-[var(--paper-raised)] disabled:opacity-50"
      >
        {t("login.claimSubmit")}
      </button>
    </form>
  );
}
