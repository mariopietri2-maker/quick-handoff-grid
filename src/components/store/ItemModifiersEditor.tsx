import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Settings2, Wand2, ListPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Modifier {
  id: string;
  menu_item_id: string;
  group_name: string;
  option_name: string;
  price_delta: number;
  is_required: boolean;
  is_multi: boolean;
  sort_order: number;
}

type TemplateGroup = {
  group_name: string;
  is_required: boolean;
  is_multi: boolean;
  options: { option_name: string; price_delta: number }[];
};

/** Ready-made ingredient packs stores can apply in one click. */
const TEMPLATES: { id: string; label: string; description: string; groups: TemplateGroup[] }[] = [
  {
    id: 'crepa',
    label: 'Custom κρέπα',
    description: 'Βάση · Γέμιση · Τυριά · Σάλτσες',
    groups: [
      {
        group_name: 'Βάση',
        is_required: true,
        is_multi: false,
        options: [
          { option_name: 'Απλή',
            price_delta: 0 },
          { option_name: 'Ολικής',
            price_delta: 0.5 },
          { option_name: 'Χωρίς γλουτένη',
            price_delta: 1 },
        ],
      },
      {
        group_name: 'Γέμιση',
        is_required: true,
        is_multi: true,
        options: [
          { option_name: 'Ζαμπόν',
            price_delta: 0.8 },
          { option_name: 'Μπέικον',
            price_delta: 1 },
          { option_name: 'Γαλοπούλα',
            price_delta: 0.8 },
          { option_name: 'Κοτόπουλο',
            price_delta: 1.2 },
          { option_name: 'Σαλάμι',
            price_delta: 0.8 },
          { option_name: 'Μανιτάρια',
            price_delta: 0.5 },
          { option_name: 'Καλαμπόκι',
            price_delta: 0.4 },
          { option_name: 'Ντομάτα',
            price_delta: 0.3 },
        ],
      },
      {
        group_name: 'Τυριά',
        is_required: false,
        is_multi: true,
        options: [
          { option_name: 'Gouda',
            price_delta: 0.5 },
          { option_name: 'Edam',
            price_delta: 0.5 },
          { option_name: 'Mozzarella',
            price_delta: 0.6 },
          { option_name: 'Cream cheese',
            price_delta: 0.7 },
        ],
      },
      {
        group_name: 'Σάλτσες',
        is_required: false,
        is_multi: true,
        options: [
          { option_name: 'Κέτσαπ',
            price_delta: 0 },
          { option_name: 'Μουστάρδα',
            price_delta: 0 },
          { option_name: 'Mayo',
            price_delta: 0 },
          { option_name: 'BBQ',
            price_delta: 0.3 },
          { option_name: 'Sweet chili',
            price_delta: 0.3 },
        ],
      },
    ],
  },
  {
    id: 'burger',
    label: 'Custom burger',
    description: 'Μέγεθος · Κρέας · Τυριά · Extras',
    groups: [
      {
        group_name: 'Μέγεθος',
        is_required: true,
        is_multi: false,
        options: [
          { option_name: 'Single',
            price_delta: 0 },
          { option_name: 'Double',
            price_delta: 2.5 },
        ],
      },
      {
        group_name: 'Κρέας',
        is_required: true,
        is_multi: false,
        options: [
          { option_name: 'Μοσχάρι',
            price_delta: 0 },
          { option_name: 'Κοτόπουλο',
            price_delta: 0 },
          { option_name: 'Vegan',
            price_delta: 1 },
        ],
      },
      {
        group_name: 'Extras',
        is_required: false,
        is_multi: true,
        options: [
          { option_name: 'Bacon',
            price_delta: 1 },
          { option_name: 'Αυγό',
            price_delta: 0.8 },
          { option_name: 'Καραμελωμένα κρεμμύδια',
            price_delta: 0.5 },
          { option_name: 'Pickles',
            price_delta: 0.3 },
        ],
      },
    ],
  },
  {
    id: 'pizza',
    label: 'Custom πίτσα',
    description: 'Μέγεθος · Ζύμη · Υλικά',
    groups: [
      {
        group_name: 'Μέγεθος',
        is_required: true,
        is_multi: false,
        options: [
          { option_name: 'Μικρή',
            price_delta: 0 },
          { option_name: 'Μεσαία',
            price_delta: 2 },
          { option_name: 'Μεγάλη',
            price_delta: 4 },
        ],
      },
      {
        group_name: 'Ζύμη',
        is_required: true,
        is_multi: false,
        options: [
          { option_name: 'Κλασική',
            price_delta: 0 },
          { option_name: 'Ολικής',
            price_delta: 1 },
          { option_name: 'Χωρίς γλουτένη',
            price_delta: 2 },
        ],
      },
      {
        group_name: 'Υλικά',
        is_required: false,
        is_multi: true,
        options: [
          { option_name: 'Μπέικον',
            price_delta: 1.2 },
          { option_name: 'Πέπερονι',
            price_delta: 1 },
          { option_name: 'Μανιτάρια',
            price_delta: 0.8 },
          { option_name: 'Πιπεριά',
            price_delta: 0.6 },
          { option_name: 'Ελιές',
            price_delta: 0.6 },
          { option_name: 'Extra τυρί',
            price_delta: 1.5 },
        ],
      },
    ],
  },
];

