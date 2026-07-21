import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { isStaleChunkError, reloadForStaleChunk } from '@/lib/lazyWithRetry';

interface State { error: Error | null }

/**
 * Catches render errors inside lazy-loaded routes so the user sees a recovery
 * screen instead of a blank page. Stale deploy chunks auto-reload once.
 */
export class RouteErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error('Route crashed:', error, info);
    if (isStaleChunkError(error)) {
      reloadForStaleChunk(error);
      return;
    }
    // One-shot recovery for known realtime subscribe races after deploys.
    const msg = error?.message ?? '';
    if (msg.includes("cannot add 'postgres_changes'") || msg.includes('after \'subscribe()\'')) {
      try {
        const key = 'fd_realtime_recover';
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          window.location.reload();
        }
      } catch { /* ignore */ }
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    const stale = isStaleChunkError(this.state.error);

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full rounded-xl border border-border bg-card p-6 shadow-sm text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-lg">Κάτι πήγε στραβά</h2>
            <p className="text-sm text-muted-foreground mt-1 break-words">
              {stale
                ? 'Η εφαρμογή ενημερώθηκε. Κάνε επαναφόρτωση για να συνεχίσεις.'
                : (this.state.error.message || 'Απρόσμενο σφάλμα στη σελίδα.')}
            </p>
          </div>
          <div className="flex gap-2 justify-center">
            {!stale && (
              <Button variant="outline" onClick={() => this.setState({ error: null })}>
                Δοκίμασε ξανά
              </Button>
            )}
            <Button onClick={() => window.location.reload()}>Επαναφόρτωση</Button>
          </div>
        </div>
      </div>
    );
  }
}
