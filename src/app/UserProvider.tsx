"use client";

import { createContext, useContext, useEffect, useState } from "react";

const NAME_KEY = "wordflow:name";

const UserContext = createContext<{
  name: string | null;
  login: (name: string) => void;
  logout: () => void;
} | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    // localStorage only exists client-side, so this can't be a lazy useState initializer
    // without risking a hydration mismatch against the server-rendered logged-out state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(localStorage.getItem(NAME_KEY));
  }, []);

  function login(next: string) {
    const trimmed = next.trim();
    if (!trimmed) return;
    localStorage.setItem(NAME_KEY, trimmed);
    setName(trimmed);
  }

  function logout() {
    localStorage.removeItem(NAME_KEY);
    setName(null);
  }

  return <UserContext.Provider value={{ name, login, logout }}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
