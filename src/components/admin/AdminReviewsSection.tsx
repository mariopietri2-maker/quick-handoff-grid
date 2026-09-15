import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { SectionHeader } from './AdminSectionHeader';

export function ReviewsSection({ reviews }: { reviews: any[] | undefined }) {
  const [rows, setRows] = useState<any[]>(reviews ?? []);
  const [deleting, setDeleting] = useState<string | null>(null);
  useEffect(() => { setRows(reviews ?? []); }, [reviews]);
  const remove = async (id: string) => {
    if (!confirm('Διαγραφή κριτικής; Θα επανυπολογιστεί ο μέσος όρος.')) return;
    setDeleting(id);
    const { error } = await (supabase as any).from('reviews').delete().eq('id', id);
    setDeleting(null);
    if (error) { toast.error('Αποτυχία: ' + error.message); return; }
    setRows((p) => p.filter((r) => r.id !== id));
    toast.success('Η κριτική διαγράφηκε');
  };
  return (
    <div className="space-y-3">
      <SectionHeader title="Κριτικές" count={rows.length} />
      <div className="admin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead><tr><th>Βαθμολογία</th><th>Σχόλιο</th><th>Παραγγελία</th><th>Ημερομηνία</th><th className="w-16"></th></tr></thead>
            <tbody>
              {rows.map((review: any) => (
                <tr key={review.id}>
                  <td>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star key={i} className={`h-3 w-3 ${i < review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/30'}`} />
                      ))}
                    </div>
                  </td>
                  <td className="max-w-md truncate text-muted-foreground">{review.comment || '—'}</td>
                  <td className="font-mono text-[11px] text-muted-foreground">#{String(review.order_id ?? '').slice(0, 8)}</td>
                  <td className="text-[11.5px] text-muted-foreground tabular-nums">{review.created_at ? format(new Date(review.created_at), 'dd MMM yyyy') : '—'}</td>
                  <td>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" disabled={deleting === review.id} onClick={() => void remove(review.id)} title="Διαγραφή">
                      {deleting === review.id ? '…' : 'Διαγραφή'}
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={5} className="text-center text-muted-foreground py-10">Καμία κριτική</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}