"use client";

import { SessionProvider } from "next-auth/react";

// Thin wrapper so layout.tsx (a server component) can still nest this above UserProvider without
// itself needing "use client" — next-auth's SessionProvider must be a client component.
export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
