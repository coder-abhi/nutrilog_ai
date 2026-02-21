"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "daily_log_user";

export type User = {
  username: string;
  weight_kg: number;
  target_weight_kg?: number | null;
  height_cm: number;
  gender: string;
  activity_level: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (data: {
    username: string;
    password: string;
    weight_kg: number;
    target_weight_kg: number;
    height_cm: number;
    gender: string;
    activity_level: string;
  }) => Promise<{ success: boolean; error?: string }>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as User;
        if (parsed?.username) setUser(parsed);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.detail || "Sign in failed" };
      }
      const u = data.user as User;
      setUser(u);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      return { success: false, error: message };
    }
  }, []);

  const signUp = useCallback(
    async (data: {
      username: string;
      password: string;
      weight_kg: number;
      height_cm: number;
      gender: string;
      activity_level: string;
    }) => {
      try {
        const res = await fetch(`${API_BASE}/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const out = await res.json();
        if (!res.ok) {
          return { success: false, error: out.detail || "Sign up failed" };
        }
        const u = out.user as User;
        setUser(u);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Network error";
        return { success: false, error: message };
      }
    },
    []
  );

  const signOut = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
