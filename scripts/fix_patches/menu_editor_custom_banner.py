#!/usr/bin/env python3
from pathlib import Path
p = Path('src/components/store/MenuControl.tsx')
t = p.read_text()
if 'Custom κρέπα / burger' in t or 'custom κρέπα / burger' in t:
    print('banner already')
else:
    old = """      <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
        <p className="font-heading font-semibold text-sm text-foreground">Διαχείριση μενού</p>
        <p className="text-[11px] text-muted-foreground">
          Προσφορές πάνω · μολύβι = επεξεργασία · ⚙ = επιλογές προϊόντος · χειροκίνητη προσθήκη
        </p>
      </div>"""
    new = """      <div className="rounded-xl border-2 border-orange-500/40 bg-orange-500/10 px-3 py-3 space-y-1.5">
        <p className="font-heading font-extrabold text-sm text-foreground">Διαχείριση μενού</p>
        <p className="text-[12px] text-foreground/90 leading-snug">
          Για <strong>custom κρέπα / burger / πίτσα</strong>: δημιούργησε το προϊόν → πάτα το κουμπί{' '}
          <span className="inline-flex items-center gap-1 rounded-md border border-orange-500/50 bg-white px-1.5 py-0.5 text-[11px] font-extrabold text-orange-700">
            Υλικά
          </span>{' '}
          δίπλα στο προϊόν → πρόσθεσε ομάδες (Βάση, Γέμιση, Σάλτσες) ή πάτα πρότυπο «Custom κρέπα».
        </p>
        <p className="text-[11px] text-muted-foreground">
          Ο πελάτης επιλέγει υλικά όταν το βάζει στο καλάθι.
        </p>
      </div>"""
    if old not in t:
        raise SystemExit('banner miss')
    t = t.replace(old, new)
    print('banner')

if 'Μετά την προσθήκη, πάτα' not in t:
    old = """              <Button onClick={handleAdd} className="w-full gradient-primary text-primary-foreground font-heading" disabled={!newItem.name || !newItem.price || !newItem.category}>
                Προσθήκη
              </Button>"""
    new = """              <p className="text-[11px] text-muted-foreground rounded-lg bg-muted/60 px-2.5 py-2">
                Μετά την προσθήκη, πάτα <strong>Υλικά</strong> στο προϊόν για custom επιλογές
                (κρέπα με υλικά, μεγέθη, extras).
              </p>
              <Button onClick={handleAdd} className="w-full gradient-primary text-primary-foreground font-heading" disabled={!newItem.name || !newItem.price || !newItem.category}>
                Προσθήκη
              </Button>"""
    if old in t:
        t = t.replace(old, new)
        print('tip')
    else:
        print('tip miss')

p.write_text(t)
print('ok')
