import React from 'react';

// Safe access to the host SDK. The host fills `window.__HS_SDK__` before any
// plugin renders, but the bundle can also run in tests and standalone
// previews, so every member is optional and has a fallback.

export function hostSdk(): NonNullable<Window['__HS_SDK__']> | undefined {
  return typeof window === 'undefined' ? undefined : window.__HS_SDK__;
}

export function hostLocale(): string {
  const fromHost = hostSdk()?.locale;
  if (fromHost) return fromHost;
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  return 'en-US';
}

export function hostTimezone(prop: string | undefined): string | undefined {
  if (prop) return prop;
  try {
    return hostSdk()?.getHostSettings?.().timezone || undefined;
  } catch {
    return undefined;
  }
}

type FetchHook = <T>(url: string, refreshMs: number) => [T | null, string | null, number | null];

/** Only used when the host SDK is missing (tests, standalone previews). */
const fallbackFetchHook: FetchHook = <T,>(url: string, refreshMs: number) => {
  const [state, setState] = React.useState<{ data: T | null; error: string | null; at: number | null }>({
    data: null,
    error: null,
    at: null,
  });
  React.useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as T;
        if (alive) setState({ data, error: null, at: Date.now() });
      } catch (err) {
        if (alive) setState((s) => ({ ...s, error: err instanceof Error ? err.message : String(err) }));
      }
    };
    void run();
    const id = setInterval(run, refreshMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [url, refreshMs]);
  return [state.data, state.error, state.at];
};

/**
 * The host's polling fetch for its own GET routes. It adds the display's
 * credentials, keeps the last good answer through a Wi-Fi blip, and shares
 * one request between modules. The implementation is chosen once per
 * component so the hook order can never change between renders.
 */
export function useHostFetch<T>(url: string, refreshMs: number): [T | null, string | null, number | null] {
  const impl = React.useRef<FetchHook | null>(null);
  if (!impl.current) impl.current = hostSdk()?.useFetchData ?? fallbackFetchHook;
  return impl.current<T>(url, refreshMs);
}

/** Writes to the host's own routes (ticking a chore). Same origin, JSON. */
export async function hostPost(url: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    });
    return res.ok;
  } catch {
    return false;
  }
}
