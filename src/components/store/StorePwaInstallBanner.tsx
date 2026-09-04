import { useEffect, useState } from 'react';
import { Download, ExternalLink, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  canPromptPwaInstall,
  isNativeShell,
  isRunningAsPwa,
  promptPwaInstall,
  subscribePwaInstallAvailability,
} from '@/lib/pwa';
import { SITE_ORIGIN } from '@/lib/site';

const DISMISS_KEY = 'fresh.store.pwa.install.dismissed';
const DISMISS_NATIVE_KEY = 'fresh.store.pwa.native.dismissed';

/** Stable Store PWA URL on Vercel (also used from beta APK). */
export const STORE_PWA_URL = `${SITE_ORIGIN.replace(/\/$/, '')}/store`;

async function openExternal(url: string) {
  try {
    // Prefer Capacitor Browser when available (beta APK)
    const mod = await import('@capacitor/browser');
    await mod.Browser.open({ url });
    return;
  } catch {
    /* fall through */
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Install / Add-to-Home-Screen tip for the store portal.
 * - Web: beforeinstallprompt or iOS Safari instructions
 * - Beta APK (native shell): open PWA in system browser so user can install / bookmark
 */
export function StorePwaInstallBanner() {
  const native = isNativeShell();
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      const key = native ? DISMISS_NATIVE_KEY : DISMISS_KEY;
      return sessionStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  });
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isRunningAsPwa()) return;
    if (native) return;
    setReady(canPromptPwaInstall());
    const unsub = subscribePwaInstallAvailability(() => setReady(canPromptPwaInstall()));
    const ua = navigator.userAgent || '';
    const isIos =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = isIos && !/CriOS|FxiOS|EdgiOS/.test(ua);
    setIosHint(isSafari);
    return unsub;
  }, [native]);

  if (isRunningAsPwa() || dismissed) return null;
  if (!native && !ready && !iosHint) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(native ? DISMISS_NATIVE_KEY : DISMISS_KEY, '1');
    } catch {
      /* noop */
    }
  };

  // Inside Store beta APK: offer open-in-browser so user can install real PWA
  if (native) {
    return (
      <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 flex items-start gap-2.5">
        <div className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-primary/15 flex items-center justify-center">
          <Download className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-heading font-bold text-foreground leading-tight">
            Κατέβασε / εγκατάστησε το Store PWA
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            Άνοιξε στον browser του τηλεφώνου και πάτα «Εγκατάσταση» ή «Προσθήκη στην αρχική οθόνη».
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              className="h-8 rounded-lg font-heading font-semibold"
              onClick={() => {
                void openExternal(STORE_PWA_URL);
              }}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Άνοιγμα PWA
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-lg font-heading font-semibold"
              onClick={() => {
                void openExternal(`${SITE_ORIGIN.replace(/\/$/, '')}/download?app=store`);
              }}
            >
              Σελίδα λήψης
            </Button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Κλείσιμο"
          className="shrink-0 p-1 rounded-md text-muted-foreground hover:bg-muted"
          onClick={dismiss}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 flex items-start gap-2.5">
      <div className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-primary/15 flex items-center justify-center">
        <Download className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-heading font-bold text-foreground leading-tight">
          Εγκατάσταση fresh2go Store
        </p>
        {ready ? (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            Πρόσθεσε την εφαρμογή στην αρχική οθόνη για γρήγορη πρόσβαση χωρίς APK.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug flex items-start gap-1">
            <Share className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Στο Safari πάτα <strong>Κοινή χρήση</strong> → <strong>Προσθήκη στην Αρχική οθόνη</strong>.
            </span>
          </p>
        )}
        {ready && (
          <Button
            size="sm"
            className="mt-2 h-8 rounded-lg font-heading font-semibold"
            onClick={() => {
              void promptPwaInstall();
            }}
          >
            Εγκατάσταση
          </Button>
        )}
      </div>
      <button
        type="button"
        aria-label="Κλείσιμο"
        className="shrink-0 p-1 rounded-md text-muted-foreground hover:bg-muted"
        onClick={dismiss}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
