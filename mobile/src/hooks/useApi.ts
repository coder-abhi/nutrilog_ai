import { useCallback } from "react";

import { useAuth } from "@/auth/AuthContext";
import { ApiError, apiFetch } from "@/utils/apiClient";

// Thrown after authedFetch has already triggered signOut() on a 401 — callers should
// treat this as "handled" (the user is being redirected to sign-in) and skip error UI.
export class SignedOutError extends Error {
  constructor() {
    super("Session expired.");
  }
}

type AuthedFetchOptions = RequestInit & { timeoutMs?: number; fallbackErrorMessage?: string };

export function useApi() {
  const { getAuthHeaders, signOut } = useAuth();

  const authedFetch = useCallback(
    async <T,>(path: string, options: AuthedFetchOptions = {}): Promise<T> => {
      try {
        return await apiFetch<T>(path, {
          ...options,
          headers: { ...getAuthHeaders(), ...options.headers },
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          await signOut();
          throw new SignedOutError();
        }
        throw err;
      }
    },
    [getAuthHeaders, signOut],
  );

  return { authedFetch };
}
