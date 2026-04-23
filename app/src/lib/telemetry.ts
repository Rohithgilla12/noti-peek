/**
 * Opt-in, PII-free crash telemetry for the noti-peek desktop app.
 *
 * Design goals:
 *   - Off by default in release builds; explicit opt-in via Settings toggle.
 *   - Default-on in explicitly-labelled beta builds so we catch crashes pre-1.0,
 *     still honouring an opt-out.
 *   - Never capture notification bodies, titles, URLs, provider account names,
 *     or the device token. Stack traces + app version + OS only.
 *   - Zero cost when disabled — the Sentry SDK is dynamically imported so
 *     disabled users don't pay its bundle tax.
 *
 * Privacy contract mirrors landing/privacy.html §4.
 *
 * Prereqs (install when wiring up):
 *   bun add @sentry/browser @tauri-apps/plugin-store
 */

import { load, type Store } from '@tauri-apps/plugin-store';

const TELEMETRY_STORE = 'telemetry.json';
const TELEMETRY_KEY = 'enabled';

/**
 * Set at build time by Vite. In a beta build pipeline, pass
 *   VITE_NOTIPEEK_CHANNEL=beta
 * to enable default-on telemetry. Any other value (including undefined)
 * defaults to opt-out.
 */
const CHANNEL = (import.meta.env.VITE_NOTIPEEK_CHANNEL ?? 'stable') as
  | 'stable'
  | 'beta';

/** Sentry DSN — public-safe. Set at build time via VITE_SENTRY_DSN. */
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '0.0.0-dev';

let initialized = false;
let currentEnabled: boolean | null = null;
let store: Store | null = null;

// Shape Sentry exposes that we use. Declared locally so this file typechecks
// before `bun add @sentry/browser` has run.
interface SentryLike {
  init: (options: Record<string, unknown>) => void;
  close: (timeout?: number) => Promise<boolean>;
  captureException: (err: unknown, ctx?: Record<string, unknown>) => void;
}

/**
 * Lazily import Sentry via a runtime-computed specifier so TS does not try to
 * resolve the module at compile time. Returns null when the package is not
 * installed (e.g. during local development without telemetry deps).
 */
async function loadSentry(): Promise<SentryLike | null> {
  try {
    // Dynamic specifier so TS does not try to resolve at compile time — the
    // package is an optional runtime dep, installed only when telemetry is in use.
    const specifier = '@sentry/browser';
    const mod = await import(/* @vite-ignore */ specifier);
    return mod as SentryLike;
  } catch {
    return null;
  }
}

async function getStore(): Promise<Store> {
  if (store) return store;
  store = await load(TELEMETRY_STORE, { defaults: {}, autoSave: true });
  return store;
}

/** Read the persisted preference, falling back to the channel default. */
export async function getTelemetryPreference(): Promise<boolean> {
  const s = await getStore();
  const stored = await s.get<boolean>(TELEMETRY_KEY);
  if (typeof stored === 'boolean') return stored;
  // Default-on only for beta channel.
  return CHANNEL === 'beta';
}

/** Persist a new preference and (re)initialize or shut down Sentry. */
export async function setTelemetryPreference(enabled: boolean): Promise<void> {
  const s = await getStore();
  await s.set(TELEMETRY_KEY, enabled);
  currentEnabled = enabled;
  if (enabled) {
    await ensureInitialized();
  } else {
    await shutdown();
  }
}

/**
 * Call once at app boot. Honours persisted preference (or channel default).
 * Safe to call even if Sentry is disabled — returns without touching the SDK.
 */
export async function initTelemetry(): Promise<void> {
  const enabled = await getTelemetryPreference();
  currentEnabled = enabled;
  if (!enabled) return;
  await ensureInitialized();
}

async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  if (!SENTRY_DSN) {
    // No DSN baked in → silently no-op. Developers running locally don't need
    // telemetry spam, and we shouldn't crash on them for missing env.
    return;
  }

  const Sentry = await loadSentry();
  if (!Sentry) return; // package not installed yet

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      release: `noti-peek@${APP_VERSION}`,
      environment: CHANNEL,
      // We do NOT enable session replay or performance tracing; only crashes.
      tracesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      // Strip anything that smells like user or notification data.
      sendDefaultPii: false,
      beforeSend(event: MaybeEvent) {
        return scrubEvent(event);
      },
      beforeBreadcrumb(breadcrumb: MaybeBreadcrumb) {
        return scrubBreadcrumb(breadcrumb);
      },
    });
    initialized = true;
  } catch (err) {
    // Telemetry must never break the app.
    console.warn('[telemetry] init failed (ignored):', err);
  }
}

