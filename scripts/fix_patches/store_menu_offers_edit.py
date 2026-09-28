#!/usr/bin/env python3
"""Store MenuControl: offers first + inline edit for store owners."""
from pathlib import Path

p = Path("src/components/store/MenuControl.tsx")
t = p.read_text()
if "catFilter" in t and "openEdit" in t and "__offers__" in t:
    print("MenuControl already improved")
    raise SystemExit(0)

t = t.replace(
    "const { items, loading, toggleAvailable, toggleSnooze, bulkSetSnooze, bulkSetAvailable, addItem, updateItemImage } = useMenuItems(storeId);",
    "const { items, loading, toggleAvailable, toggleSnooze, bulkSetSnooze, bulkSetAvailable, addItem, updateItem, updateItemImage } = useMenuItems(storeId);",
)

if "function isOfferItem" not in t:
    needle = "interface MenuControlProps {\n  storeId: string;\n}"
    helper = (
        "function isOfferItem(item: { name?: string | null; category?: string | null; description?: string | null }) {\n"
        "  const blob = `${item.name ?? ''} ${item.category ?? ''} ${item.description ?? ''}`.toLowerCase();\n"
        "  return /\u03c0\u03c1\u03bf\u03c3\u03c6\u03bf\u03c1|offer|1\\s*\\+\\s*1|2\\s*\\+\\s*1|\u03ad\u03ba\u03c0\u03c4\u03c9\u03c3|discount/.test(blob);\n"
        "}\n\n"
        "interface MenuControlProps {\n  storeId: string;\n}"
    )
    if needle in t:
        t = t.replace(needle, helper)
        print("isOfferItem")

old = "  const categories = [...new Set(filtered.map(i => i.category ?? '\u03a7\u03c9\u03c1\u03af\u03c2 \u039a\u03b1\u03c4\u03b7\u03b3\u03bf\u03c1\u03af\u03b1'))];"
new = (
    "  const categories = [\n"
    "    ...(filtered.some(isOfferItem) ? ['\u03a0\u03c1\u03bf\u03c3\u03c6\u03bf\u03c1\u03ad\u03c2'] : []),\n"
    "    ...[...new Set(filtered.filter(i => !isOfferItem(i)).map(i => i.category ?? '\u03a7\u03c9\u03c1\u03af\u03c2 \u039a\u03b1\u03c4\u03b7\u03b3\u03bf\u03c1\u03af\u03b1'))],\n"
    "  ];"
)
if old in t:
    t = t.replace(old, new)
    t = t.replace(
        "filtered.filter(i => (i.category ?? '\u03a7\u03c9\u03c1\u03af\u03c2 \u039a\u03b1\u03c4\u03b7\u03b3\u03bf\u03c1\u03af\u03b1') === category)",
        "category === '\u03a0\u03c1\u03bf\u03c3\u03c6\u03bf\u03c1\u03ad\u03c2' ? filtered.filter(isOfferItem) : filtered.filter(i => !isOfferItem(i) && (i.category ?? '\u03a7\u03c9\u03c1\u03af\u03c2 \u039a\u03b1\u03c4\u03b7\u03b3\u03bf\u03c1\u03af\u03b1') === category)",
    )
    print("offers-first grouping")

if "Pencil" not in t:
    t = t.replace(
        "import { Moon, X, Search, Plus, CheckSquare, Square, Image as ImageIcon, Trash2, Loader2 } from 'lucide-react';",
        "import { Moon, X, Search, Plus, CheckSquare, Square, Image as ImageIcon, Trash2, Loader2, Pencil } from 'lucide-react';",
    )

if "setEdit" not in t:
    t = t.replace(
        "const [imageBusyId, setImageBusyId] = useState<string | null>(null);",
        "const [imageBusyId, setImageBusyId] = useState<string | null>(null);\n"
        "  const [edit, setEdit] = useState<null | { id: string; name: string; price: string; category: string; description: string }>(null);\n"
        "  const [editBusy, setEditBusy] = useState(false);",
    )
    print("edit state")

