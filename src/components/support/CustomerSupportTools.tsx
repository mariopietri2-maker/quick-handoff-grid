import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, Send, Eye, ShoppingBag, Wallet } from 'lucide-react';

interface Ticket { id: string; requester_id?: string | null; order_id?: string | null; }

export function CustomerSupportTools({ ticket }: { ticket: Ticket }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [showOrders, setShowOrders] = useState(false);

  const fetchOrders = async () => {
    if (!ticket.requester_id) return;
    setLoading('orders');
    const { data } = await supabase
      .from('orders').select('id, order_number, status, total_amount, created_at, store_id, stores(name)')
      .eq('customer_id', ticket.requester_id)
      .order('created_at', { ascending: false }).limit(10);
    setOrders(data ?? []);
    setShowOrders(true);
    setLoading(null);
  };

  const refundLastOrder = async () => {
    if (!ticket.order_id) { toast.error('Δεν υπάρχει order_id στο ticket'); return; }
    setLoading('refund');
    const { error } = await supabase.rpc('admin_refund_order', { p_order_id: ticket.order_id });
    setLoading(null);
    if (error) toast.error('Αποτυχία επιστροφής');
    else toast.success('Επιστροφή ποσού εκδόθηκε');
  };

  const sendApologyCredit = async () => {
    if (!ticket.requester_id) return;
    setLoading('credit');
    const { error } = await supabase
      .from('wallet_transactions')
      .insert({ driver_id: ticket.requester_id, amount: 5, type: 'credit', description: 'Apology credit from support' });
    setLoading(null);
    if (error) toast.error('Αποτυχία');
    else toast.success('€5 apology credit προστέθηκε');
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2 mb-1">
          <ShoppingBag className="h-4 w-4 text-primary" />
          <h3 className="font-heading font-bold text-sm">Customer Support Tools</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={fetchOrders} disabled={loading === 'orders'}>
            <Eye className="h-3.5 w-3.5 mr-1" /> Ιστορικό παραγγελιών
          </Button>
          {ticket.order_id && (
            <Button size="sm" variant="outline" onClick={refundLastOrder} disabled={loading === 'refund'}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Επιστροφή
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={sendApologyCredit} disabled={loading === 'credit'}>
            <Wallet className="h-3.5 w-3.5 mr-1" /> €5 apology
          </Button>
        </div>
        {showOrders && (
          <div className="space-y-1 mt-2">
            {orders.length === 0 ? (
              <p className="text-xs text-muted-foreground">Δεν βρέθηκαν παραγγελίες</p>
            ) : orders.map(o => (
              <div key={o.id} className="flex items-center justify-between text-xs border rounded-md px-2 py-1.5">
                <span className="font-mono">#{o.order_number ?? o.id.slice(0, 8)}</span>
                <Badge variant="outline" className="text-[9px]">{o.status}</Badge>
                <span>€{Number(o.total_amount).toFixed(2)}</span>
                <span className="text-muted-foreground text-[10px]">{o.stores?.name ?? '-'}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
