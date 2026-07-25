import type { ReadingBookmark, TodayBookmark } from "@/app/UserProvider";

// Fire-and-forget persistence for "resume where you left off" — best-effort only, so a failed
// save (offline, request race, etc.) should never surface an error to the listener.
export function saveBookmark(kind: "reading", bookmark: ReadingBookmark): void;
export function saveBookmark(kind: "today", bookmark: TodayBookmark): void;
export function saveBookmark(kind: "reading" | "today", bookmark: ReadingBookmark | TodayBookmark): void {
  fetch("/api/profile/bookmark", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, bookmark }),
  }).catch(() => {});
}
