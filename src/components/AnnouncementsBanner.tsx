import { useAnnouncements } from '@/hooks/useAnnouncements';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Megaphone } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  audience: 'drivers' | 'store_owners';
}

export default function AnnouncementsBanner({ audience }: Props) {
  const { data: announcements } = useAnnouncements(audience);

  if (!announcements?.length) return null;

  return (
    <div className="space-y-2">
      {announcements.slice(0, 3).map((a: any) => (
        <Card key={a.id} className="border-primary/20 bg-primary/5">
          <CardContent className="p-3 flex items-start gap-3">
            <Megaphone className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-sm">{a.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{a.message}</p>
              <p className="text-xs text-muted-foreground/50 mt-1">
                {format(new Date(a.created_at), 'MMM d, HH:mm')}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
