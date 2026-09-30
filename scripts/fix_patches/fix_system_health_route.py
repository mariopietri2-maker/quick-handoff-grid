#!/usr/bin/env python3
from pathlib import Path
p = Path('src/pages/AdminApp.tsx')
t = p.read_text()
if 'SystemHealthPanel' not in t:
    t = t.replace(
        'const SystemDoctorPanel',
        "const SystemHealthPanel = lazy(() => import('@/components/admin/SystemHealthPanel'));\nconst SystemDoctorPanel",
    )
if "case 'system_health':\n        return <SystemDoctorPanel />" in t:
    t = t.replace(
        "case 'system_health':\n        return <SystemDoctorPanel />;",
        "case 'system_health':\n        return <SystemHealthPanel />;",
    )
    print('routed system_health -> SystemHealthPanel')
elif "return <SystemHealthPanel />" in t:
    print('already fixed')
else:
    print('pattern miss')
p.write_text(t)