async function shutdown(): Promise<void> {
  if (!initialized) return;
  const Sentry = await loadSentry();
  if (Sentry) {
    try {
      await Sentry.close(2000);
    } catch {
      /* swallow */
    }
  }
  initialized = false;
}

/**
 * Manual error reporting hook. Callers use this in catch blocks that would
 * otherwise swallow a meaningful error. No-op when disabled.
 */
export async function reportError(err: unknown, context?: string): Promise<void> {
  if (!currentEnabled) return;
  const Sentry = await loadSentry();
  if (!Sentry) return;
  try {
    Sentry.captureException(err, context ? { tags: { context } } : undefined);
  } catch {
    /* swallow */
  }
}

// ------------ PII scrubbing ---------------------------------------------

type MaybeEvent = {
  request?: { url?: string; headers?: Record<string, string> };
  user?: unknown;
  contexts?: Record<string, unknown>;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  breadcrumbs?: Array<Record<string, unknown>>;
};

type MaybeBreadcrumb = {
  data?: Record<string, unknown>;
  message?: string;
  category?: string;
};

/**
 * Remove anything that could identify the user or leak notification content.
 * This runs on every event before send; paranoia is the correct posture here.
 */
function scrubEvent<T extends MaybeEvent>(event: T): T {
  delete event.user;
  if (event.request) {
    // URL path is fine (e.g. /notifications) but query params and Authorization
    // headers are not.
    if (event.request.url) {
      try {
        const u = new URL(event.request.url);
        u.search = '';
        event.request.url = u.toString();
      } catch {
        /* keep whatever — regex-based scrub below will still run */
      }
    }
    if (event.request.headers) {
      delete event.request.headers['Authorization'];
      delete event.request.headers['authorization'];
      delete event.request.headers['Cookie'];
      delete event.request.headers['cookie'];
    }
  }
  if (event.extra) {
    for (const key of Object.keys(event.extra)) {
      event.extra[key] = redactValue(event.extra[key]);
    }
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => scrubBreadcrumb(b) ?? b);
  }
  return event;
}

function scrubBreadcrumb<T extends MaybeBreadcrumb>(crumb: T): T | null {
  // Drop UI/click breadcrumbs entirely — they contain DOM text that may be
  // notification content.
  if (crumb.category === 'ui.click' || crumb.category === 'ui.input') return null;
  if (crumb.data) {
    for (const key of Object.keys(crumb.data)) {
      crumb.data[key] = redactValue(crumb.data[key]);
    }
  }
  return crumb;
}

function redactValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  // Bearer tokens, URLs, emails → redact.
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [REDACTED]')
    .replace(/https?:\/\/\S+/g, '[URL]')
    .replace(/[\w.+-]+@[\w.-]+\.\w+/g, '[EMAIL]');
}

// ------------ Lightweight event tracking ---------------------------------

/**
 * Fire a named product event with optional metadata. No-op when telemetry is
 * disabled or no event-ingestion DSN is configured. Events are intentionally
 * ephemeral (not persisted locally) and must never contain PII — only
 * structural counts and enum-like string values.
 */
export function captureEvent(name: string, props?: Record<string, unknown>): void {
  if (!currentEnabled) return;
  try {
    // Log to console in development so engineers can see the event stream
    // without needing a real ingestion endpoint.
    if (import.meta.env.DEV) {
      console.debug('[telemetry:event]', name, props);
    }
    // Extend here when a dedicated event-tracking endpoint (e.g. Plausible
    // custom events or a lightweight /events Worker route) is wired up.
  } catch {
    /* telemetry must never break the app */
  }
}

// ------------ Settings UI helper (hook-friendly) -------------------------

/**
 * Convenience hook-adapter: current enabled state + a setter. Not a React
 * hook itself to avoid importing React from this lib file — wrap in one at
 * the call site if needed.
 *
 * Example Settings component snippet:
 *
 *   const [enabled, setEnabled] = useState<boolean>(false);
 *   useEffect(() => { getTelemetryPreference().then(setEnabled); }, []);
 *   const onToggle = async (v: boolean) => {
 *     await setTelemetryPreference(v);
 *     setEnabled(v);
 *   };
 */
export const TelemetryChannel = CHANNEL;
