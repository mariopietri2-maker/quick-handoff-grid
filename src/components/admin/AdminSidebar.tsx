import {
  LayoutDashboard, ShoppingBag, Store, Users, Wallet, Settings2,
  ChevronLeft, ChevronRight, LogOut, Shield, UserCircle, Repeat, Bike, ShoppingCart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  pendingTickets?: number;
  pendingWithdrawals?: number;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

/**
 * Bare-essentials nav: 6 top-level sections.
 * Each section maps to a default sub-tab (rendered in the page header).
 */
export const NAV_SECTIONS = [
  {
    id: 'dashboard',
    label: 'Πίνακας',
    icon: LayoutDashboard,
    accent: 'text-info',
    accentBg: 'bg-info/10',
    defaultTab: 'overview',
    tabs: [
      { id: 'overview', label: 'Live Ops' },
      { id: 'analytics', label: 'Αναλυτικά' },
    ],
  },
  {
    id: 'orders',
    label: 'Παραγγελίες',
    icon: ShoppingBag,
    accent: 'text-primary',
    accentBg: 'bg-primary/10',
    defaultTab: 'orders',
    tabs: [
      { id: 'orders', label: 'Pipeline (Kanban)' },
      { id: 'orders_table', label: 'Πίνακας' },
      { id: 'external_orders', label: 'eFood / Wolt' },
    ],
  },
  {
    id: 'stores',
    label: 'Καταστήματα',
    icon: Store,
    accent: 'text-warning',
    accentBg: 'bg-warning/10',
    defaultTab: 'stores',
    tabs: [
      { id: 'stores', label: 'Καταστήματα' },
      { id: 'promotions', label: 'Προωθήσεις' },
      { id: 'reviews', label: 'Κριτικές' },
    ],
  },
  {
    id: 'drivers',
    label: 'Οδηγοί',
    icon: Users,
    accent: 'text-info',
    accentBg: 'bg-info/10',
    defaultTab: 'drivers',
    tabs: [
      { id: 'drivers', label: 'Οδηγοί' },
      { id: 'driver_map_editor', label: 'Χάρτης οδηγών' },
    ],
  },
  {
    id: 'money',
    label: 'Οικονομικά',
    icon: Wallet,
    accent: 'text-success',
    accentBg: 'bg-success/10',
    defaultTab: 'ledger',
    tabs: [
      { id: 'ledger', label: 'Καθολικό κινήσεων' },
      { id: 'driver_basket', label: 'Driver Basket' },
      { id: 'surge', label: 'Surge' },
      { id: 'store_payables', label: 'Πληρωμές καταστημάτων' },
      { id: 'driver_payables', label: 'Πληρωμές οδηγών' },
      { id: 'pricing', label: 'Τιμολόγηση' },
      { id: 'store_billing', label: 'Χρέωση' },
      { id: 'tickets', label: 'Support', badgeKey: 'pendingTickets' as const },
    ],
  },
  {
    id: 'settings',
    label: 'Ρυθμίσεις',
    icon: Settings2,
    accent: 'text-muted-foreground',
    accentBg: 'bg-muted',
    defaultTab: 'users',
    tabs: [
      { id: 'users', label: 'Χρήστες' },
      { id: 'admin_perms', label: 'Δικαιώματα' },
      { id: 'support_roles', label: 'Support agents' },
      { id: 'feature_flags', label: 'Feature flags' },
      { id: 'overrides', label: 'Surge / Overrides' },
      { id: 'announcements', label: 'Ανακοινώσεις' },
      { id: 'canned_replies', label: 'Έτοιμες απαντήσεις' },
      { id: 'audit', label: 'Audit log' },
      { id: 'remote_actions', label: 'Remote actions' },
      { id: 'system_reset', label: '⚠ System reset' },
    ],
  },
] as const;

/** Map any sub-tab id back to its parent section id (for highlighting). */
export function findParentSection(tabId: string): string {
  for (const sec of NAV_SECTIONS) {
    if (sec.tabs.some(t => t.id === tabId)) return sec.id;
  }
  return 'dashboard';
}

/** Get tab list for a given parent section id. */
export function getTabsForSection(sectionId: string) {
  return NAV_SECTIONS.find(s => s.id === sectionId)?.tabs ?? [];
}

function SidebarBody({
  activeSection, onSectionChange, pendingTickets = 0,
  collapsed, setCollapsed, isMobile,
}: {
  activeSection: string;
  onSectionChange: (s: string) => void;
  pendingTickets?: number;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  isMobile: boolean;
}) {
  const activeParent = findParentSection(activeSection);

  return (
    <>
      {/* Brand */}
      <div className="h-14 flex items-center px-4 border-b border-border shrink-0">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 shadow-sm">
          <Shield className="h-4 w-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="ml-3 overflow-hidden">
            <p className="font-heading font-bold text-sm leading-tight truncate">Admin</p>
            <p className="text-[10.5px] text-muted-foreground truncate leading-tight">Πλατφόρμα</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 py-3">
        <nav className="px-2 space-y-1">
          {NAV_SECTIONS.map((sec) => {
            const isActive = activeParent === sec.id;
            const showBadge = sec.id === 'money' && pendingTickets > 0;
            return (
              <button
                key={sec.id}
                onClick={() => onSectionChange(sec.defaultTab)}
                title={collapsed ? sec.label : undefined}
                className={cn(
                  'group w-full flex items-center gap-3 rounded-lg transition-all',
                  collapsed ? 'h-10 px-2 justify-center' : 'h-11 px-3',
                  isActive
                    ? 'bg-card border border-border shadow-sm'
                    : 'hover:bg-muted/60',
                )}
              >
                <span
                  className={cn(
                    'h-8 w-8 rounded-md flex items-center justify-center shrink-0 transition-colors',
                    isActive ? sec.accentBg : 'bg-transparent group-hover:bg-muted',
                  )}
                >
                  <sec.icon className={cn('h-4 w-4', isActive ? sec.accent : 'text-muted-foreground')} />
                </span>
                {!collapsed && (
                  <>
                    <span className={cn(
                      'flex-1 text-left text-[13px] font-medium truncate',
                      isActive ? 'text-foreground' : 'text-muted-foreground',
                    )}>
                      {sec.label}
                    </span>
                    {showBadge && (
                      <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-[10px]">
                        {pendingTickets}
                      </Badge>
                    )}
                  </>
                )}
                {collapsed && showBadge && (
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-destructive" />
                )}
              </button>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-border p-2 shrink-0 space-y-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost" size="sm"
              className={cn('w-full gap-2', collapsed ? 'justify-center px-0' : 'justify-start')}
              title={collapsed ? 'Εναλλαγή προβολής' : undefined}
            >
              <Repeat className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="text-xs">Εναλλαγή προβολής</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuLabel className="text-xs">Άνοιξε ως</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { window.location.href = '/admin'; }}>
              <Shield className="h-4 w-4 mr-2" /> Admin
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { window.location.href = '/driver'; }}>
              <Bike className="h-4 w-4 mr-2" /> Οδηγός
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { window.location.href = '/'; }}>
              <ShoppingCart className="h-4 w-4 mr-2" /> Πελάτης
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost" size="sm"
          className={cn('w-full gap-2', collapsed ? 'justify-center px-0' : 'justify-start')}
          onClick={() => { window.location.href = '/profile'; }}
        >
          <UserCircle className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="text-xs">Το προφίλ μου</span>}
        </Button>
        {!isMobile && (
          <Button
            variant="ghost" size="sm"
            className="w-full justify-center"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </>
  );
}

export default function AdminSidebar({
  activeSection, onSectionChange, pendingTickets,
  mobileOpen, onMobileOpenChange,
}: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (typeof mobileOpen === 'boolean' && onMobileOpenChange) {
    return (
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="p-0 w-[260px]">
          <div className="h-full flex flex-col bg-card">
            <SidebarBody
              activeSection={activeSection}
              onSectionChange={(s) => { onSectionChange(s); onMobileOpenChange(false); }}
              pendingTickets={pendingTickets}
              collapsed={false}
              setCollapsed={() => {}}
              isMobile
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className={cn(
        'h-screen sticky top-0 bg-card border-r border-border flex flex-col transition-all duration-300 z-30',
        collapsed ? 'w-[72px]' : 'w-[224px]',
      )}
    >
      <SidebarBody
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        pendingTickets={pendingTickets}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        isMobile={false}
      />
    </aside>
  );
}
