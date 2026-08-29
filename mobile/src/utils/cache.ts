import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "cache_v1:";

// Best-effort last-known-good cache so screens can paint instantly on open instead of
// starting blank while the backend (which can be cold-starting) responds.
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function setCached<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // Cache writes are best-effort; a failure here shouldn't affect the live data flow.
  }
}

// Cache keys aren't namespaced by user, so switching accounts (sign out, sign in as someone
// else, sign up a new account) must wipe every cached response. Otherwise the next screen
// paints instantly with the *previous* account's trackers/summary/insulin data before the
// real fetch overwrites it - and any action taken against those stale ids (e.g. logging a
// tracker value) 404s because they belong to a different user.
export async function clearAllCached(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));
    if (cacheKeys.length) await AsyncStorage.multiRemove(cacheKeys);
  } catch {
    // Best-effort; a failure here shouldn't block sign-out/sign-in.
  }
}
