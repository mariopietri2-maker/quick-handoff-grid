import { useCallback, useEffect, useState } from 'react';
import { CheckCheck, ChevronDown, Megaphone, Newspaper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { formatDistanceToNow, isPast } from 'date-fns';
import { el } from 'date-fns/locale';

const SEEN_KEY = 'qg.store.news.seen.v1';
const MAX_SEEN = 100;

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function persistSeen(seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-MAX_SEEN)));
  } catch {}
}

/**
 * Read-only store news announcer. Admin sends via AnnouncementsManager
 * (audience Καταστήματα / Όλοι); the store only reads. Realtime updates
 * arrive through useAnnouncements; unread items get a ΝΕΟ badge.
 */
export function StoreNewsPanel() {
  const { data: announcements } = useAnnouncements('store_owners');
  const [seen, setSeen] = useState<Set<string>>(() => loadSeen());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Re-render every minute so relative times and expiry stay fresh.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const visible = (announcements ?? []).filter(
    (a: any) => !a.expires_at || !isPast(new Date(a.expires_at)),
  );
  const unreadCount = visible.filter((a: any) => !seen.has(a.id)).length;

  const markSeen = useCallback((id: string) => {
    setSeen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      persistSeen(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setSeen(() => {
      const next = new Set(visible.map((a: any) => a.id as string));
      persistSeen(next);
      return next;
    });
  }, [visible]);

  const toggleExpand = (id: string, alreadySeen: boolean) => {
    setExpandedId((prev) => (prev === id ? null : id));
    if (!alreadySeen) markSeen(id);
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3.5 py-2.5">
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Newspaper className="h-4 w-4 text-primary" />
        </div>
        <h2 className="font-heading font-bold text-sm text-foreground flex-1 min-w-0">Νέα καταστήματος</h2>
        {unreadCount > 0 && (
          <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </div>
      <CardContent className="p-2.5">
        {visible.length === 0 ? (
          <div className="text-center py-6 px-2">
            <Megaphone className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground font-heading">Δεν υπάρχουν νέα αυτή τη στιγμή.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {unreadCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full h-7 text-[11px] font-heading text-muted-foreground gap-1.5"
                onClick={markAllRead}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Σήμανση όλων ως διαβασμένα
              </Button>
            )}
            {visible.map((a: any) => {
              const isSeen = seen.has(a.id);
              const expanded = expandedId === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleExpand(a.id, isSeen)}
                  className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                    isSeen
                      ? 'border-border/60 bg-background hover:bg-muted/40'
                      : 'border-primary/30 bg-primary/[0.06] hover:bg-primary/[0.1]'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!isSeen && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-[13px] font-heading truncate ${isSeen ? 'font-medium text-foreground/80' : 'font-bold text-foreground'}`}>
                          {a.title}
                        </p>
                        {!isSeen && (
                          <span className="text-[9px] font-extrabold uppercase tracking-wide text-primary shrink-0">
                            ΝΕΟ
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: el })}
                      </p>
                      {expanded && (
                        <p className="text-xs text-foreground/90 mt-1.5 leading-relaxed whitespace-pre-wrap">
                          {a.message}
                        </p>
                      )}
                    </div>
                    <ChevronDown
                      className={`h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
