import { API_BASE_URL } from "@/config/api";

const DEFAULT_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Render's free tier spins the backend down after idling and can take 30-60s+ to wake back up.
// Without a bound, a cold start looks identical to an infinite hang. Timing it out lets screens
// show a clear "still waking up, try again" state instead of a spinner that never resolves.
export class ApiTimeoutError extends Error {
  constructor() {
    super("The server is taking longer than expected to respond. Please try again.");
  }
}

type ApiFetchOptions = RequestInit & { timeoutMs?: number; fallbackErrorMessage?: string };

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, fallbackErrorMessage, ...init } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new ApiTimeoutError();
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data?.detail || fallbackErrorMessage || "Request failed.", res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