marker = (
    "                      <Switch\n"
    "                        checked={item.is_available ?? true}\n"
    "                        onCheckedChange={() => toggleAvailable(item.id)}\n"
    "                      />"
)
insert = (
    "                      <button\n"
    "                        type=\"button\"\n"
    "                        onClick={() => setEdit({\n"
    "                          id: item.id,\n"
    "                          name: item.name ?? '',\n"
    "                          price: String(item.price ?? ''),\n"
    "                          category: item.category ?? '',\n"
    "                          description: item.description ?? '',\n"
    "                        })}\n"
    "                        className=\"h-9 w-9 rounded-lg flex items-center justify-center bg-muted text-muted-foreground hover:text-primary\"\n"
    "                        title=\"\u0395\u03c0\u03b5\u03be\u03b5\u03c1\u03b3\u03b1\u03c3\u03af\u03b1\"\n"
    "                      >\n"
    "                        <Pencil className=\"h-4 w-4\" />\n"
    "                      </button>\n"
    + marker
)
if "title=\"\u0395\u03c0\u03b5\u03be\u03b5\u03c1\u03b3\u03b1\u03c3\u03af\u03b1\"" not in t and marker in t:
    t = t.replace(marker, insert, 1)
    print("edit button")

if "\u0395\u03c0\u03b5\u03be\u03b5\u03c1\u03b3\u03b1\u03c3\u03af\u03b1 \u03c0\u03c1\u03bf\u03ca\u03cc\u03bd\u03c4\u03bf\u03c2" not in t:
    close = "    </div>\n  );\n}"
    dialog = (
        "\n      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>\n"
        "        <DialogContent>\n"
        "          <DialogHeader>\n"
        "            <DialogTitle className=\"font-heading\">\u0395\u03c0\u03b5\u03be\u03b5\u03c1\u03b3\u03b1\u03c3\u03af\u03b1 \u03c0\u03c1\u03bf\u03ca\u03cc\u03bd\u03c4\u03bf\u03c2</DialogTitle>\n"
        "          </DialogHeader>\n"
        "          {edit && (\n"
        "            <div className=\"space-y-3\">\n"
        "              <div>\n"
        "                <Label className=\"font-heading\">\u038c\u03bd\u03bf\u03bc\u03b1</Label>\n"
        "                <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />\n"
        "              </div>\n"
        "              <div className=\"grid grid-cols-2 gap-3\">\n"
        "                <div>\n"
        "                  <Label className=\"font-heading\">\u03a4\u03b9\u03bc\u03ae (\u20ac)</Label>\n"
        "                  <Input type=\"number\" step=\"0.01\" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} />\n"
        "                </div>\n"
        "                <div>\n"
        "                  <Label className=\"font-heading\">\u039a\u03b1\u03c4\u03b7\u03b3\u03bf\u03c1\u03af\u03b1</Label>\n"
        "                  <Input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} />\n"
        "                </div>\n"
        "              </div>\n"
        "              <div>\n"
        "                <Label className=\"font-heading\">\u03a0\u03b5\u03c1\u03b9\u03b3\u03c1\u03b1\u03c6\u03ae</Label>\n"
        "                <Input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />\n"
        "              </div>\n"
        "              <Button\n"
        "                className=\"w-full\"\n"
        "                disabled={editBusy}\n"
        "                onClick={async () => {\n"
        "                  if (!edit.name.trim() || edit.price === '') return;\n"
        "                  setEditBusy(true);\n"
        "                  const ok = await updateItem(edit.id, {\n"
        "                    name: edit.name.trim(),\n"
        "                    price: parseFloat(edit.price),\n"
        "                    category: edit.category.trim() || '\u03a7\u03c9\u03c1\u03af\u03c2 \u039a\u03b1\u03c4\u03b7\u03b3\u03bf\u03c1\u03af\u03b1',\n"
        "                    description: edit.description.trim() || null,\n"
        "                  });\n"
        "                  setEditBusy(false);\n"
        "                  if (ok) setEdit(null);\n"
        "                }}\n"
        "              >\n"
        "                \u0391\u03c0\u03bf\u03b8\u03ae\u03ba\u03b5\u03c5\u03c3\u03b7\n"
        "              </Button>\n"
        "            </div>\n"
        "          )}\n"
        "        </DialogContent>\n"
        "      </Dialog>\n"
        "    </div>\n"
        "  );\n"
        "}"
    )
    idx = t.rfind(close)
    if idx >= 0:
        t = t[:idx] + dialog
        print("dialog")

p.write_text(t)
print("patched", p.stat().st_size)
