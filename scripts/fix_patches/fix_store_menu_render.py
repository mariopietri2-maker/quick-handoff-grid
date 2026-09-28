#!/usr/bin/env python3
"""Fix store MenuControl broken offers .map + null-safe filter + import errors."""
from pathlib import Path

p = Path("src/components/store/MenuControl.tsx")
t = p.read_text()

for a, b in [
    (
        "category === '\u03a0\u03c1\u03bf\u03c3\u03c6\u03bf\u03c1\u03ad\u03c2' ? filtered.filter(isOfferItem) : filtered.filter(i => !isOfferItem(i) && (i.category ?? '\u03a7\u03c9\u03c1\u03af\u03c2 \u039a\u03b1\u03c4\u03b7\u03b3\u03bf\u03c1\u03af\u03b1') === category).map(item => (",
        "(category === '\u03a0\u03c1\u03bf\u03c3\u03c6\u03bf\u03c1\u03ad\u03c2' ? filtered.filter(isOfferItem) : filtered.filter(i => !isOfferItem(i) && (i.category ?? '\u03a7\u03c9\u03c1\u03af\u03c2 \u039a\u03b1\u03c4\u03b7\u03b3\u03bf\u03c1\u03af\u03b1') === category)).map(item => (",
    ),
    (
        "category === 'Προσφορές' ? filtered.filter(isOfferItem) : filtered.filter(i => !isOfferItem(i) && (i.category ?? 'Χωρίς Κατηγορία') === category).map(item => (",
        "(category === 'Προσφορές' ? filtered.filter(isOfferItem) : filtered.filter(i => !isOfferItem(i) && (i.category ?? 'Χωρίς Κατηγορία') === category)).map(item => (",
    ),
]:
    if a in t:
        t = t.replace(a, b)
        print("map fixed")
        break
else:
    if ")).map(item => (" in t and "isOfferItem" in t:
        print("map already ok")
    else:
        print("map pattern miss")

old_f = """  const filtered = items.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    (item.category ?? '').toLowerCase().includes(search.toLowerCase())
  );"""
new_f = """  const filtered = items.filter(item => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      (item.name ?? '').toLowerCase().includes(q) ||
      (item.category ?? '').toLowerCase().includes(q) ||
      (item.description ?? '').toLowerCase().includes(q)
    );
  });"""
if old_f in t:
    t = t.replace(old_f, new_f)
    print("filter safe")

if '{item.name || "Χωρίς όνομα"}' not in t and "{item.name ||" not in t:
    t = t.replace('{item.name}</span>', '{item.name || "Χωρίς όνομα"}</span>')
p.write_text(t)

p = Path("src/components/store/MenuImportFromReceipt.tsx")
if p.exists():
    t = p.read_text()
    if "AI_GATEWAY_API_KEY" not in t:
        t = t.replace(
            """      const { data, error } = await supabase.functions.invoke('parse-receipt', {
        body: { text: pasteText, mode: 'menu' },
      });
      if (error) throw error;""",
            """      const { data, error } = await supabase.functions.invoke('parse-receipt', {
        body: { text: pasteText, mode: 'menu' },
      });
      if (error) {
        const msg = (error as any)?.message || String(error);
        if (/non-2xx|FunctionsHttpError|Failed to send/i.test(msg)) {
          toast.error('Η ανάλυση μενού απέτυχε (AI service). Πρόσθεσε προϊόντα χειροκίνητα ή έλεγξε AI_GATEWAY_API_KEY.');
        } else {
          toast.error(msg);
        }
        return;
      }""",
        )
        p.write_text(t)
        print("import ok")

p = Path("src/hooks/useMenuItems.ts")
t = p.read_text()
old = """    if (!error && data) {
      setItems(data);
    }
    setLoading(false);"""
new = """    if (error) {
      console.error('menu_items fetch', error);
      toast.error('Αποτυχία φόρτωσης μενού: ' + (error.message || 'άγνωστο σφάλμα'));
      setItems([]);
    } else if (data) {
      setItems(data);
    }
    setLoading(false);"""
if old in t:
    t = t.replace(old, new)
    p.write_text(t)
    print("fetch ok")
print("done")
