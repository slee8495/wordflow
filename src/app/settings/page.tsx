"use client";

import { useEffect, useState } from "react";
import { DEFAULT_NOTIFICATION_HOUR } from "@/lib/date";
import { FONT_SCALES } from "@/lib/fontScale";
import { fontScaleLabelKey, loggedInAs, type UiStringKey } from "@/lib/i18n";
import { disableNotifications, enableNotifications, pushSupported, updateNotificationHour } from "@/lib/pushNotifications";
import { COMMON_TIMEZONES } from "@/lib/timezones";
import { useFontScale } from "../FontScaleProvider";
import { useTimezone } from "../TimezoneProvider";
import { useUiLanguage } from "../UiLanguageProvider";
import { useUser } from "../UserProvider";

function formatHourLabel(hour: number, lang: "ko" | "en"): string {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", { hour: "numeric", minute: "2-digit" }).format(d);
}

export default function SettingsPage() {
  const { scale, setScale } = useFontScale();
  const { name, login, logout } = useUser();
  const { uiLang, setUiLang, t } = useUiLanguage();
  const { timezone, setTimezone } = useTimezone();
  const [nameInput, setNameInput] = useState("");
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [notificationHour, setNotificationHour] = useState(DEFAULT_NOTIFICATION_HOUR);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const [notificationsError, setNotificationsError] = useState<UiStringKey | null>(null);

  useEffect(() => {
    if (!name) return;
    fetch(`/api/notifications/status?name=${encodeURIComponent(name)}`)
      .then((res) => res.json())
      .then(({ enabled, notificationHour: hour }) => {
        setNotificationsOn(Boolean(enabled));
        if (typeof hour === "number") setNotificationHour(hour);
      })
      .catch(() => {});
  }, [name]);

  async function toggleNotifications() {
    if (!name || notificationsBusy) return;
    setNotificationsBusy(true);
    setNotificationsError(null);
    try {
      if (notificationsOn) {
        await disableNotifications(name);
        setNotificationsOn(false);
      } else {
        if (!pushSupported()) {
          setNotificationsError("settings.notificationsUnsupported");
          return;
        }
        const result = await enableNotifications(name, uiLang, timezone, notificationHour);
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
    if (name && notificationsOn) await updateNotificationHour(name, hour);
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
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!nameInput.trim()) return;
              login(nameInput);
              setNameInput("");
            }}
          >
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={t("login.namePlaceholder")}
              className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[var(--clay)]"
            />
            <button
              type="submit"
              className="rounded-lg bg-[var(--clay-deep)] px-3 py-1.5 text-sm font-medium text-[var(--paper-raised)]"
            >
              {t("login.submit")}
            </button>
          </form>
        )}
        <p className="text-sm text-[var(--ink-soft)]">{t("settings.nameHint")}</p>
      </section>

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
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                notificationsOn ? "bg-[var(--clay-deep)]" : "bg-[var(--clay-tint)]"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--paper-raised)] shadow transition-transform ${
                  notificationsOn ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
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
    </div>
  );
}
