import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { PhoneCall, Store, Bike, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';

type CallRoleRow = {
  kind: 'store' | 'driver';
  id: string;
  label: string;
  sublabel: string;
  call_role: string;
};

export default function CallRolesPanel() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<CallRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_list_call_roles');
    if (error) {
      toast.error(`Φόρτωση ρόλων απέτυχε: ${error.message}`);
    } else {
      setRows((data ?? []) as unknown as CallRoleRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
    else setLoading(false);
  }, [isAdmin, load]);

  const setStoreRole = async (id: string, role: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc('admin_set_store_call_role', { p_store_id: id, p_role: role });
    if (error) toast.error(error.message);
    else toast.success(role === 'N' ? 'Κατάστημα → Ghost Store' : 'Κατάστημα → standard');
    await load();
    setBusyId(null);
  };

  const setDriverRole = async (id: string, role: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc('admin_set_driver_call_role', { p_user_id: id, p_role: role });
    if (error) toast.error(error.message);
    else toast.success(role === 'K' ? 'Οδηγός → Ghost Rider' : 'Οδηγός → standard');
    await load();
    setBusyId(null);
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        !needle ||
        r.label.toLowerCase().includes(needle) ||
        r.sublabel.toLowerCase().includes(needle)
    );
  }, [rows, q]);

  const stores = filtered.filter((r) => r.kind === 'store');
  const drivers = filtered.filter((r) => r.kind === 'driver');

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <PhoneCall className="h-4 w-4" /> Ghost roles
            <Badge variant="outline" className="ml-1 gap-1">
              <img src="/brand/ghost-store-64.png" alt="" className="h-3.5 w-3.5 rounded-sm" />
              Ghost Store
            </Badge>
            <Badge variant="outline" className="gap-1">
              <img src="/brand/ghost-rider-64.png" alt="" className="h-3.5 w-3.5 rounded-full" />
              Ghost Rider
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Ghost Store: το κατάστημα βλέπει μόνο το κουμπί «Κλήση οδηγού».
            Ghost Rider: ο οδηγός λαμβάνει κλήσεις μόνο από Ghost Stores. Καμία πληρωμή πλατφόρμας· ιστορικό σβήνει σε 24h.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Αναζήτηση..." className="pl-8 h-9" />
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Ανανέωση
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <img src="/brand/ghost-store-64.png" alt="" className="h-5 w-5 rounded-md" />
              Ghost Stores ({stores.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {stores.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.label || '(χωρίς όνομα)'}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.sublabel}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">{r.call_role === 'N' ? 'Ghost Store' : 'standard'}</span>
                  <Switch
                    checked={r.call_role === 'N'}
                    disabled={!isAdmin || busyId === r.id || loading}
                    onCheckedChange={(v) => setStoreRole(r.id, v ? 'N' : 'standard')}
                  />
                </div>
              </div>
            ))}
            {!loading && stores.length === 0 && <div className="py-6 text-sm text-muted-foreground text-center">Κανένα αποτέλεσμα</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <img src="/brand/ghost-rider-64.png" alt="" className="h-5 w-5 rounded-full" />
              Ghost Riders ({drivers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {drivers.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.sublabel}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">{r.call_role === 'K' ? 'Ghost Rider' : 'standard'}</span>
                  <Switch
                    checked={r.call_role === 'K'}
                    disabled={!isAdmin || busyId === r.id || loading}
                    onCheckedChange={(v) => setDriverRole(r.id, v ? 'K' : 'standard')}
                  />
                </div>
              </div>
            ))}
            {!loading && drivers.length === 0 && <div className="py-6 text-sm text-muted-foreground text-center">Κανένα αποτέλεσμα</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
