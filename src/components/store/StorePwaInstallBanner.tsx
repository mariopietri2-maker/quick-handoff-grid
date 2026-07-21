import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  canPromptPwaInstall,
  isNativeShell,
  isRunningAsPwa,
  promptPwaInstall,
  subscribePwaInstallAvailability,
} from '@/lib/pwa';

const DISMISS_KEY = 'fresh.store.pwa.install.dismissed';

/**
 * Install / Add-to-Home-Screen tip for the store portal.
 * Uses beforeinstallprompt on Chromium; shows iOS Safari instructions otherwise.
 */
export function StorePwaInstallBanner() {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isNativeShell() || isRunningAsPwa()) return;
    setReady(canPromptPwaInstall());
    const unsub = subscribePwaInstallAvailability(() => setReady(canPromptPwaInstall()));
    const ua = navigator.userAgent || '';
    const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = isIos && !/CriOS|FxiOS|EdgiOS/.test(ua);
    setIosHint(isSafari);
    return unsub;
  }, []);

  if (isNativeShell() || isRunningAsPwa() || dismissed) return null;
  if (!ready && !iosHint) return null;

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* noop */ }
  };

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 flex items-start gap-2.5">
      <div className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-primary/15 flex items-center justify-center">
        <Download className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-heading font-bold text-foreground leading-tight">
          Εγκατάσταση Fresh Store
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
            onClick={() => { void promptPwaInstall(); }}
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
