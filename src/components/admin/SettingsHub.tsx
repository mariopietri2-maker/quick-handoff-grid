import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Search, X, ChevronRight } from 'lucide-react';
import {
  Users, ShieldCheck, Headphones, Zap, Palette, Sparkles, Megaphone, MessageSquareText,
  SlidersHorizontal, Shield, Stethoscope, Activity, Cloud, FileCheck, TriangleAlert, Flag, Gauge,
  Link2, Truck,
} from 'lucide-react';

type Entry = { id: string; label: string; desc: string; icon: any; accent: string; danger?: boolean };

interface Category {
  id: string;
  label: string;
  accent: string;       // card edge color
  iconBg: string;       // tile background tint
  iconFg: string;       // tile icon color
  items: Entry[];
}

const CATEGORIES: Category[] = [
  {
    id: 'people', label: 'Άνθρωποι & Πρόσβαση', accent: '#2563eb', iconBg: 'bg-blue-500/10', iconFg: 'text-blue-600',
    items: [
      { id: 'users', label: 'Χρήστες', desc: 'Διαχείρηση λογαριασμών, ρόλων και κατάστασης χρηστών.', icon: Users, accent: '#2563eb' },
      { id: 'admin_perms', label: 'Δικαιώματα', desc: 'Ρόλοι & επίπεδα πρόσβασης διαχειριστών.', icon: ShieldCheck, accent: '#2563eb' },
      { id: 'support_roles', label: 'Support agents', desc: 'Ομάδα υποστήριξης & αναθέσεις ρόλων.', icon: Headphones, accent: '#2563eb' },
      { id: 'remote_actions', label: 'Remote actions', desc: 'Απομακρυσμένες ενέργειες σε χρήστες.', icon: Zap, accent: '#2563eb' },
    ],
  },
  {
    id: 'customer', label: 'Εφαρμογή πελάτη', accent: '#d97706', iconBg: 'bg-orange-500/10', iconFg: 'text-orange-600',
    items: [
      { id: 'customer_app_config', label: 'Customer app', desc: 'Προσαρμογή εμφάνισης & περιεχομένου για πελάτες.', icon: Palette, accent: '#d97706' },
      { id: 'ai_hero_cards', label: 'AI Cards & Motion', desc: 'Δυναμικές κάρτες & κινήσεις στην αρχική οθόνη.', icon: Sparkles, accent: '#d97706' },
      { id: 'announcements', label: 'Ανακοινώσεις', desc: 'Στιγμιαίες ανακοινώσεις σε όλα τα κανάλια.', icon: Megaphone, accent: '#d97706' },
      { id: 'canned_replies', label: 'Έτοιμες απαντήσεις', desc: 'Πρότυπα απαντήσεων για ταχύτερο support.', icon: MessageSquareText, accent: '#d97706' },
    ],
  },
  {
    id: 'ops', label: 'Λειτουργία & Ανάπτυξη', accent: '#059669', iconBg: 'bg-emerald-500/10', iconFg: 'text-emerald-600',
    items: [
      { id: 'feature_flags', label: 'Feature flags', desc: 'Ενεργοποίηση/απενεργοποίηση λειτουργιών.', icon: Flag, accent: '#059669' },
      { id: 'platform_mode', label: 'Marketplace & Delivery', desc: 'Delivery on/off, χρόνοι παράδοσης & ποιος παραδίδει ανά κατάστημα.', icon: Truck, accent: '#059669' },
      { id: 'api_connections', label: 'API Συνδέσεις', desc: 'Σύνδεση με άλλη πλατφόρμα: λήψη παραγγελιών & αποστολή status.', icon: Link2, accent: '#059669' },
      { id: 'overrides', label: 'Operational overrides', desc: 'Παρακάμψεις λειτουργίας σε πραγματικό χρόνο.', icon: SlidersHorizontal, accent: '#059669' },
      { id: 'mission_control', label: 'Mission Control', desc: 'Κεντρικός έλεγχος κρίσιμων λειτουργιών.', icon: Shield, accent: '#059669' },
      { id: 'system_doctor', label: 'System Doctor', desc: 'Αυτόματη διάγνωση & διόρθωση προβλημάτων.', icon: Stethoscope, accent: '#059669' },
      { id: 'cloud_usage', label: 'Cloud usage', desc: 'Κατανάλωση πόρων & καθαρισμός δεδομένων.', icon: Cloud, accent: '#059669' },
    ],
  },
  {
    id: 'system', label: 'Σύστημα & Συμμόρφωση', accent: '#7c3aed', iconBg: 'bg-violet-500/10', iconFg: 'text-violet-600',
    items: [
      { id: 'aade_compliance', label: 'ΑΑΔΕ / myDATA', desc: 'Φορολογική συμμόρφωση & αναφορές.', icon: FileCheck, accent: '#7c3aed' },
      { id: 'system_health', label: 'Κατάσταση συστήματος', desc: 'Υγεία υπηρεσιών & εξαρτήσεων.', icon: Activity, accent: '#7c3aed' },
      { id: 'platform_cost', label: 'Κόστος πλατφόρμας', desc: 'Έξοδα υποδομής & υπηρεσιών.', icon: Gauge, accent: '#7c3aed' },
      { id: 'audit', label: 'Audit log', desc: 'Καταγραφή ενεργειών διαχειριστών.', icon: FileCheck, accent: '#7c3aed' },
      { id: 'system_reset', label: 'System reset', desc: 'Πλήκρη επαναφορά δεδομένων συστήματος.', icon: TriangleAlert, accent: '#dc2626', danger: true },
    ],
  },
];

