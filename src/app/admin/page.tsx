"use client";

import { useEffect, useState } from "react";

type AdminUserRow = {
  userId: string;
  email: string | null;
  profileName: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  compFreeForever: boolean;
  compFreeUntil: string | null;
};

// Personal-use-only screen for the app operator: lists every signed-up account and lets them
// grant comp access (e.g. "1 year free"). Not localized, not linked from AppNav — reachable only
// by knowing the URL, and requireAdmin() (checked server-side on every API call this page makes)
// is the real gate.
export default function AdminPage() {
  const [rows, setRows] = useState<AdminUserRow[] | null>(null);
  const [authorized, setAuthorized] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/users")
      .then((res) => {
        if (res.status === 403) {
          setAuthorized(false);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setRows(data.users);
      });
  }

  useEffect(() => {
    load();
  }, []);

  async function grant(userId: string, days: number) {
    setBusyUserId(userId);
    try {
      await fetch("/api/admin/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, days }),
      });
      load();
    } finally {
      setBusyUserId(null);
    }
  }

  if (!authorized) {
    return <p style={{ padding: 24 }}>Not authorized.</p>;
  }

  if (!rows) {
    return <p style={{ padding: 24 }}>Loading…</p>;
  }

  return (
    <div style={{ padding: 24, fontFamily: "monospace", fontSize: 13 }}>
      <h1 style={{ fontSize: 18, marginBottom: 16 }}>Wordflow admin</h1>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th style={{ padding: "4px 8px" }}>Email</th>
            <th style={{ padding: "4px 8px" }}>Profile</th>
            <th style={{ padding: "4px 8px" }}>Sub status</th>
            <th style={{ padding: "4px 8px" }}>Period end</th>
            <th style={{ padding: "4px 8px" }}>Free forever</th>
            <th style={{ padding: "4px 8px" }}>Comp until</th>
            <th style={{ padding: "4px 8px" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.userId} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "4px 8px" }}>{row.email}</td>
              <td style={{ padding: "4px 8px" }}>{row.profileName}</td>
              <td style={{ padding: "4px 8px" }}>{row.subscriptionStatus ?? "—"}</td>
              <td style={{ padding: "4px 8px" }}>
                {row.currentPeriodEnd ? new Date(row.currentPeriodEnd).toLocaleDateString() : "—"}
              </td>
              <td style={{ padding: "4px 8px" }}>{row.compFreeForever ? "yes" : "no"}</td>
              <td style={{ padding: "4px 8px" }}>{row.compFreeUntil ?? "—"}</td>
              <td style={{ padding: "4px 8px" }}>
                <button
                  onClick={() => grant(row.userId, 365)}
                  disabled={busyUserId === row.userId}
                  style={{ cursor: "pointer" }}
                >
                  Grant 1 year free
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
