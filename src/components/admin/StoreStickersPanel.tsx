import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { QrCode, Printer, Check, Search, RefreshCw } from 'lucide-react';

export default function StoreStickersPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: stickers, isLoading } = useQuery({
    queryKey: ['store-stickers', search],
    queryFn: async () => {
      let q = (supabase as any)
        .from('store_stickers')
        .select('*, stores(name)')
        .order('created_at', { ascending: false });
      if (search) {
        q = q.or(`sticker_code.ilike.%${search}%,stores.name.ilike.%${search}%`);
      }
      const { data, error } = await q.limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const markPrinted = async (id: string) => {
    const { error } = await (supabase as any)
      .from('store_stickers')
      .update({ print_status: 'printed', printed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) toast.error('Αποτυχία');
    else { toast.success('Μαρκαρίστηκε ως εκτυπωμένο'); queryClient.invalidateQueries({ queryKey: ['store-stickers'] }); }
  };

  const regenerate = async (storeId: string, storeName: string) => {
    const code = 'STK-' + storeName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4) + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const { error } = await (supabase as any)
      .from('store_stickers')
      .update({ sticker_code: code, qr_url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${code}`, print_status: 'pending', printed_at: null })
      .eq('store_id', storeId);
    if (error) toast.error('Αποτυχία');
    else { toast.success('Καινούργιο sticker code'); queryClient.invalidateQueries({ queryKey: ['store-stickers'] }); }
  };

  const pending = stickers?.filter((s: any) => s.print_status === 'pending').length ?? 0;
  const printed = stickers?.filter((s: any) => s.print_status === 'printed').length ?? 0;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-heading font-bold text-lg flex items-center gap-2"><QrCode className="h-5 w-5" /> Store Stickers</h2>
          <p className="text-xs text-muted-foreground">Αυτόματη δημιουργία sticker για κάθε νέο κατάστημα</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-warning">Εκκρεμή: {pending}</Badge>
          <Badge variant="outline" className="text-success">Εκτυπωμένα: {printed}</Badge>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Αναζήτηση κατά storefront ή sticker code..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">Φόρτωση...</p>
      ) : stickers && stickers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {stickers.map((s: any) => (
            <Card key={s.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-sm truncate">{s.stores?.name ?? 'Άγνωστο'}</p>
                    <p className="text-xs font-mono text-muted-foreground">{s.sticker_code}</p>
                  </div>
                  <Badge variant={s.print_status === 'printed' ? 'default' : 'secondary'} className={s.print_status === 'printed' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}>
                    {s.print_status === 'printed' ? <><Check className="h-3 w-3 mr-1" /> Εκτυπώθηκε</> : 'Εκκρεμές'}
                  </Badge>
                </div>
                <div className="flex justify-center bg-muted/30 rounded-lg p-2">
                  <img src={s.qr_url} alt="QR" className="h-32 w-32 rounded-lg" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => window.open(s.qr_url, '_blank')}>
                    <Printer className="h-3.5 w-3.5 mr-1" /> Εκτύπωση
                  </Button>
                  {s.print_status === 'pending' && (
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => markPrinted(s.id)}>
                      <Check className="h-3.5 w-3.5 mr-1" /> Μαρκάρισμα
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => regenerate(s.store_id, s.stores?.name ?? 'S')} title="Αναγέννηση κωδικού">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">
          Δεν υπάρχουν stickers. Νέα stickers δημιουργούνται αυτόματα όταν προστίθεται νέο κατάστημα.
        </CardContent></Card>
      )}
    </div>
  );
}
