#!/usr/bin/env python3
"""Align admin UI labels: Greek-first, sidebar matches settings hub."""
from pathlib import Path

def multi_replace(path, pairs):
    p = Path(path)
    if not p.exists():
        print('skip', path)
        return
    t = p.read_text()
    n = 0
    for a, b in pairs:
        if a in t:
            t = t.replace(a, b)
            n += 1
    p.write_text(t)
    print(path, n)

sidebar = [
    ("label: 'Live Ops'", "label: 'Ζωντανή λειτουργία'"),
    ("label: '🎛️ Delivery Control'", "label: '🎛️ Έλεγχος παραδόσεων'"),
    ("label: 'Pipeline (Kanban)'", "label: 'Ροή παραγγελιών'"),
    ("label: '🔧 Dispatch debug'", "label: '🔧 Debug αποστολής'"),
    ("label: '🚚 Delivered by Fresh2GO.GR & ETA'", "label: '🚚 Παράδοση Fresh2GO & ETA'"),
    ("label: '✨ AI Dynamic Pricing'", "label: '✨ Δυναμική τιμολόγηση AI'"),
    ("label: 'Support agents'", "label: 'Πράκτορες support'"),
    ("label: '🎨 Customer app'", "label: '🎨 Εφαρμογή πελάτη'"),
    ("label: '✨ AI Cards & Motion'", "label: '✨ Κάρτες AI & κίνηση'"),
    ("label: 'Feature flags'", "label: 'Διακόπτες λειτουργιών'"),
    ("label: 'Operational overrides'", "label: 'Παρακάμψεις λειτουργίας'"),
    ("label: '🛡️ Mission Control'", "label: '🛡️ Κέντρο ελέγχου'"),
    ("label: '🩺 System Doctor'", "label: '🩺 Διαγνωστικό συστήματος'"),
    ("label: '☁️ Cloud usage'", "label: '☁️ Χρήση cloud'"),
    ("label: 'Points / Loyalty'", "label: '🎁 Πόντοι / Loyalty'"),
    ("label: 'Audit log'", "label: 'Αρχείο ενεργειών'"),
    ("label: 'Remote actions (χρήστες)'", "label: 'Απομακρυσμένες ενέργειες'"),
    ("label: '⚠ System reset'", "label: '⚠ Επαναφορά συστήματος'"),
    ("label: '📞 Call roles (N/K)'", "label: '📞 Ρόλοι κλήσεων (N/K)'"),
    ("Control Center", "Κέντρο ελέγχου"),
    ("label: 'Support'", "label: 'Υποστήριξη'"),
    ("label: 'Buffer'", "label: 'Buffer κινήτρων'"),
    ("label: 'Surge'", "label: 'Surge αιχμής'"),
]
multi_replace('src/components/admin/AdminSidebar.tsx', sidebar)

settings = [
    ("Διαχείρηση λογαριασμών", "Διαχείριση λογαριασμών"),
    ("Πλήκρη επαναφορά", "Πλήρης επαναφορά"),
    ("label: 'Support agents'", "label: 'Πράκτορες support'"),
    ("label: 'Remote actions'", "label: 'Απομακρυσμένες ενέργειες'"),
    ("label: 'Customer app'", "label: 'Εφαρμογή πελάτη'"),
    ("label: 'AI Cards & Motion'", "label: 'Κάρτες AI & κίνηση'"),
    ("label: 'Feature flags'", "label: 'Διακόπτες λειτουργιών'"),
    ("label: 'Marketplace & Delivery'", "label: 'Marketplace & παράδοση'"),
    ("Delivery on/off, χρόνοι παράδοσης", "Παράδοση on/off, χρόνοι"),
    ("label: 'Operational overrides'", "label: 'Παρακάμψεις λειτουργίας'"),
    ("label: 'Mission Control'", "label: 'Κέντρο ελέγχου'"),
    ("label: 'System Doctor'", "label: 'Διαγνωστικό συστήματος'"),
    ("label: 'Cloud usage'", "label: 'Χρήση cloud'"),
    ("label: 'Audit log'", "label: 'Αρχείο ενεργειών'"),
    ("label: 'System reset'", "label: 'Επαναφορά συστήματος'"),
]
multi_replace('src/components/admin/SettingsHub.tsx', settings)

for path, pairs in [
    ('src/components/admin/AdminAuditTab.tsx', [
        ('Activity & Audit', 'Δραστηριότητα & έλεγχος'),
        ('/> Activity', '/> Δραστηριότητα'),
        ('/> Audit', '/> Έλεγχος'),
    ]),
    ('src/components/admin/AdminActivityLog.tsx', [
        ('Activity Log', 'Αρχείο δραστηριότητας'),
    ]),
    ('src/components/admin/AdminAuditLog.tsx', [
        ('Admin Audit Log', 'Αρχείο ενεργειών διαχειριστή'),
    ]),
]:
    multi_replace(path, pairs)
print('admin labels aligned')
