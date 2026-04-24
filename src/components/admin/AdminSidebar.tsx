import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3, ShoppingBag, Store, Users, Shield, Wallet,
  MessageSquare, Flame, Star, Megaphone, MapPin, Settings,
  Activity, Bell, ChevronLeft, ChevronRight, LayoutDashboard, DollarSign, Headphones,
  Flag, ShieldCheck, UserCog, Zap, ScrollText, PackagePlus, Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  pendingTickets?: number;
  pendingWithdrawals?: number;
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

export default function AdminSidebar({ activeSection, onSectionChange, pendingTickets = 0, pendingWithdrawals = 0 }: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const badges: Record<string, number> = {
    pendingTickets,
    pendingWithdrawals,
  };

  return (
    <aside
      className={cn(
        'h-screen sticky top-0 bg-card border-r border-border flex flex-col transition-all duration-300 z-30',
        collapsed ? 'w-[68px]' : 'w-[240px]'
      )}
    >
      {/* Logo / Brand */}
      <div className="h-16 flex items-center px-4 border-b border-border shrink-0">
        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shrink-0">
          <Shield className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="ml-3 overflow-hidden">
            <p className="font-heading font-bold text-sm leading-tight truncate">Admin Panel</p>
            <p className="text-[10px] text-muted-foreground truncate">Διαχείριση Πλατφόρμας</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 py-2">
        <nav className="px-2 space-y-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeSection === item.id;
                  const badgeCount = (item as any).badgeKey ? badges[(item as any).badgeKey] : 0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSectionChange(item.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                        isActive
                          ? 'bg-primary/10 text-primary shadow-sm'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Collapse toggle */}
      <div className="border-t border-border p-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
