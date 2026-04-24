import {
  BarChart3, ShoppingBag, Store, Users, Shield, Wallet,
  MessageSquare, Flame, Star, Megaphone, MapPin, Settings,
  Activity, ChevronLeft, ChevronRight, LayoutDashboard, DollarSign, Headphones,
  Flag, ShieldCheck, UserCog, Zap, ScrollText, PackagePlus, Receipt,
  X, EyeOff, RotateCcw, Search, Clock, UserCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { toast } from 'sonner';

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  pendingTickets?: number;
  pendingWithdrawals?: number;
  /** Mobile drawer mode */
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

const navGroups = [
  {
    label: 'Λειτουργίες',
    items: [
      { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'analytics', label: 'Αναλυτικά', icon: BarChart3 },
      { id: 'orders', label: 'Παραγγελίες', icon: ShoppingBag },
      { id: 'external_orders', label: 'Εισαγωγή eFood/Wolt', icon: PackagePlus },
      { id: 'map', label: 'Live Χάρτης', icon: MapPin },
      { id: 'demand', label: 'Ζώνες Ζήτησης', icon: Flame },
      { id: 'stores', label: 'Καταστήματα', icon: Store },
      { id: 'drivers', label: 'Οδηγοί', icon: Users },
      { id: 'users', label: 'Χρήστες', icon: Shield },
      { id: 'support_roles', label: 'Support Agents', icon: Headphones },
      { id: 'tickets', label: 'Support Tickets', icon: MessageSquare, badgeKey: 'pendingTickets' as const },
    ],
  },
  {
    label: 'Οικονομικά',
    items: [
      { id: 'financials', label: 'Οικονομικά', icon: Wallet },
      { id: 'pricing', label: 'Τιμολόγηση', icon: DollarSign },
      { id: 'store_billing', label: 'Χρέωση Καταστημάτων', icon: Receipt },
    ],
  },
  {
    label: 'Πλατφόρμα',
    items: [
      { id: 'activity', label: 'Activity Log', icon: Activity },
      { id: 'audit_log', label: 'Audit Log', icon: ScrollText },
      { id: 'feature_flags', label: 'Feature Flags', icon: Flag },
      { id: 'overrides', label: 'Surge / Overrides', icon: Zap },
      { id: 'admin_perms', label: 'Admin Permissions', icon: ShieldCheck },
      { id: 'remote_actions', label: 'Remote Actions', icon: UserCog },
      { id: 'driver_map_settings', label: 'Χάρτης Οδηγών', icon: Settings },
      { id: 'announcements', label: 'Ανακοινώσεις', icon: Megaphone },
      { id: 'reviews', label: 'Κριτικές', icon: Star },
      { id: 'canned_replies', label: 'Έτοιμες Απαντήσεις', icon: MessageSquare },
      { id: 'fraud', label: 'Σήματα Απάτης', icon: ShieldCheck },
    ],
  },
];

const STORAGE_KEY = 'admin_sidebar_hidden_v1';
const RECENT_KEY = 'admin_sidebar_recent_v1';
const RECENT_MAX = 3;

const allItems = navGroups.flatMap(g => g.items.map(i => ({ ...i, group: g.label })));
const itemById = new Map(allItems.map(i => [i.id, i]));

function SidebarBody({
  activeSection,
  onSectionChange,
  pendingTickets = 0,
  pendingWithdrawals = 0,
  collapsed,
  setCollapsed,
  isMobile,
}: {
  activeSection: string;
  onSectionChange: (s: string) => void;
  pendingTickets?: number;
  pendingWithdrawals?: number;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  isMobile: boolean;
}) {
  const [hidden, setHidden] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')); }
    catch { return new Set(); }
  });
  const [recent, setRecent] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); }
    catch { return []; }
  });
  const [confirmHide, setConfirmHide] = useState<{ id: string; label: string } | null>(null);
  const [showHiddenDialog, setShowHiddenDialog] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...hidden])); } catch {}
  }, [hidden]);

  // Track recent visits
  const lastTrackedRef = useRef<string>('');
  useEffect(() => {
    if (!activeSection || activeSection === lastTrackedRef.current) return;
    lastTrackedRef.current = activeSection;
    setRecent(prev => {
      const next = [activeSection, ...prev.filter(id => id !== activeSection)].slice(0, RECENT_MAX);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [activeSection]);

  const badges: Record<string, number> = { pendingTickets, pendingWithdrawals };

  const hideItem = (id: string) => {
    setHidden(prev => new Set(prev).add(id));
    if (activeSection === id) onSectionChange('overview');
    toast.success('Αφαιρέθηκε από το μενού', {
      description: 'Μπορείς να το επαναφέρεις από "Κρυμμένα στοιχεία".',
    });
    setConfirmHide(null);
  };

  const restoreItem = (id: string) => {
    setHidden(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    toast.success('Επαναφέρθηκε στο μενού');
  };

  const restoreAll = () => {
    setHidden(new Set());
    toast.success('Όλα τα στοιχεία επαναφέρθηκαν');
  };

  const hiddenList = allItems.filter(i => hidden.has(i.id));

  const q = search.trim().toLowerCase();
  const matchesSearch = (label: string) => !q || label.toLowerCase().includes(q);

  // Recent items (visible, not hidden, not currently active to avoid duplication)
  const recentItems = recent
    .map(id => itemById.get(id))
    .filter((i): i is typeof allItems[number] => !!i && !hidden.has(i.id) && i.id !== activeSection);

  const renderItem = (item: { id: string; label: string; icon: any; badgeKey?: string }, opts?: { compact?: boolean }) => {
    const isActive = activeSection === item.id;
    const badgeCount = (item as any).badgeKey ? badges[(item as any).badgeKey] : 0;
    return (
      <div key={`${opts?.compact ? 'recent-' : ''}${item.id}`} className="group/item relative">
        <button
          onClick={() => onSectionChange(item.id)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
            isActive
              ? 'bg-primary/10 text-primary shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
          title={collapsed ? item.label : undefined}
        >
          <item.icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary')} />
          {!collapsed && (
            <>
              <span className="truncate flex-1 text-left">{item.label}</span>
              {badgeCount > 0 && (
                <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-[10px]">
                  {badgeCount}
                </Badge>
              )}
            </>
          )}
          {collapsed && badgeCount > 0 && (
            <span className="absolute right-1 top-0.5 h-2 w-2 rounded-full bg-destructive" />
          )}
        </button>
        {!collapsed && !opts?.compact && (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmHide({ id: item.id, label: item.label }); }}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md flex items-center justify-center opacity-0 group-hover/item:opacity-100 hover:bg-destructive/15 hover:text-destructive transition-opacity"
            title="Αφαίρεση από μενού"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Logo / Brand */}
      <div className="h-16 flex items-center px-4 border-b border-border shrink-0">
        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
          <Shield className="h-5 w-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="ml-3 overflow-hidden">
            <p className="font-heading font-bold text-sm leading-tight truncate">Admin Panel</p>
            <p className="text-[10px] text-muted-foreground truncate">Διαχείριση Πλατφόρμας</p>
          </div>
        )}
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-1 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Αναζήτηση μενού..."
              className="pl-8 h-8 text-xs bg-muted/50 border-0"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded flex items-center justify-center hover:bg-muted text-muted-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <ScrollArea className="flex-1 py-2">
        <nav className="px-2 space-y-4">
          {/* Recent — only when not searching, not collapsed, has items */}
          {!collapsed && !q && recentItems.length > 0 && (
            <div>
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Πρόσφατα
              </p>
              <div className="space-y-0.5">
                {recentItems.map(item => renderItem(item, { compact: true }))}
              </div>
            </div>
          )}

          {navGroups.map((group) => {
            const visibleItems = group.items
              .filter(i => !hidden.has(i.id))
              .filter(i => matchesSearch(i.label));
            if (!visibleItems.length) return null;
            return (
              <div key={group.label}>
                {!collapsed && (
                  <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {group.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {visibleItems.map(item => renderItem(item))}
                </div>
              </div>
            );
          })}

          {!collapsed && q && allItems.filter(i => !hidden.has(i.id) && matchesSearch(i.label)).length === 0 && (
            <p className="px-3 py-4 text-xs text-center text-muted-foreground">Δεν βρέθηκαν αποτελέσματα</p>
          )}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-border p-2 shrink-0 space-y-1">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center gap-2"
          onClick={() => { window.location.href = '/profile'; }}
          title="Το προφίλ μου"
        >
          <UserCircle className="h-4 w-4" />
          {!collapsed && <span className="text-xs">Το προφίλ μου</span>}
        </Button>
        {hidden.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center gap-2"
            onClick={() => setShowHiddenDialog(true)}
            title="Κρυμμένα στοιχεία"
          >
            <EyeOff className="h-4 w-4" />
            {!collapsed && <span className="text-xs">Κρυμμένα ({hidden.size})</span>}
          </Button>
        )}
        {!isMobile && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Confirm hide */}
      <AlertDialog open={!!confirmHide} onOpenChange={(o) => !o && setConfirmHide(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Αφαίρεση από μενού;</AlertDialogTitle>
            <AlertDialogDescription>
              Σίγουρα θες να αφαιρέσεις το «{confirmHide?.label}» από το μενού;
              Μπορείς να το επαναφέρεις οποιαδήποτε στιγμή από το «Κρυμμένα στοιχεία».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Άκυρο</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmHide && hideItem(confirmHide.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Αφαίρεση
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hidden list */}
      <Dialog open={showHiddenDialog} onOpenChange={setShowHiddenDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Κρυμμένα στοιχεία μενού</DialogTitle>
            <DialogDescription>
              Επανέφερε όποιο στοιχείο θέλεις πίσω στο μενού.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {hiddenList.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Κανένα κρυμμένο στοιχείο.</p>
            )}
            {hiddenList.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3 p-2 rounded-lg border border-border hover:bg-muted/50">
                <div className="flex items-center gap-3 min-w-0">
                  <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{item.group}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => restoreItem(item.id)}>
                  Επαναφορά
                </Button>
              </div>
            ))}
          </div>
          {hiddenList.length > 1 && (
            <Button variant="outline" size="sm" onClick={restoreAll} className="gap-2">
              <RotateCcw className="h-4 w-4" /> Επαναφορά όλων
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AdminSidebar({
  activeSection, onSectionChange, pendingTickets, pendingWithdrawals,
  mobileOpen, onMobileOpenChange,
}: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  // If mobile-mode props are provided, render as a Sheet drawer
  if (typeof mobileOpen === 'boolean' && onMobileOpenChange) {
    return (
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="p-0 w-[260px]">
          <div className="h-full flex flex-col bg-card">
            <SidebarBody
              activeSection={activeSection}
              onSectionChange={(s) => { onSectionChange(s); onMobileOpenChange(false); }}
              pendingTickets={pendingTickets}
              pendingWithdrawals={pendingWithdrawals}
              collapsed={false}
              setCollapsed={() => {}}
              isMobile
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop fixed sidebar
  return (
    <aside
      className={cn(
        'h-screen sticky top-0 bg-card border-r border-border flex flex-col transition-all duration-300 z-30',
        collapsed ? 'w-[68px]' : 'w-[240px]',
      )}
    >
      <SidebarBody
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        pendingTickets={pendingTickets}
        pendingWithdrawals={pendingWithdrawals}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        isMobile={false}
      />
    </aside>
  );
}