export default function AdminSettingsHub({ onNavigate }: { onNavigate: (id: string) => void }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading font-bold text-xl">Ρυθμίσεις</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Δικαιώματα, λειτουργία και συμμόρφωση της πλατφόρμας σε έναν χώρο.
          </p>
        </div>
        <div className="relative w-56 sm:w-64">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Αναζήτηση ρυθμίσεων…"
            className="h-8 pl-7 pr-7 text-[12px] rounded-full bg-muted/40 border-border/60 focus:bg-background"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {CATEGORIES.map((cat) => {
        const items = cat.items.filter((it) =>
          !query || (it.label + ' ' + it.desc).toLowerCase().includes(query),
        );
        if (query && items.length === 0) return null;
        return (
          <section key={cat.id} style={{ ['--cat' as any]: cat.accent }}>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="h-3.5 w-[3px] rounded-full" style={{ background: cat.accent }} />
              <h3 className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{cat.label}</h3>
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-px text-[10.5px] font-semibold text-muted-foreground">
                {items.length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => onNavigate(it.id)}
                  className="group relative text-left rounded-xl border bg-card p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden"
                >
                  <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: it.accent }} />
                  <div className="flex items-center gap-2.5">
                    <span className={cn('h-9 w-9 rounded-lg grid place-items-center shrink-0', it.danger ? 'bg-red-500/10 text-red-600' : cat.iconBg + ' ' + cat.iconFg)}>
                      <it.icon className="h-[17px] w-[17px]" />
                    </span>
                    <span className="font-heading font-semibold text-[13.5px]">{it.label}</span>
                  </div>
                  <p className="text-[11.5px] text-muted-foreground mt-2 leading-snug min-h-[30px]">{it.desc}</p>
                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/60">
                    <span className={cn('text-[10.5px] font-semibold', it.danger ? 'text-red-600' : 'text-success')}>
                      {it.danger ? '⚠ Προσοχή' : 'Άνοιγμα'}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {(
        (() => { // empty-state when nothing matches
          const any = CATEGORIES.some((c) => c.items.some((it) => (it.label + ' ' + it.desc).toLowerCase().includes(query)));
          return query && !any;
        })()
      ) && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="font-heading font-semibold text-[15px] text-foreground mb-1">Δεν βρέθηκαν ρυθμίσεις</p>
          Δοκίμασε διαφορετικούς όρους αναζήτησης.
        </div>
      )}
    </div>
  );
}