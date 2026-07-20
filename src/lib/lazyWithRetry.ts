import { ComponentType, lazy, LazyExoticComponent } from 'react';

const RELOAD_KEY = 'fresh_chunk_reload_v1';

/** True when a dynamic import failed because the deploy hash changed (stale tab). */
export function isStaleChunkError(error: unknown): boolean {
  const msg = String((error as Error)?.message ?? error ?? '');
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /Loading chunk [\w-]+ failed/i.test(msg) ||
    /ChunkLoadError/i.test(msg)
  );
}

/**
 * One auto-reload per tab session when a Vite chunk 404s after a new deploy.
 * Avoids infinite loops if the reload itself still fails.
 */
export function reloadForStaleChunk(reason?: unknown): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === '1') return false;
    sessionStorage.setItem(RELOAD_KEY, '1');
  } catch {
    /* private mode — still try once */
  }
  // eslint-disable-next-line no-console
  console.warn('[chunk] stale asset — reloading', reason);
  window.location.reload();
  return true;
}

/** Clear the one-shot guard after a successful boot so future deploys can recover again. */
export function clearStaleChunkReloadGuard() {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    /* ignore */
  }
}

type ModuleDefault<T> = { default: T };

/**
 * `React.lazy` wrapper: retries the import once, then hard-reloads on stale chunks.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<ModuleDefault<T>>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await factory();
      clearStaleChunkReloadGuard();
      return mod;
    } catch (first) {
      // Brief pause — CDN / SW race right after deploy
      await new Promise((r) => setTimeout(r, 400));
      try {
        const mod = await factory();
        clearStaleChunkReloadGuard();
        return mod;
      } catch (second) {
        if (isStaleChunkError(second) || isStaleChunkError(first)) {
          reloadForStaleChunk(second);
          // Hang the suspense tree until the page unloads
          return new Promise(() => {});
        }
        throw second;
      }
    }
  });
}
