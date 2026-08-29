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
