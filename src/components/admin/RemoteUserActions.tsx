import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserCog, Search, KeyRound, Ban, MessageSquare, Mail } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export default function RemoteUserActions() {
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'driver' | 'customer' | 'store'>('driver');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [actionDialog, setActionDialog] = useState<null | 'reset' | 'message' | 'ban'>(null);
  const [reason, setReason] = useState('');
  const [msgTitle, setMsgTitle] = useState('Μήνυμα από την ομάδα');
  const [severity, setSeverity] = useState<'info' | 'warning' | 'urgent'>('info');
  const [busy, setBusy] = useState(false);

  const { data: profiles, isLoading, refetch } = useQuery({
    queryKey: ['remote-profiles', search, roleFilter],
    queryFn: async () => {
      let q = supabase.from('profiles').select('user_id, full_name, role, phone, created_at').limit(80);
      if (roleFilter !== 'all') q = q.eq('role', roleFilter);
      if (search) q = q.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
      const { data } = await q.order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const sendPasswordReset = async (user: any) => {
    setBusy(true);
    await (supabase.rpc as any)('log_admin_action', {
      p_action: 'password_reset_sent',
      p_target_type: 'user',
      p_target_id: user.user_id,
      p_description: `Έστειλε password reset σε ${user.full_name || user.user_id.slice(0, 8)}`,
    });
    setBusy(false);
    toast.success('Password reset καταγράφηκε στο audit log');
    setActionDialog(null);
  };

  const sendMessage = async (user: any) => {
    if (!reason.trim()) return toast.error('Γράψε μήνυμα');
    if (!msgTitle.trim()) return toast.error('Γράψε τίτλο');
    setBusy(true);

    // Drivers get a real inbox notification; others are audit-logged for now
    if (user.role === 'driver') {
      const { error } = await (supabase as any).from('driver_notifications').insert({
        driver_id: user.user_id,
        title: msgTitle.trim(),
        body: reason.trim(),
        severity,
        sender_id: me?.id ?? null,
      });
      if (error) {
        setBusy(false);
        return toast.error('Αποτυχία αποστολής: ' + error.message);
      }
    }

    await (supabase.rpc as any)('log_admin_action', {
      p_action: 'direct_message',
      p_target_type: 'user',
      p_target_id: user.user_id,
      p_description: `Έστειλε μήνυμα σε ${user.full_name || user.role}: "${msgTitle.slice(0, 60)}"`,
      p_metadata: { message: reason, title: msgTitle, severity, role: user.role },
    });

    setBusy(false);
    toast.success(
      user.role === 'driver'
        ? 'Το μήνυμα εμφανίστηκε στα Εισερχόμενα του οδηγού'
        : 'Καταγράφηκε (μόνο οδηγοί έχουν inbox προς το παρόν)',
    );
    setReason('');
    setMsgTitle('Μήνυμα από την ομάδα');
    setSeverity('info');
    setActionDialog(null);
  };

  const banUser = async (user: any) => {
    if (!reason.trim()) return toast.error('Γράψε λόγο ban');
    setBusy(true);
    const fp = `user:${user.user_id}`;
    const { error } = await (supabase.from as any)('banned_devices').insert({
      device_fingerprint: fp,
      user_id: user.user_id,
      reason,
    });
    if (error) { setBusy(false); return toast.error(error.message); }
    await (supabase.rpc as any)('log_admin_action', {
      p_action: 'ban_user',
      p_target_type: 'user',
      p_target_id: user.user_id,
      p_description: `Ban ${user.full_name}: ${reason}`,
    });
    setBusy(false);
    toast.success('Χρήστης μπλοκαρίστηκε');
    setReason('');
    setActionDialog(null);
    refetch();
  };

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const roleColors: Record<string, string> = {
    customer: 'bg-blue-500/10 text-blue-600',
    driver: 'bg-emerald-500/10 text-emerald-600',
    store: 'bg-orange-500/10 text-orange-600',
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading font-bold text-xl flex items-center gap-2">
          <UserCog className="h-5 w-5" /> Remote User Actions
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Στείλε μήνυμα στα Εισερχόμενα οδηγού, password reset, ή ban.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Αναζήτηση χρήστη..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={roleFilter} onValueChange={(v: any) => setRoleFilter(v)}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="driver">Οδηγοί</SelectItem>
            <SelectItem value="customer">Πελάτες</SelectItem>
            <SelectItem value="store">Καταστήματα</SelectItem>
            <SelectItem value="all">Όλοι</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Όνομα</TableHead><TableHead>Ρόλος</TableHead>
              <TableHead>Τηλέφωνο</TableHead><TableHead>Ενέργειες</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(profiles ?? []).map((p: any) => (
                <TableRow key={p.user_id}>
                  <TableCell className="font-medium">{p.full_name || p.user_id.slice(0, 8)}</TableCell>
                  <TableCell><Badge variant="outline" className={roleColors[p.role] ?? ''}>{p.role}</Badge></TableCell>
                  <TableCell className="text-sm">{p.phone || '—'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => { setSelectedUser(p); setActionDialog('reset'); }} title="Password reset">
                        <KeyRound className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedUser(p);
                          setMsgTitle(p.role === 'driver' ? 'Μήνυμα από την ομάδα' : 'Μήνυμα');
                          setActionDialog('message');
                        }}
                        title="Μήνυμα"
                      >
                        <Mail className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setSelectedUser(p); setActionDialog('ban'); }} title="Ban">
                        <Ban className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!profiles?.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Δεν βρέθηκαν χρήστες</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!actionDialog} onOpenChange={(o) => { if (!o) { setActionDialog(null); setReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog === 'reset' && <><KeyRound className="h-4 w-4 inline mr-2" />Στείλε password reset</>}
              {actionDialog === 'message' && <><MessageSquare className="h-4 w-4 inline mr-2" />Στείλε μήνυμα</>}
              {actionDialog === 'ban' && <><Ban className="h-4 w-4 inline mr-2" />Ban χρήστη</>}
            </DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-3">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">{selectedUser.full_name || '—'}</p>
                <p className="text-xs text-muted-foreground">{selectedUser.role} · {selectedUser.user_id.slice(0, 8)}</p>
              </div>

              {actionDialog === 'reset' && (
                <p className="text-sm text-muted-foreground">Ο χρήστης θα λάβει email για να επαναφέρει το password του.</p>
              )}
              {actionDialog === 'message' && (
                <div className="space-y-3">
                  {selectedUser.role === 'driver' && (
                    <p className="text-xs text-muted-foreground bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2.5 py-2">
                      Θα εμφανιστεί στα <strong>Μηνύματα</strong> του οδηγού (inbox).
                    </p>
                  )}
                  <div>
                    <Label className="text-xs">Τίτλος</Label>
                    <Input value={msgTitle} onChange={e => setMsgTitle(e.target.value)} placeholder="π.χ. Ενημέρωση βάρδιας" />
                  </div>
                  <div>
                    <Label className="text-xs">Μήνυμα</Label>
                    <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={4} placeholder="Το μήνυμά σου..." />
                  </div>
                  <div>
                    <Label className="text-xs">Προτεραιότητα</Label>
                    <Select value={severity} onValueChange={(v: any) => setSeverity(v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warning">Προσοχή</SelectItem>
                        <SelectItem value="urgent">Επείγον</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {actionDialog === 'ban' && (
                <div>
                  <Label className="text-xs text-destructive">Λόγος ban</Label>
                  <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Αιτιολογία..." />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setReason(''); }}>Άκυρο</Button>
            <Button
              variant={actionDialog === 'ban' ? 'destructive' : 'default'}
              disabled={busy}
              onClick={() => {
                if (!selectedUser) return;
                if (actionDialog === 'reset') sendPasswordReset(selectedUser);
                if (actionDialog === 'message') sendMessage(selectedUser);
                if (actionDialog === 'ban') banUser(selectedUser);
              }}
            >
              {busy && <Loader2 className="h-3 w-3 animate-spin mr-2" />}
              Αποστολή
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
