// A stand-in for the Home Screens display page, for testing this plugin in a
// real browser without a real hub. It does what the host's plugin loader does
// (React as globals, an SDK object, the bundle run as an inline script, the
// component read from window.__HS_PLUGIN__) and answers /api/* from synthetic
// data. It is NOT the real host: see README "What has and has not been tested".

import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import * as ReactDOMAll from 'react-dom';
import { FAMILY, PEOPLE, sampleChores, sampleEvents, TZ } from './fixtures';

const q = new URLSearchParams(location.search);
const TODAY = q.get('today') || '2026-11-02';

// ── Globals the host provides ────────────────────────────────────────────────
const w = window as unknown as Record<string, unknown>;
w.React = React;
w.ReactDOM = ReactDOMAll;

// ── Stand-in /api/* routes ───────────────────────────────────────────────────
const calls: { method: string; url: string; body?: unknown }[] = [];
w.__calls = calls;
const choreState = sampleChores('some');
choreState.date = TODAY;

const realFetch = window.fetch.bind(window);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (!url.pathname.startsWith('/api/')) return realFetch(input, init);
  const method = init?.method ?? 'GET';
  calls.push({ method, url: url.pathname + url.search, body: init?.body ? JSON.parse(String(init.body)) : undefined });
  await new Promise((r) => setTimeout(r, Number(q.get('latency') || 40)));
  if (q.get('fail') === '1') return json({ error: 'down' }, 500);

  if (url.pathname === '/api/calendar') {
    if (q.get('setup') === '1') return json({ error: 'No calendars configured.' }, 400);
    const min = Date.parse(url.searchParams.get('timeMin') || '');
    const max = Date.parse(url.searchParams.get('timeMax') || '');
    const events = sampleEvents(TODAY).filter((e) => {
      const s = Date.parse(e.allDay ? `${e.start}T00:00:00Z` : e.start);
      const en = Date.parse(e.allDay ? `${e.end}T00:00:00Z` : e.end);
      return en > min && s < max;
    });
    const sourceStatus = q.get('sourcebad') === '1' ? [{ id: 'g-mia', name: "Mia's calendar", ok: false, error: 'x' }] : [];
    return json({ events, sourceStatus });
  }
  if (url.pathname === '/api/chores/today') return json(choreState);
  if (url.pathname === '/api/family') return json(FAMILY);
  if (url.pathname === '/api/chores' && method === 'POST') {
    if (q.get('postfail') === '1') return json({ error: 'nope' }, 500);
    const body = JSON.parse(String(init?.body));
    const member = choreState.members.find((m) => m.id === body.memberId);
    const chore = member?.chores.find((c) => c.id === body.choreId);
    if (chore) chore.completed = body.direction === 'complete';
    return json({ changed: true });
  }
  return json({ error: 'not found' }, 404);
};

// ── The SDK object, shaped like the host's ───────────────────────────────────
function useFetchData<T>(url: string, refreshMs: number): [T | null, string | null, number | null] {
  const [state, setState] = React.useState<{ url: string; data: T | null; error: string | null; at: number | null }>({
    url,
    data: null,
    error: null,
    at: null,
  });
  // Like the host: a different URL is a different dataset, so the old payload is dropped.
  const current = state.url === url ? state : { url, data: null, error: null, at: null };
  React.useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const res = await window.fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as T;
        if (alive) setState({ url, data, error: null, at: Date.now() });
      } catch (err) {
        if (alive) setState((s) => ({ url, data: s.url === url ? s.data : null, error: String(err), at: s.at }));
      }
    };
    void run();
    const id = setInterval(run, refreshMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [url, refreshMs]);
  return [current.data, current.error, current.at];
}

w.__HS_SDK__ = {
  locale: q.get('locale') || 'en-US',
  getHostSettings: () => ({ timezone: TZ, units: 'imperial', latitude: 41.9, longitude: -87.6, displayWidth: 1920, displayHeight: 1080, appVersion: '1.15.0' }),
  useFetchData,
};

// ── Load the built bundle the way the host does ──────────────────────────────
async function main() {
  const code = await (await realFetch('/bundle.js')).text();
  const script = document.createElement('script');
  script.textContent = code;
  document.head.appendChild(script);
  const Component = (w.__HS_PLUGIN__ as { default: React.ComponentType<Record<string, unknown>> }).default;

  const manifest = await (await realFetch('/manifest.json')).json();
  const dark = q.get('bg') === 'dark';
  const config: Record<string, unknown> = { ...manifest.defaultConfig };
  for (const [key, value] of q.entries()) {
    if (key.startsWith('cfg.')) {
      const k = key.slice(4);
      config[k] = value === 'true' ? true : value === 'false' ? false : /^-?\d+$/.test(value) ? Number(value) : value;
    }
  }
  const style = {
    ...manifest.defaultStyle,
    fontFamily: 'inter',
    opacity: 1,
    backdropBlur: 0,
    ...(q.get('fontSize') ? { fontSize: Number(q.get('fontSize')) } : {}),
    ...(dark ? { backgroundColor: 'rgba(0, 0, 0, 0.4)', textColor: '#ffffff' } : {}),
  };
  const width = Number(q.get('w') || manifest.defaultSize.w);
  const height = Number(q.get('h') || manifest.defaultSize.h);

  document.body.style.margin = '0';
  document.body.style.background = dark
    ? 'linear-gradient(135deg,#243b55,#141e30)'
    : 'linear-gradient(135deg,#dbe6f6,#c5796d)';
  document.body.style.fontFamily = 'Inter, system-ui, sans-serif';
  const host = document.getElementById('root')!;
  host.style.cssText = `position:relative;width:${width}px;height:${height}px;margin:16px;`;

  const props: Record<string, unknown> = {
    config,
    style,
    timezone: TZ,
    people: q.get('people') === '0' ? [] : PEOPLE,
    timeFormat: q.get('tf') || undefined,
    ...(q.get('setup') === '1' ? { calendarSetup: 'noSources' } : {}),
  };
  ReactDOM.createRoot(host).render(React.createElement(Component, props));
  w.__ready = true;
}

void main();
