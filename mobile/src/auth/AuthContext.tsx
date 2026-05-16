import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { API_BASE_URL } from "@/config/api";
import type { User } from "@/types";

const STORAGE_KEY = "daily_log_auth";

type SignUpPayload = User & {
  password: string;
};

type StoredAuth = {
  user: User;
  token: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (data: SignUpPayload) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  getAuthHeaders: () => Record<string, string>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function hydrate() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as StoredAuth;
          if (parsed?.user?.username && parsed?.token) {
            setUser(parsed.user);
            setToken(parsed.token);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    hydrate();
  }, []);

  const persistAuth = useCallback(async (nextUser: User, nextToken: string) => {
    setUser(nextUser);
    setToken(nextToken);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ user: nextUser, token: nextToken }));
  }, []);

  const signIn = useCallback(
    async (username: string, password: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/signin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.detail || "Sign in failed" };
        if (!data.access_token) return { success: false, error: "No token received" };
        await persistAuth(data.user as User, data.access_token as string);
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Network error" };
      }
    },
    [persistAuth],
  );

  const signUp = useCallback(
    async (payload: SignUpPayload) => {
      try {
        const res = await fetch(`${API_BASE_URL}/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.detail || "Sign up failed" };
        if (!data.access_token) return { success: false, error: "No token received" };
        await persistAuth(data.user as User, data.access_token as string);
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Network error" };
      }
    },
    [persistAuth],
  );

  const signOut = useCallback(async () => {
    setUser(null);
    setToken(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const getAuthHeaders = useCallback(
    (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token],
  );

  const value = useMemo(
    () => ({ user, token, loading, signIn, signUp, signOut, getAuthHeaders }),
    [user, token, loading, signIn, signUp, signOut, getAuthHeaders],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
