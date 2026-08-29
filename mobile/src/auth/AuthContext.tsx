import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { User } from "@/types";
import { apiFetch } from "@/utils/apiClient";

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
  updateProfile: (data: Omit<User, "username">) => Promise<{ success: boolean; error?: string }>;
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
      } catch {
        await AsyncStorage.removeItem(STORAGE_KEY);
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
        const data = await apiFetch<{ user: User; access_token?: string }>("/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
          fallbackErrorMessage: "Sign in failed",
        });
        if (!data.access_token) return { success: false, error: "No token received" };
        await persistAuth(data.user, data.access_token);
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
        const data = await apiFetch<{ user: User; access_token?: string }>("/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          fallbackErrorMessage: "Sign up failed",
        });
        if (!data.access_token) return { success: false, error: "No token received" };
        await persistAuth(data.user, data.access_token);
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Network error" };
      }
    },
    [persistAuth],
  );

  const updateProfile = useCallback(
    async (payload: Omit<User, "username">) => {
      if (!token) return { success: false, error: "You are not signed in." };
      try {
        const data = await apiFetch<{ user: User }>("/profile", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
          fallbackErrorMessage: "Profile update failed",
        });
        await persistAuth(data.user, token);
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Network error" };
      }
    },
    [persistAuth, token],
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
    () => ({ user, token, loading, signIn, signUp, updateProfile, signOut, getAuthHeaders }),
    [user, token, loading, signIn, signUp, updateProfile, signOut, getAuthHeaders],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
