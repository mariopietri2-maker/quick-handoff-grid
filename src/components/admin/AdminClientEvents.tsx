import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Activity } from 'lucide-react';

type Row = {
  id: number;
  app: string;
  event: string;
  props: Record<string, unknown> | null;
  created_at: string;
};

export default function AdminClientEvents() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await (supabase as any)
      .from('app_client_events')
      .select('id, app, event, props, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (err) setError(err.message);
    else setRows((data as Row[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.event, (m.get(r.event) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  return (
    <div className="space-y-4 p-4 max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="h-5 w-5 text-orange-500" />
            Client events
          </h2>
          <p className="text-sm text-muted-foreground">
            Ελαφριά analytics από native customer (τελευταία 100).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Ανανέωση
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="p-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {counts.length === 0 && !loading && (
          <Card className="col-span-full">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Δεν υπάρχουν events ακόμα. Θα εμφανιστούν μετά από παραγγελίες από την native εφαρμογή.
            </CardContent>
          </Card>
        )}
        {counts.map(([event, n]) => (
          <Card key={event}>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground truncate">{event}</div>
              <div className="text-2xl font-bold">{n}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Πρόσφατα</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y max-h-[480px] overflow-y-auto">
            {loading && (
              <div className="p-4 text-sm text-muted-foreground">Φόρτωση…</div>
            )}
            {!loading &&
              rows.map((r) => (
                <div key={r.id} className="px-4 py-2.5 text-sm flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString('el-GR')}
                  </span>
                  <span className="font-semibold text-orange-600">{r.event}</span>
                  <span className="text-xs text-muted-foreground">{r.app}</span>
                  <span className="text-xs text-muted-foreground truncate flex-1">
                    {r.props ? JSON.stringify(r.props) : ''}
                  </span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
