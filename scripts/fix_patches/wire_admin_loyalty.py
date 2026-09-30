#!/usr/bin/env python3
from pathlib import Path

sp = Path('src/components/admin/AdminSidebar.tsx')
st = sp.read_text()
if "{ id: 'loyalty'" not in st:
    st = st.replace(
        "{ id: 'platform_cost', label: '€💶 Κόστος πλατφόρμας' },",
        "{ id: 'platform_cost', label: '€💶 Κόστος πλατφόρμας' },\n      { id: 'loyalty', label: '🎁 Πόντοι / Loyalty' },",
    )
    # fallback ascii-free match
    if "{ id: 'loyalty'" not in st:
        st = st.replace(
            "{ id: 'platform_cost',",
            "{ id: 'loyalty', label: 'Points / Loyalty' },\n      { id: 'platform_cost',",
            1,
        )
    sp.write_text(st)
    print('sidebar')

ap = Path('src/pages/AdminApp.tsx')
at = ap.read_text()
if 'AdminLoyaltyPanel' not in at:
    at = at.replace(
        "const PlatformCostPanel      = lazy(() => import('@/components/admin/PlatformCostPanel'));",
        "const PlatformCostPanel      = lazy(() => import('@/components/admin/PlatformCostPanel'));\nconst AdminLoyaltyPanel      = lazy(() => import('@/components/admin/AdminLoyaltyPanel'));",
    )
    at = at.replace(
        "      case 'platform_cost':\n        return <PlatformCostPanel onNavigate={setActiveSection} />;",
        "      case 'platform_cost':\n        return <PlatformCostPanel onNavigate={setActiveSection} />\n;\n      case 'loyalty':\n        return <AdminLoyaltyPanel />;",
    )
    # fix accidental semicolon placement if broken
    at = at.replace(
        "return <PlatformCostPanel onNavigate={setActiveSection} />\n;",
        "return <PlatformCostPanel onNavigate={setActiveSection} />;",
    )
    ap.write_text(at)
    print('adminapp')

sh = Path('src/components/admin/SettingsHub.tsx')
if sh.exists():
    ht = sh.read_text()
    if "id: 'loyalty'" not in ht:
        ht = ht.replace(
            "Link2, Truck, ReceiptText,\n} from 'lucide-react';",
            "Link2, Truck, ReceiptText, Gift,\n} from 'lucide-react';",
        )
        ht = ht.replace(
            "{ id: 'platform_cost', label: 'Κόστος πλατφόρμας'",
            "{ id: 'loyalty', label: 'Πόντοι / Loyalty', desc: 'Κέρδος, εξαργύρωση, επίπεδα, streaks.', icon: Gift, accent: '#ea580c' },\n      { id: 'platform_cost', label: 'Κόστος πλατφόρμας'",
        )
        sh.write_text(ht)
        print('settings')
print('done')