export default function ItemModifiersEditor({
  menuItemId,
  itemName,
}: {
  menuItemId: string;
  itemName: string;
}) {
  const [open, setOpen] = useState(false);
  const [mods, setMods] = useState<Modifier[]>([]);
  const [busy, setBusy] = useState(false);

  // Single option form
  const [groupName, setGroupName] = useState('Υλικά');
  const [optionName, setOptionName] = useState('');
  const [priceDelta, setPriceDelta] = useState('0');
  const [isRequired, setIsRequired] = useState(false);
  const [isMulti, setIsMulti] = useState(true);

  // Bulk add (one ingredient per line)
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);

  const load = async () => {
    const { data } = await (supabase as any)
      .from('menu_item_modifiers')
      .select('*')
      .eq('menu_item_id', menuItemId)
      .order('sort_order', { ascending: true });
    setMods((data ?? []) as Modifier[]);
  };

  useEffect(() => {
    if (open) void load();
  }, [open, menuItemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => {
    const map: Record<string, Modifier[]> = {};
    mods.forEach((m) => {
      (map[m.group_name] ??= []).push(m);
    });
    return map;
  }, [mods]);

  const groupCount = Object.keys(grouped).length;

  const insertRows = async (
    rows: {
      group_name: string;
      option_name: string;
      price_delta: number;
      is_required: boolean;
      is_multi: boolean;
      sort_order: number;
    }[],
  ) => {
    if (!rows.length) return;
    setBusy(true);
    const { error } = await (supabase as any).from('menu_item_modifiers').insert(
      rows.map((r) => ({ ...r, menu_item_id: menuItemId })),
    );
    setBusy(false);
    if (error) {
      toast.error('Αποτυχία αποθήκευσης');
      console.error(error);
      return false;
    }
    await load();
    return true;
  };

  const addOne = async () => {
    const name = optionName.trim();
    if (!name) {
      toast.error('Γράψε όνομα υλικού');
      return;
    }
    const ok = await insertRows([
      {
        group_name: groupName.trim() || 'Υλικά',
        option_name: name,
        price_delta: Number(priceDelta) || 0,
        is_required: isRequired,
        is_multi: isMulti,
        sort_order: mods.length,
      },
    ]);
    if (ok) {
      toast.success('Προστέθηκε');
      setOptionName('');
    }
  };

  const addBulk = async () => {
    const lines = bulkText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!lines.length) {
      toast.error('Γράψε υλικά (ένα ανά γραμμή)');
      return;
    }
    const ok = await insertRows(
      lines.map((option_name, i) => ({
        group_name: groupName.trim() || 'Υλικά',
        option_name,
        price_delta: Number(priceDelta) || 0,
        is_required: isRequired,
        is_multi: isMulti,
        sort_order: mods.length + i,
      })),
    );
    if (ok) {
      toast.success(`${lines.length} υλικά προστέθηκαν`);
      setBulkText('');
      setShowBulk(false);
    }
  };

  const applyTemplate = async (templateId: string) => {
    const tpl = TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    if (mods.length > 0) {
      const ok = window.confirm(
        `Θα προστεθούν οι επιλογές «${tpl.label}» στο υπάρχον μενού. Συνέχεια;`,
      );
      if (!ok) return;
    }
    const rows: {
      group_name: string;
      option_name: string;
      price_delta: number;
      is_required: boolean;
      is_multi: boolean;
      sort_order: number;
    }[] = [];
    let order = mods.length;
    for (const g of tpl.groups) {
      for (const o of g.options) {
        rows.push({
          group_name: g.group_name,
          option_name: o.option_name,
          price_delta: o.price_delta,
          is_required: g.is_required,
          is_multi: g.is_multi,
          sort_order: order++,
        });
      }
    }
    const ok = await insertRows(rows);
    if (ok) toast.success(`Πρότυπο «${tpl.label}» εφαρμόστηκε`);
  };

  const remove = async (id: string) => {
    await (supabase as any).from('menu_item_modifiers').delete().eq('id', id);
    await load();
  };

  const removeGroup = async (group: string) => {
    const ids = (grouped[group] ?? []).map((m) => m.id);
    if (!ids.length) return;
    if (!window.confirm(`Διαγραφή όλης της ομάδας «${group}»;`)) return;
    await (supabase as any).from('menu_item_modifiers').delete().in('id', ids);
    await load();
  };

  const updatePrice = async (id: string, value: string) => {
    const price_delta = Number(value);
    if (Number.isNaN(price_delta)) return;
    await (supabase as any).from('menu_item_modifiers').update({ price_delta }).eq('id', id);
    setMods((prev) => prev.map((m) => (m.id === id ? { ...m, price_delta } : m)));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-9 gap-1.5 px-2.5 text-xs font-bold"
          title="Υλικά & επιλογές (custom προϊόν)"
        >
          <Settings2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Υλικά</span>
          {mods.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-extrabold">
              {mods.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">
            Υλικά & επιλογές — {itemName}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Ο πελάτης επιλέγει υλικά όταν προσθέτει το προϊόν στο καλάθι. Ιδανικό για custom
            κρέπα, burger, πίτσα.
          </p>
        </DialogHeader>

        {/* Templates */}
        <div className="space-y-2">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Wand2 className="h-3.5 w-3.5" /> Γρήγορα πρότυπα
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                disabled={busy}
                onClick={() => void applyTemplate(tpl.id)}
                className="text-left rounded-xl border border-border bg-muted/40 hover:bg-muted px-3 py-2.5 transition disabled:opacity-50"
              >
                <div className="text-sm font-extrabold leading-tight">{tpl.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{tpl.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Existing groups */}
        <div className="space-y-3 max-h-56 overflow-y-auto border rounded-xl p-3 bg-muted/20">
          {groupCount === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              Δεν υπάρχουν επιλογές ακόμα. Διάλεξε πρότυπο ή πρόσθεσε υλικά παρακάτω.
            </p>
          )}
          {Object.entries(grouped).map(([g, items]) => (
            <div key={g} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                  {g}{' '}
                  <span className="font-semibold normal-case tracking-normal text-[10px] opacity-80">
                    · {items[0]?.is_required ? 'υποχρεωτικό' : 'προαιρετικό'}
                    {items[0]?.is_multi ? ' · πολλαπλή' : ' · μία επιλογή'}
                  </span>
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px] text-destructive"
                  onClick={() => void removeGroup(g)}
                >
                  Διαγραφή ομάδας
                </Button>
              </div>
              {items.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 bg-background rounded-lg border px-2.5 py-1.5"
                >
                  <span className="text-sm font-semibold flex-1 min-w-0 truncate">{m.option_name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[11px] text-muted-foreground">+</span>
                    <Input
                      type="number"
                      step="0.10"
                      className="h-7 w-16 text-xs"
                      defaultValue={Number(m.price_delta).toFixed(2)}
                      onBlur={(e) => void updatePrice(m.id, e.target.value)}
                    />
                    <span className="text-[11px] text-muted-foreground">€</span>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => void remove(m.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Add form */}
        <div className="border-t pt-3 space-y-2.5">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
            Νέο υλικό / επιλογή
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Ομάδα</Label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="π.χ. Γέμιση, Σάλτσες"
                list="mod-group-suggestions"
              />
              <datalist id="mod-group-suggestions">
                {Object.keys(grouped).map((g) => (
                  <option key={g} value={g} />
                ))}
                <option value="Βάση" />
                <option value="Γέμιση" />
                <option value="Τυριά" />
                <option value="Σάλτσες" />
                <option value="Μέγεθος" />
                <option value="Extras" />
              </datalist>
            </div>
            <div>
              <Label className="text-xs">Όνομα υλικού</Label>
              <Input
                value={optionName}
                onChange={(e) => setOptionName(e.target.value)}
                placeholder="π.χ. Μπέικον"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void addOne();
                  }
                }}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Επιπλέον τιμή (€) — 0 αν είναι δωρεάν</Label>
            <Input
              type="number"
              step="0.10"
              value={priceDelta}
              onChange={(e) => setPriceDelta(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Υποχρεωτική ομάδα</span>
            <Switch checked={isRequired} onCheckedChange={setIsRequired} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Πολλαπλή επιλογή (ο πελάτης διαλέγει πολλά)</span>
            <Switch checked={isMulti} onCheckedChange={setIsMulti} />
          </div>
          <Button onClick={() => void addOne()} disabled={busy} className="w-full">
            <Plus className="h-4 w-4 mr-1" /> Προσθήκη υλικού
          </Button>

          <button
            type="button"
            className="text-xs font-bold text-primary flex items-center gap-1"
            onClick={() => setShowBulk((v) => !v)}
          >
            <ListPlus className="h-3.5 w-3.5" />
            {showBulk ? 'Απόκρυψη μαζικής προσθήκης' : 'Μαζική προσθήκη (πολλά υλικά)'}
          </button>
          {showBulk && (
            <div className="space-y-2 rounded-xl border p-3 bg-muted/30">
              <Label className="text-xs">
                Υλικά στην ομάδα «{groupName || 'Υλικά'}» — ένα ανά γραμμή (ή κόμμα)
              </Label>
              <Textarea
                rows={4}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={'Ζαμπόν\nΜπέικον\nΜανιτάρια\nGouda'}
              />
              <Button onClick={() => void addBulk()} disabled={busy} variant="secondary" className="w-full">
                Προσθήκη όλων
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
