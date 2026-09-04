import { useState } from 'react';
import { Sparkles, Loader2, FilePlus2, Import, ChevronDown, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useMenuItems } from '@/hooks/useMenuItems';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ImportItem {
  key: string;
  name: string;
  price: string;
  category: string;
  description: string;
}

interface Props {
  storeId: string;
}

/** One-paste migrate-from-eFood: paste a menu snippet and bulk-import dishes. */
export default function MenuImportFromReceipt({ storeId }: Props) {
  const { refetch } = useMenuItems(storeId);
  const [open, setOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [forceImport, setForceImport] = useState(false);

  const handleParse = async () => {
    if (!pasteText.trim()) return toast.error('Επικόλλησε μενού πρώτα');
    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-receipt', {
        body: { text: pasteText, mode: 'menu' },
      });
      if (error) throw error;
      const d = data?.data ?? {};
      const rows = Array.isArray(d.menu_items) ? d.menu_items : [];
      if (rows.length === 0) {
        toast.error('Δεν εντοπίστηκαν προϊόντα. Επικόλλησε τη λίστα μενού με τιμές.');
        setItems([]);
        return;
      }
      setItems(
        rows.map((r: any, i: number) => ({
          key: `r${i}-${Date.now()}`,
          name: String(r?.name ?? '').trim(),
          price: r?.price != null ? String(Number(r.price)) : '0',
          category: String(r?.category ?? '').trim(),
          description: String(r?.description ?? '').trim(),
        })),
      );
      toast.success(`Εξήχθησαν ${rows.length} προϊόντα — έλεγξε & εισήγαγε`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Αποτυχία ανάλυσης');
    } finally {
      setParsing(false);
    }
  };

  const patch = (key: string, field: keyof ImportItem, value: string) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, [field]: value } : it)));

  const remove = (key: string) => setItems((prev) => prev.filter((it) => it.key !== key));

  const handleImport = async () => {
    const valid = items.filter((it) => it.name.trim() && Number(it.price) > 0);
    if (valid.length === 0) return toast.error('Δεν υπάρχουν έγκυρα προϊόντα');
    const rows = valid.map((it) => ({
      store_id: storeId,
      name: it.name.trim(),
      price: Number(it.price),
      category: it.category.trim() || null,
      description: it.description.trim() || null,
    }));

    setImporting(true);
    const { error } = await supabase.from('menu_items').insert(rows);
    setImporting(false);

    if (error) {
      toast.error(error.message ?? 'Αποτυχία εισαγωγής');
      return;
    }

    const added = rows.length;
    if (added < items.length) {
      toast.info(`Εισήχθησαν ${added} από ${items.length} προϊόντα (μερικά είχαν μηδενική τιμή)`);
    } else {
      toast.success(`Εισήχθησαν ${added} προϊόντα στο μενού`);
    }
    setItems([]);
    setPasteText('');
    setOpen(false);
    void refetch();
  };

  const total = items.length;
  const validCount = items.filter((it) => it.name.trim() && Number(it.price) > 0).length;

  return (
    <Card className="border-dashed border-primary/40 bg-primary/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FilePlus2 className="h-4 w-4" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-heading font-bold text-foreground">
            Εισαγωγή μενού από eFood / Wolt / Box
          </span>
          <span className="block text-[11.5px] text-muted-foreground">
            Επικόλλησε τη λίστα μενού και εισήγαγε όλα τα προϊόντα με μία κίνηση
          </span>
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <CardContent className="px-4 pb-4 space-y-3">
          <Textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={4}
            className="text-xs font-mono"
            placeholder={'Παράδειγμα:\n— Πίτσες —\nΜαργαρίτα 8.50\nPeperoni 9.90\n— Σαλάτες —\nΧωριάτικη 6.00'}
          />
          <Button
            onClick={handleParse}
            disabled={parsing || !pasteText.trim()}
            className="w-full gap-2"
          >
            {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Ανάλυση με AI
          </Button>

          {items.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                <span className="font-heading font-semibold text-foreground">
                  {total} προϊόντα · {validCount} έτοιμα προς εισαγωγή
                </span>
                <span className="flex items-center gap-1.5">
                  <label className="flex items-center gap-1.5 text-[11px]" htmlFor="force-import">
                    Εισαγωγή και με μηδενική τιμή
                    <Switch
                      id="force-import"
                      checked={forceImport}
                      onCheckedChange={setForceImport}
                      className="scale-75"
                    />
                  </label>
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border/60">
                {items.map((it) => {
                  const valid = it.name.trim() && Number(it.price) > 0;
                  const shouldSkip = !valid && !forceImport;
                  return (
                    <div
                      key={it.key}
                      className={cn('px-2.5 py-2 space-y-1.5', shouldSkip && 'opacity-45')}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1fr,110px] gap-1.5">
                          <Input
                            value={it.name}
                            onChange={(e) => patch(it.key, 'name', e.target.value)}
                            className="h-8 text-[12.5px]"
                            placeholder="Όνομα προϊόντος"
                          />
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={it.price}
                            onChange={(e) => patch(it.key, 'price', e.target.value)}
                            className="h-8 text-[12.5px] tabular-nums"
                            placeholder="€ 0.00"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(it.key)}
                          className="h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:bg-muted hover:text-destructive flex items-center justify-center"
                          aria-label="Αφαίρεση"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        <Input
                          value={it.category}
                          onChange={(e) => patch(it.key, 'category', e.target.value)}
                          className="h-7 text-[11.5px]"
                          placeholder="Κατηγορία (π.χ. Πίτσες)"
                        />
                        <Input
                          value={it.description}
                          onChange={(e) => patch(it.key, 'description', e.target.value)}
                          className="h-7 text-[11.5px]"
                          placeholder="Περιγραφή (προαιρετικό)"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button
                onClick={handleImport}
                disabled={importing || validCount === 0}
                className="w-full gap-2"
                variant="default"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Import className="h-4 w-4" />
                )}
                Εισαγωγή {validCount} προϊόντων στο μενού
              </Button>
              {validCount < total && (
                <p className="text-[10.5px] text-muted-foreground flex items-center gap-1">
                  <Badge variant="outline" className="px-1 text-[9.5px]">{total - validCount}</Badge>
                  προϊόντα με απουσία τιμής — θα παραλειφθούν εκτός αν ενεργοποιήσεις την εισαγωγή.
                </p>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}