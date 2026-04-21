import { useEffect, useState } from 'react';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { Card, CardContent } from '@/components/ui/card';
import { Megaphone, Clock, Infinity as InfinityIcon } from 'lucide-react';
import { format, formatDistanceToNowStrict, isPast } from 'date-fns';

interface Props {
  audience: 'drivers' | 'store_owners' | 'support';
}

export default function AnnouncementsBanner({ audience }: Props) {
  const { data: announcements } = useAnnouncements(audience);
  const [, setTick] = useState(0);

  // Re-render every 30s so countdowns stay fresh and expired ones drop off
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const visible = (announcements ?? []).filter(
    (a: any) => !a.expires_at || !isPast(new Date(a.expires_at))
  );

  if (!visible.length) return null;

  return (
    <div className="space-y-2">
      {visible.slice(0, 3).map((a: any) => {
        const expiresAt = a.expires_at ? new Date(a.expires_at) : null;
        return (
          <Card key={a.id} className="border-primary/20 bg-primary/5">
            <CardContent className="p-3 flex items-start gap-3">
              <Megaphone className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{a.title}</p>
                  {expiresAt ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-full px-1.5 py-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDistanceToNowStrict(expiresAt, { addSuffix: false })}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-1.5 py-0.5">
                      <InfinityIcon className="h-2.5 w-2.5" /> Μόνιμο
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{a.message}</p>
                <p className="text-xs text-muted-foreground/50 mt-1">
                  {format(new Date(a.created_at), 'MMM d, HH:mm')}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
