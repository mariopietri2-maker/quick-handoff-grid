#!/usr/bin/env python3
from pathlib import Path

p = Path("src/pages/StoreApp.tsx")
t = p.read_text()
old = """              <TabsContent value=\"menu\">
                <MenuImportFromReceipt storeId={store.id} />
                <MenuControl storeId={store.id} />
              </TabsContent>"""
new = """              <TabsContent value=\"menu\">
                {/* AI menu import disabled */}
                <MenuControl storeId={store.id} />
              </TabsContent>"""
if old in t:
    t = t.replace(old, new)
    t = t.replace("import MenuImportFromReceipt from '@/components/store/MenuImportFromReceipt';\n", "")
    p.write_text(t)
    print("import disabled")
elif "MenuImportFromReceipt" not in t or "AI menu import disabled" in t:
    print("already disabled")
else:
    # try without exact whitespace
    if "<MenuImportFromReceipt" in t:
        t = t.replace("<MenuImportFromReceipt storeId={store.id} />\n", "")
        t = t.replace("import MenuImportFromReceipt from '@/components/store/MenuImportFromReceipt';\n", "")
        p.write_text(t)
        print("import stripped")
    else:
        print("miss")

p = Path("src/components/store/MenuControl.tsx")
t = p.read_text()
if "\u0394\u03b9\u03b1\u03c7\u03b5\u03af\u03c1\u03b9\u03c3\u03b7 \u03bc\u03b5\u03bd\u03bf\u03cd" not in t and "Διαχείριση μενού" not in t:
    marker = "  return (\n    <div className=\"space-y-4\">"
    banner = (
        "  return (\n"
        "    <div className=\"space-y-4\">\n"
        "      <div className=\"rounded-xl border border-primary/20 bg-primary/5 px-3 py-2\">\n"
        "        <p className=\"font-heading font-semibold text-sm text-foreground\">Διαχείριση μενού</p>\n"
        "        <p className=\"text-[11px] text-muted-foreground\">\n"
        "          Προσφορές πάνω · μολύβι = επεξεργασία · ⚙ = επιλογές προϊόντος · χειροκίνητη προσθήκη\n"
        "        </p>\n"
        "      </div>"
    )
    if marker in t:
        p.write_text(t.replace(marker, banner))
        print("banner")
    else:
        print("banner miss")
else:
    print("banner ok")
