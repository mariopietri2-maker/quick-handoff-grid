import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { CartModifier } from '@/hooks/useCart';
import { cn } from '@/lib/utils';

type ModRow = {
  id: string;
  group_name: string;
  option_name: string;
  price_delta: number;
  is_required: boolean;
  is_multi: boolean;
  sort_order: number;
};

type Group = {
  name: string;
  required: boolean;
  multi: boolean;
  options: ModRow[];
};

type Props = {
  menuItemId: string;
  itemName: string;
  basePrice: number;
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    modifiers: CartModifier[];
    unitPrice: number;
    labelSuffix: string;
  }) => void;
};

export function ModifierSheet({
  menuItemId,
  itemName,
  basePrice,
  open,
  onClose,
  onConfirm,
}: Props) {
  const [rows, setRows] = useState<ModRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setSelected({});
    (async () => {
      const { data } = await (supabase as any)
        .from('menu_item_modifiers')
        .select('id, group_name, option_name, price_delta, is_required, is_multi, sort_order')
        .eq('menu_item_id', menuItemId)
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      setRows((data ?? []) as ModRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, menuItemId]);

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const r of rows) {
      const g = map.get(r.group_name) ?? {
        name: r.group_name,
        required: !!r.is_required,
        multi: !!r.is_multi,
        options: [],
      };
      g.required = g.required || !!r.is_required;
      g.multi = g.multi || !!r.is_multi;
      g.options.push(r);
      map.set(r.group_name, g);
    }
    return [...map.values()];
  }, [rows]);

  const toggle = (group: Group, optionId: string) => {
    setSelected((prev) => {
      const cur = prev[group.name] ?? [];
      if (group.multi) {
        const next = cur.includes(optionId)
          ? cur.filter((id) => id !== optionId)
          : [...cur, optionId];
        return { ...prev, [group.name]: next };
      }
      return { ...prev, [group.name]: cur[0] === optionId ? [] : [optionId] };
    });
  };

  const missingRequired = groups.filter(
    (g) => g.required && !(selected[g.name] && selected[g.name].length > 0),
  );

  const chosen = useMemo(() => {
    const mods: CartModifier[] = [];
    let extra = 0;
    for (const g of groups) {
      for (const id of selected[g.name] ?? []) {
        const opt = g.options.find((o) => o.id === id);
        if (!opt) continue;
        mods.push({
          groupName: g.name,
          optionName: opt.option_name,
          priceDelta: Number(opt.price_delta) || 0,
        });
        extra += Number(opt.price_delta) || 0;
      }
    }
    return { mods, extra };
  }, [groups, selected]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Κλείσιμο"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md max-h-[85dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[hsl(var(--c-surface))] shadow-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h2 className="font-heading font-extrabold text-lg c-ink truncate">{itemName}</h2>
            <p className="text-sm c-soft tabular-nums">{basePrice.toFixed(2)}€ βάση</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-[hsl(var(--c-surface-muted))] flex items-center justify-center shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm c-soft">Φόρτωση επιλογών…</div>
        ) : groups.length === 0 ? (
          <div className="py-8 text-center text-sm c-soft">Δεν υπάρχουν επιλογές</div>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.name}>
                <p className="font-heading font-bold text-[13px] c-ink mb-2">
                  {g.name}
                  {g.required && (
                    <span className="ml-1.5 text-[11px] font-semibold text-primary">Υποχρεωτικό</span>
                  )}
                </p>
                <div className="space-y-1.5">
                  {g.options.map((o) => {
                    const on = (selected[g.name] ?? []).includes(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => toggle(g, o.id)}
                        className={cn(
                          'w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] transition-colors',
                          on
                            ? 'border-primary bg-primary/10 font-semibold'
                            : 'border-[hsl(var(--c-border))] bg-[hsl(var(--c-surface))]',
                        )}
                      >
                        <span className="c-ink">{o.option_name}</span>
                        <span className="tabular-nums c-soft shrink-0">
                          {Number(o.price_delta) > 0
                            ? `+${Number(o.price_delta).toFixed(2)}€`
                            : Number(o.price_delta) < 0
                              ? `${Number(o.price_delta).toFixed(2)}€`
                              : 'Δωρεάν'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          disabled={loading || missingRequired.length > 0}
          onClick={() => {
            if (missingRequired.length) return;
            const suffix = chosen.mods.map((m) => m.optionName).join(', ');
            onConfirm({
              modifiers: chosen.mods,
              unitPrice: basePrice + chosen.extra,
              labelSuffix: suffix,
            });
          }}
          className="mt-5 w-full h-12 rounded-2xl bg-primary text-primary-foreground font-heading font-extrabold text-[15px] disabled:opacity-50"
        >
          Προσθήκη · {(basePrice + chosen.extra).toFixed(2)}€
        </button>
      </div>
    </div>
  );
}

/** Returns true if the menu item has at least one modifier row. */
export async function itemHasModifiers(menuItemId: string): Promise<boolean> {
  const { count } = await (supabase as any)
    .from('menu_item_modifiers')
    .select('id', { count: 'exact', head: true })
    .eq('menu_item_id', menuItemId);
  return (count ?? 0) > 0;
}
