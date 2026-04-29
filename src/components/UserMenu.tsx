import { useEffect, useState } from 'react';
import {
  LogOut, User, Home, UserCircle, Bell, Settings, TrendingUp, Wallet,
  LifeBuoy, Users, Share2, FileText, HelpCircle, Star, Coffee, Pause, PackageX,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { DriverSoundSettings } from '@/components/driver/DriverSoundSettings';
import { DriverAppSettings } from '@/components/driver/DriverAppSettings';
import { useDriverState } from '@/hooks/useDriverState';
import { toast } from 'sonner';

export function UserMenu() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const isDriver = profile?.role === 'driver';
  const [soundOpen, setSoundOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [breakOpen, setBreakOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [activeOrder, setActiveOrder] = useState<{ id: string; status: string } | null>(null);
  const { state: driverState, startBreak, endBreak } = useDriverState();
  const onBreak = !!driverState?.on_break;

  // Track driver's active (releasable) order so we can offer "Unassign" under Break.
  // Releasable = assigned to me and not yet picked up / delivered / canceled.
  useEffect(() => {
    if (!isDriver || !user) { setActiveOrder(null); return; }
    let cancelled = false;
    const load = async () => {
      const { data } = await (supabase as any)
        .from('orders')
        .select('id, status')
        .eq('driver_id', user.id)
        .not('status', 'in', '(picked_up,delivered,canceled,cancelled)')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setActiveOrder(data ?? null);
    };
    load();
    const ch = supabase
      .channel(`user-menu-active-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `driver_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [isDriver, user]);

  const handleReleaseOrder = async () => {
    if (!activeOrder) return;
    setReleasing(true);
    const { error } = await (supabase as any).rpc('driver_release_order', { p_order_id: activeOrder.id });
    setReleasing(false);
    if (error) { toast.error(error.message || 'Αποτυχία απόθεσης παραγγελίας'); return; }
    toast.success('Η παραγγελία επανεκχωρείται σε άλλον οδηγό');
    setReleaseOpen(false);
    setActiveOrder(null);
  };

  // Live tick so the countdown updates while menu is open
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!onBreak) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [onBreak]);

  // Auto-end break when timer expires
  useEffect(() => {
    if (onBreak && driverState?.break_until && new Date(driverState.break_until) <= new Date()) {
      endBreak();
    }
  });

  const breakRemaining = driverState?.break_until
    ? Math.max(0, Math.floor((new Date(driverState.break_until).getTime() - Date.now()) / 1000))
    : 0;
  const mm = Math.floor(breakRemaining / 60).toString().padStart(2, '0');
  const ss = (breakRemaining % 60).toString().padStart(2, '0');

  const itemClassName =
    'min-h-11 rounded-xl px-3 py-3 text-sm font-medium text-foreground cursor-pointer transition-colors focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground';
  const labelClassName =
    'px-3 pt-2 pb-1 text-[11px] font-heading font-bold uppercase tracking-wide text-muted-foreground';

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const go = (path: string) => {
    setMenuOpen(false);
    setTimeout(() => navigate(path), 0);
  };

  const handleShare = async () => {
    const text = 'Γίνε Fresh Delivery driver και κέρδισε bonus καλωσορίσματος!';
    const url = window.location.origin + '/auth';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Fresh Delivery Drivers', text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success('Αντιγράφηκε ο σύνδεσμος');
      }
    } catch {}
  };

  if (!user) return null;

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full gradient-primary text-white border-0 shadow-primary hover:brightness-110 hover:scale-105 transition-all"
          >
            <User className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="z-[200] w-72 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-2xl"
        >
          <div className="mb-1 rounded-xl border border-border bg-muted/60 px-3 py-3">
            <p className="text-sm font-heading font-bold text-foreground truncate">
              {profile?.full_name || 'Χρήστης'}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            {isDriver && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-1 text-[10px] font-heading font-semibold text-primary">
                <Star className="h-2.5 w-2.5" /> DRIVER
              </span>
            )}
          </div>

          {isDriver ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className={labelClassName}>Κατάσταση</DropdownMenuLabel>
              {onBreak ? (
                <DropdownMenuItem
                  className={`${itemClassName} bg-warning/10 text-warning focus:bg-warning/15 focus:text-warning data-[highlighted]:bg-warning/15 data-[highlighted]:text-warning`}
                  onSelect={(e) => { e.preventDefault(); endBreak(); setMenuOpen(false); }}
                >
                  <Pause className="mr-2 h-4 w-4 shrink-0" />
                  <span className="flex-1">Λήξη Διαλείμματος</span>
                  <span className="font-heading text-xs font-bold tabular-nums">{mm}:{ss}</span>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className={itemClassName}
                  onSelect={(e) => { e.preventDefault(); setMenuOpen(false); setTimeout(() => setBreakOpen(true), 50); }}
                >
                  <Coffee className="mr-2 h-4 w-4 shrink-0" />
                  Διάλειμμα
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuLabel className={labelClassName}>Λογαριασμός</DropdownMenuLabel>
              <DropdownMenuItem className={itemClassName} onSelect={() => go('/driver/profile')}>
                <UserCircle className="mr-2 h-4 w-4 shrink-0" />
                Προφίλ Οδηγού
              </DropdownMenuItem>
              <DropdownMenuItem className={itemClassName} onSelect={() => go('/driver?tab=earnings')}>
                <TrendingUp className="mr-2 h-4 w-4 shrink-0" />
                Κέρδη & Στατιστικά
              </DropdownMenuItem>
              <DropdownMenuItem className={itemClassName} onSelect={() => go('/driver?tab=wallet')}>
                <Wallet className="mr-2 h-4 w-4 shrink-0" />
                Πορτοφόλι
              </DropdownMenuItem>
              <DropdownMenuItem className={itemClassName} onSelect={() => go('/driver?tab=referral')}>
                <Users className="mr-2 h-4 w-4 shrink-0" />
                Πρόσκληση Οδηγών
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className={labelClassName}>Ρυθμίσεις</DropdownMenuLabel>
              <DropdownMenuItem
                className={itemClassName}
                onSelect={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  setTimeout(() => setSettingsOpen(true), 50);
                }}
              >
                <Settings className="mr-2 h-4 w-4 shrink-0" />
                Ρυθμίσεις Εφαρμογής
              </DropdownMenuItem>
              <DropdownMenuItem
                className={itemClassName}
                onSelect={(e) => {
                  e.preventDefault();
                  setMenuOpen(false);
                  setTimeout(() => setSoundOpen(true), 50);
                }}
              >
                <Bell className="mr-2 h-4 w-4 shrink-0" />
                Ήχος Ειδοποιήσεων
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className={labelClassName}>Βοήθεια</DropdownMenuLabel>
              <DropdownMenuItem className={itemClassName} onSelect={() => go('/driver/profile?tab=support')}>
                <LifeBuoy className="mr-2 h-4 w-4 shrink-0" />
                Υποστήριξη
              </DropdownMenuItem>
              <DropdownMenuItem className={itemClassName} onSelect={() => { setMenuOpen(false); handleShare(); }}>
                <Share2 className="mr-2 h-4 w-4 shrink-0" />
                Μοιραστείτε την εφαρμογή
              </DropdownMenuItem>
              <DropdownMenuItem className={itemClassName} onSelect={() => window.open('https://quick-handoff-grid.lovable.app', '_blank')}>
                <HelpCircle className="mr-2 h-4 w-4 shrink-0" />
                Συχνές Ερωτήσεις
              </DropdownMenuItem>
              <DropdownMenuItem className={itemClassName} onSelect={() => window.open('https://quick-handoff-grid.lovable.app', '_blank')}>
                <FileText className="mr-2 h-4 w-4 shrink-0" />
                Όροι & Πολιτική
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className={itemClassName} onSelect={() => go('/profile')}>
                <UserCircle className="mr-2 h-4 w-4 shrink-0" />
                Το Προφίλ μου
              </DropdownMenuItem>
              <DropdownMenuItem className={itemClassName} onSelect={() => go('/')}>
                <Home className="mr-2 h-4 w-4 shrink-0" />
                Αρχική
              </DropdownMenuItem>
            </>
          )}

          {isDriver && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className={itemClassName} onSelect={() => go('/profile')}>
                <UserCircle className="mr-2 h-4 w-4 shrink-0" />
                Το Προφίλ μου
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => { setMenuOpen(false); handleSignOut(); }}
            className="min-h-11 rounded-xl px-3 py-3 text-sm font-medium text-destructive cursor-pointer transition-colors focus:bg-destructive/10 focus:text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4 shrink-0" />
            Αποσύνδεση
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isDriver && (
        <>
          <DriverSoundSettings open={soundOpen} onOpenChange={setSoundOpen} />
          <DriverAppSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
          <Dialog open={breakOpen} onOpenChange={setBreakOpen}>
            <DialogContent className="max-w-xs">
              <DialogHeader>
                <DialogTitle>Επιλέξτε διάρκεια διαλείμματος</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-2">
                {[15, 30, 45, 60].map(m => (
                  <Button key={m} onClick={() => { startBreak(m); setBreakOpen(false); }} variant="outline" className="h-12">
                    {m} λεπτά
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Δεν θα λαμβάνεις νέες παραγγελίες κατά τη διάρκεια του διαλείμματος.
              </p>
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  );
}
