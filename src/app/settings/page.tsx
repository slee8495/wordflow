"use client";

import { useEffect, useState } from "react";
import { DEFAULT_NOTIFICATION_HOUR } from "@/lib/date";
import { FONT_SCALES } from "@/lib/fontScale";
import {
  familyMemberOfLabel,
  familySlotsLabel,
  fontScaleLabelKey,
  loggedInAs,
  referralSlotsLabel,
  type UiStringKey,
} from "@/lib/i18n";
import { disableNotifications, enableNotifications, pushSupported, updateNotificationHour } from "@/lib/pushNotifications";
import { COMMON_TIMEZONES } from "@/lib/timezones";
import { AuthScreen } from "../AuthScreen";
import { useFontScale } from "../FontScaleProvider";
import { useTimezone } from "../TimezoneProvider";
import { useUiLanguage } from "../UiLanguageProvider";
import { useUser } from "../UserProvider";

function formatPlanDate(iso: string, lang: "ko" | "en"): string {
  return new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function formatHourLabel(hour: number, lang: "ko" | "en"): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", { hour: "numeric", minute: "2-digit" }).format(d);
}

export default function SettingsPage() {
  const { scale, setScale } = useFontScale();
  const { name, plan, logout, refreshPlan } = useUser();
  const { uiLang, setUiLang, t } = useUiLanguage();
  const { timezone, setTimezone } = useTimezone();
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [notificationHour, setNotificationHour] = useState(DEFAULT_NOTIFICATION_HOUR);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const [notificationsError, setNotificationsError] = useState<UiStringKey | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [passphraseBusy, setPassphraseBusy] = useState(false);
  const [passphraseError, setPassphraseError] = useState<UiStringKey | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<UiStringKey | null>(null);
  const [familyInfo, setFamilyInfo] = useState<{
    inviteUrl: string;
    members: { id: string; name: string | null; joinedAt: string }[];
    slotsUsed: number;
    slotsTotal: number;
  } | null>(null);
  const [familyBusy, setFamilyBusy] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [referralInfo, setReferralInfo] = useState<{ inviteUrl: string; slotsUsed: number; slotsTotal: number } | null>(
    null,
  );
  const [referralBusy, setReferralBusy] = useState(false);
  const [referralLinkCopied, setReferralLinkCopied] = useState(false);

  async function deleteAccount() {
    if (deleteBusy) return;
    if (!window.confirm(t("settings.deleteAccountConfirm"))) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/profile/delete-account", { method: "POST" });
      if (!res.ok) throw new Error("delete failed");
      logout();
    } catch {
      setDeleteError("settings.deleteAccountFailed");
      setDeleteBusy(false);
    }
  }

  useEffect(() => {
    if (!name) return;
    fetch("/api/notifications/status")
      .then((res) => res.json())
      .then(({ enabled, notificationHour: hour }) => {
        setNotificationsOn(Boolean(enabled));
        if (typeof hour === "number") setNotificationHour(hour);
      })
      .catch(() => {});
  }, [name]);

  const isFamilyMember = Boolean(plan?.viaFamilyOwnerId);
  const isFamilyOwner = plan?.planType === "family" && plan?.hasAccess && !isFamilyMember;
  const isIndividualSubscriber = plan?.hasAccess && plan?.planType === "individual" && !isFamilyMember;

  useEffect(() => {
    if (!isFamilyOwner) {
      setFamilyInfo(null);
      return;
    }
    fetch("/api/family/invite")
      .then((res) => res.json())
      .then((data) => {
        if (data.inviteUrl) setFamilyInfo(data);
      })
      .catch(() => {});
  }, [isFamilyOwner]);

  // Only an actual paying subscriber (individual or family owner — a real Stripe subscription,
  // active or still trialing) can hand out referral gift trials; family members and comp-only
  // users can't (see isEligibleReferrer in src/lib/referral.ts, mirrored here for the UI gate).
  const isEligibleReferrer = plan?.subscriptionStatus === "active" || plan?.subscriptionStatus === "trialing";

  useEffect(() => {
    if (!isEligibleReferrer) {
      setReferralInfo(null);
      return;
    }
    fetch("/api/referral/invite")
      .then((res) => res.json())
      .then((data) => {
        if (data.inviteUrl) setReferralInfo(data);
      })
      .catch(() => {});
  }, [isEligibleReferrer]);

  async function toggleNotifications() {
    if (!name || notificationsBusy) return;
    setNotificationsBusy(true);
    setNotificationsError(null);
    try {
      if (notificationsOn) {
        await disableNotifications();
        setNotificationsOn(false);
      } else {
        if (!pushSupported()) {
          setNotificationsError("settings.notificationsUnsupported");
          return;
        }
        const result = await enableNotifications(uiLang, timezone, notificationHour);
        if (result.ok) {
          setNotificationsOn(true);
        } else if (result.error === "permission-denied") {
          setNotificationsError("settings.notificationsDenied");
        } else {
          setNotificationsError("settings.notificationsUnsupported");
        }
      }
    } finally {
      setNotificationsBusy(false);
    }
  }

  async function changeNotificationHour(hour: number) {
    setNotificationHour(hour);
    if (name && notificationsOn) await updateNotificationHour(hour);
  }

  async function startCheckout(checkoutPlan: "individual" | "family") {
    if (planBusy) return;
    setPlanBusy(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: checkoutPlan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setPlanBusy(false);
    } catch {
      setPlanBusy(false);
    }
  }

  async function openBillingPortal() {
    if (planBusy) return;
    setPlanBusy(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setPlanBusy(false);
    } catch {
      setPlanBusy(false);
    }
  }

  async function convertToFamily() {
    if (planBusy) return;
    setPlanBusy(true);
    try {
      const res = await fetch("/api/billing/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "family" }),
      });
      if (res.ok) await refreshPlan();
    } finally {
      setPlanBusy(false);
    }
  }

  async function copyInviteLink() {
    if (!familyInfo) return;
    await navigator.clipboard.writeText(familyInfo.inviteUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function regenerateInviteLink() {
    if (familyBusy) return;
    setFamilyBusy(true);
    try {
      const res = await fetch("/api/family/invite/regenerate", { method: "POST" });
      if (res.ok) {
        const refreshed = await fetch("/api/family/invite");
        if (refreshed.ok) setFamilyInfo(await refreshed.json());
      }
    } finally {
      setFamilyBusy(false);
    }
  }

  async function removeFamilyMember(memberUserId: string) {
    if (familyBusy) return;
    setFamilyBusy(true);
    try {
      const res = await fetch("/api/family/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberUserId }),
      });
      if (res.ok) {
        const refreshed = await fetch("/api/family/invite");
        if (refreshed.ok) setFamilyInfo(await refreshed.json());
      }
    } finally {
      setFamilyBusy(false);
    }
  }

  async function leaveFamilyPlan() {
    if (familyBusy) return;
    setFamilyBusy(true);
    try {
      // No memberUserId in the body — the route defaults to removing the caller's own membership.
      await fetch("/api/family/remove", { method: "POST" });
    } finally {
      setFamilyBusy(false);
      await refreshPlan();
    }
  }

  async function copyReferralLink() {
    if (!referralInfo) return;
    await navigator.clipboard.writeText(referralInfo.inviteUrl);
    setReferralLinkCopied(true);
    setTimeout(() => setReferralLinkCopied(false), 2000);
  }

  async function regenerateReferralLink() {
    if (referralBusy) return;
    setReferralBusy(true);
    try {
      const res = await fetch("/api/referral/invite/regenerate", { method: "POST" });
      if (res.ok) {
        const refreshed = await fetch("/api/referral/invite");
        if (refreshed.ok) setReferralInfo(await refreshed.json());
      }
    } finally {
      setReferralBusy(false);
    }
  }

  async function submitPassphrase(e: React.FormEvent) {
    e.preventDefault();
    if (!passphrase.trim() || passphraseBusy) return;
    setPassphraseBusy(true);
    setPassphraseError(null);
    try {
      const res = await fetch("/api/billing/redeem-passphrase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      if (!res.ok) {
        setPassphraseError("plan.passphraseInvalid");
        return;
      }
      setPassphrase("");
      await refreshPlan();
    } finally {
      setPassphraseBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-[var(--ink)]">{t("settings.title")}</h1>

      <section className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-4">
        <h2 className="text-sm font-semibold text-[var(--ink-soft)]">{t("settings.account")}</h2>
        {name ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--ink)]">{loggedInAs(uiLang, name)}</p>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)] hover:border-[var(--clay)] hover:text-[var(--ink)]"
            >
              {t("settings.logout")}
            </button>
          </div>
        ) : (
          <AuthScreen />
        )}
        <p className="text-sm text-[var(--ink-soft)]">{t("settings.nameHint")}</p>
        {name && (
          <>
            <button
              type="button"
              onClick={deleteAccount}
              disabled={deleteBusy}
              className="w-fit text-xs text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
            >
              {t("settings.deleteAccount")}
            </button>
            {deleteError && <p className="text-sm text-red-600 dark:text-red-400">{t(deleteError)}</p>}
          </>
        )}
      </section>

      {name && (
        <section className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-4">
          <h2 className="text-sm font-semibold text-[var(--ink-soft)]">{t("plan.title")}</h2>
          {plan?.compFreeForever ? (
            <p className="text-sm text-[var(--ink)]">{t("plan.freeFamily")}</p>
          ) : isFamilyMember ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-[var(--ink)]">{familyMemberOfLabel(uiLang, plan?.familyOwnerName ?? null)}</p>
              {!plan?.hasAccess && <p className="text-sm text-[var(--ink-soft)]">{t("family.inactiveOwnerHint")}</p>}
              <button
                type="button"
                onClick={leaveFamilyPlan}
                disabled={familyBusy}
                className="w-fit rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)] hover:border-[var(--clay)] hover:text-[var(--ink)] disabled:opacity-50"
              >
                {t("family.leaveButton")}
              </button>
            </div>
          ) : isFamilyOwner ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--ink)]">{t("family.ownerTitle")}</p>
                <button
                  type="button"
                  onClick={openBillingPortal}
                  disabled={planBusy}
                  className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)] hover:border-[var(--clay)] hover:text-[var(--ink)] disabled:opacity-50"
                >
                  {t("plan.manageBilling")}
                </button>
              </div>
              {familyInfo && (
                <>
                  <p className="text-xs text-[var(--ink-soft)]">
                    {familySlotsLabel(uiLang, familyInfo.slotsUsed, familyInfo.slotsTotal)}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={familyInfo.inviteUrl}
                      className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-transparent px-3 py-1.5 text-xs outline-none"
                    />
                    <button
                      type="button"
                      onClick={copyInviteLink}
                      className="shrink-0 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)] hover:border-[var(--clay)] hover:text-[var(--ink)]"
                    >
                      {linkCopied ? t("family.linkCopied") : t("family.copyLink")}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={regenerateInviteLink}
                    disabled={familyBusy}
                    className="w-fit text-xs text-[var(--ink-soft)] hover:underline disabled:opacity-50"
                  >
                    {t("family.regenerateLink")}
                  </button>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium text-[var(--ink-soft)]">{t("family.membersHeading")}</p>
                    {familyInfo.members.length === 0 ? (
                      <p className="text-sm text-[var(--ink-soft)]">{t("family.noMembersYet")}</p>
                    ) : (
                      familyInfo.members.map((member) => (
                        <div key={member.id} className="flex items-center justify-between">
                          <span className="text-sm text-[var(--ink)]">{member.name ?? member.id}</span>
                          <button
                            type="button"
                            onClick={() => removeFamilyMember(member.id)}
                            disabled={familyBusy}
                            className="text-xs text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                          >
                            {t("family.removeMember")}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          ) : plan?.hasAccess ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--ink)]">
                  {plan.subscriptionStatus === "trialing"
                    ? plan.currentPeriodEnd
                      ? `${t("plan.trialEndsOn")} ${formatPlanDate(plan.currentPeriodEnd, uiLang)}`
                      : t("plan.trialActive")
                    : plan.currentPeriodEnd
                      ? `${t("plan.renewsOn")} ${formatPlanDate(plan.currentPeriodEnd, uiLang)}`
                      : t("plan.active")}
                </p>
                <button
                  type="button"
                  onClick={openBillingPortal}
                  disabled={planBusy}
                  className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)] hover:border-[var(--clay)] hover:text-[var(--ink)] disabled:opacity-50"
                >
                  {t("plan.manageBilling")}
                </button>
              </div>
              {isIndividualSubscriber && (
                <button
                  type="button"
                  onClick={convertToFamily}
                  disabled={planBusy}
                  className="w-fit text-xs text-[var(--ink-soft)] hover:underline disabled:opacity-50"
                >
                  {t("plan.convertToFamily")}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-[var(--ink-soft)]">{t("plan.expiredHint")}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => startCheckout("individual")}
                  disabled={planBusy}
                  className="w-fit rounded-lg bg-[var(--clay-deep)] px-3 py-2 text-sm font-medium text-[var(--paper-raised)] disabled:opacity-50"
                >
                  {t("plan.subscribeCta")}
                </button>
                <button
                  type="button"
                  onClick={() => startCheckout("family")}
                  disabled={planBusy}
                  className="w-fit rounded-lg border border-[var(--line)] px-3 py-2 text-sm font-medium text-[var(--ink-soft)] hover:border-[var(--clay)] hover:text-[var(--ink)] disabled:opacity-50"
                >
                  {t("plan.subscribeFamilyCta")}
                </button>
              </div>
            </div>
          )}

          {!plan?.compFreeForever && !isFamilyMember && (
            <form onSubmit={submitPassphrase} className="flex items-center gap-2">
              <input
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder={t("plan.passphrasePlaceholder")}
                className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[var(--clay)]"
              />
              <button
                type="submit"
                disabled={passphraseBusy}
                className="shrink-0 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)] hover:border-[var(--clay)] hover:text-[var(--ink)] disabled:opacity-50"
              >
                {t("plan.passphraseSubmit")}
              </button>
            </form>
          )}
          {passphraseError && <p className="text-sm text-red-600 dark:text-red-400">{t(passphraseError)}</p>}
        </section>
      )}

      {isEligibleReferrer && referralInfo && (
        <section className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-4">
          <h2 className="text-sm font-semibold text-[var(--ink-soft)]">{t("referral.title")}</h2>
          <p className="text-sm text-[var(--ink-soft)]">{t("referral.inviteHint")}</p>
          <p className="text-xs text-[var(--ink-soft)]">
            {referralSlotsLabel(uiLang, referralInfo.slotsUsed, referralInfo.slotsTotal)}
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={referralInfo.inviteUrl}
              className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-transparent px-3 py-1.5 text-xs outline-none"
            />
            <button
              type="button"
              onClick={copyReferralLink}
              className="shrink-0 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)] hover:border-[var(--clay)] hover:text-[var(--ink)]"
            >
              {referralLinkCopied ? t("family.linkCopied") : t("family.copyLink")}
            </button>
          </div>
          <button
            type="button"
            onClick={regenerateReferralLink}
            disabled={referralBusy}
            className="w-fit text-xs text-[var(--ink-soft)] hover:underline disabled:opacity-50"
          >
            {t("family.regenerateLink")}
          </button>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-4">
        <h2 className="text-sm font-semibold text-[var(--ink-soft)]">{t("settings.uiLanguage")}</h2>
        <div className="flex gap-1 rounded-full bg-[var(--clay-tint)] p-0.5 text-xs w-fit">
          <button
            type="button"
            onClick={() => setUiLang("ko")}
            className={`rounded-full px-3 py-1.5 font-medium ${
              uiLang === "ko" ? "bg-[var(--paper-raised)] text-[var(--ink)] shadow-sm" : "text-[var(--ink-soft)]"
            }`}
          >
            한국어
          </button>
          <button
            type="button"
            onClick={() => setUiLang("en")}
            className={`rounded-full px-3 py-1.5 font-medium ${
              uiLang === "en" ? "bg-[var(--paper-raised)] text-[var(--ink)] shadow-sm" : "text-[var(--ink-soft)]"
            }`}
          >
            English
          </button>
        </div>
        <p className="text-sm text-[var(--ink-soft)]">{t("settings.uiLanguageHint")}</p>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-4">
        <h2 className="text-sm font-semibold text-[var(--ink-soft)]">{t("settings.timezone")}</h2>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-fit rounded-lg border border-[var(--line)] bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[var(--clay)]"
        >
          {!COMMON_TIMEZONES.some((z) => z.value === timezone) && (
            <option value={timezone}>{timezone}</option>
          )}
          {COMMON_TIMEZONES.map((z) => (
            <option key={z.value} value={z.value}>
              {z.label}
            </option>
          ))}
        </select>
        <p className="text-sm text-[var(--ink-soft)]">{t("settings.timezoneHint")}</p>
      </section>

      {name && (
        <section className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--ink-soft)]">{t("settings.morningReminder")}</h2>
            <button
              type="button"
              role="switch"
              aria-checked={notificationsOn}
              onClick={toggleNotifications}
              disabled={notificationsBusy}
              className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50 ${
                notificationsOn ? "justify-end bg-[var(--clay-deep)]" : "justify-start bg-[var(--clay-tint)]"
              }`}
            >
              <span className="h-5 w-5 rounded-full bg-[var(--paper-raised)] shadow" />
            </button>
          </div>
          {notificationsOn && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--ink)]">{t("settings.notificationHour")}</span>
              <select
                value={notificationHour}
                onChange={(e) => changeNotificationHour(Number(e.target.value))}
                className="rounded-lg border border-[var(--line)] bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[var(--clay)]"
              >
                {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                  <option key={h} value={h}>
                    {formatHourLabel(h, uiLang)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="text-sm text-[var(--ink-soft)]">{t("settings.morningReminderHint")}</p>
          {notificationsError && <p className="text-sm text-red-600 dark:text-red-400">{t(notificationsError)}</p>}
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-4">
        <h2 className="text-sm font-semibold text-[var(--ink-soft)]">{t("settings.fontSize")}</h2>
        <div className="grid grid-cols-3 gap-2">
          {FONT_SCALES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setScale(option.value)}
              aria-pressed={scale === option.value}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition-colors ${
                scale === option.value
                  ? "border-[var(--clay-deep)] bg-[var(--clay-tint)] text-[var(--clay-deep)]"
                  : "border-[var(--line)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              <span style={{ fontSize: `${option.value}rem` }}>Aa</span>
              <span className="text-xs">{t(fontScaleLabelKey(option.value))}</span>
            </button>
          ))}
        </div>
        <p className="text-sm text-[var(--ink-soft)]">{t("settings.fontSizeHint")}</p>
      </section>

      <div className="flex justify-center gap-4 text-xs text-[var(--ink-soft)]">
        <a href="/privacy" className="hover:underline">
          Privacy Policy
        </a>
        <a href="/terms" className="hover:underline">
          Terms of Service
        </a>
      </div>
    </div>
  );
}
