import { useCallback, useEffect, useState } from 'react';

export interface AppVersion {
  app?: string;
  version?: string;
  commit?: string;
  builtAt?: string;
}

/** How often to poll /version.json for a new deploy. */
export const APP_UPDATE_POLL_MS = 15 * 60 * 1000;

/** Canonical web origin — polled by bundled (offline) native shells. */
const REMOTE_VERSION_URL = 'https://fresh2go.gr/version.json';
const DOWNLOAD_URL = 'https://fresh2go.gr/download';

export function versionId(v: AppVersion | null): string | null {
  if (!v) return null;
  const id = [v.version, v.commit, v.builtAt].filter(Boolean).join('@');
  return id || null;
}

/** True when both sides resolved and the deploy identity changed. */
export function isVersionDifferent(
  current: AppVersion | null,
  latest: AppVersion | null,
): boolean {
  const a = versionId(current);
  const b = versionId(latest);
  return !!a && !!b && a !== b;
}

async function fetchVersion(url: string): Promise<AppVersion | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as AppVersion;
  } catch {
    return null;
  }
}

/**
 * Offline Capacitor builds serve the bundled dist from localhost, so a
 * same-origin version check would only ever see the baked copy. Those shells
 * poll the canonical remote instead — and a reload can't update them, they
 * need the new build (see `bundled`).
 */
function isBundledNativeShell(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const { hostname, protocol } = window.location;
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      protocol === 'capacitor:' ||
      protocol === 'ionic:'
    );
  } catch {
    return false;
  }
}

export interface AppUpdateState {
  updateAvailable: boolean;
  /** True inside bundled native shells — reload won't help, open the download page. */
  bundled: boolean;
  dismissed: boolean;
  applyUpdate: () => void;
  dismiss: () => void;
}

/**
 * Proactive auto-update: polls the stamped /version.json (written by
 * scripts/run-vite-build.mjs) and watches the service-worker lifecycle.
 * Complements the reactive stale-chunk reload in lazyWithRetry.
 */
export function useAppUpdate(pollMs = APP_UPDATE_POLL_MS): AppUpdateState {
  const [bundled] = useState(isBundledNativeShell);
  const [baseline, setBaseline] = useState<AppVersion | null>(null);
  const [latest, setLatest] = useState<AppVersion | null>(null);
  const [swUpdated, setSwUpdated] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const checkUrl = bundled ? REMOTE_VERSION_URL : '/version.json';

  const check = useCallback(async () => {
    const v = await fetchVersion(checkUrl);
    if (!v || !versionId(v)) return;
    setBaseline((prev) => prev ?? v);
    setLatest(v);
  }, [checkUrl]);

  useEffect(() => {
    void check();
    const timer = window.setInterval(() => void check(), pollMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    const onOnline = () => void check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [check, pollMs]);

  // Service-worker update (web/PWA only — never registered in native shells).
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let alive = true;
    void navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (!reg || !alive) return;
        if (reg.waiting && navigator.serviceWorker.controller) setSwUpdated(true);
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              setSwUpdated(true);
            }
          });
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const applyUpdate = useCallback(async () => {
    if (bundled) {
      // A reload would just re-boot the baked bundle — send to the download page.
      try {
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url: DOWNLOAD_URL });
      } catch {
        window.open(DOWNLOAD_URL, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    window.location.reload();
  }, [bundled]);

  const dismiss = useCallback(() => setDismissed(true), []);

  // Baseline stays null until the first successful poll; latest tracks the
  // newest seen identity. Suppress while either side is unresolved so a
  // missing version.json (old deploy / dev) never prompts.
  const updateAvailable = swUpdated || (baseline !== null && isVersionDifferent(baseline, latest));

  return { updateAvailable, bundled, dismissed, applyUpdate, dismiss };
}
