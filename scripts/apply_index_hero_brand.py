#!/usr/bin/env python3
from pathlib import Path
idx = Path('src/pages/Index.tsx')
it = idx.read_text(encoding='utf-8')
it = it.replace('text-[#2C1A05]', 'text-white')
it = it.replace('Φαγητό που φτάνει.<br />', 'Fresh Meals.<br />')
it = it.replace('Φρέσκο. Σε 2. Στην πόρτα σου.', 'Fast Delivery.')
it = it.replace(
    """            Συνδέουμε εστιατόρια, οδηγούς και πελάτες σε πραγματικό χρόνο. Διαφανείς προμήθειες,
            άμεσες πληρωμές, μηδέν χάος.""",
    """            Φρέσκο φαγητό από τα αγαπημένα σου καταστήματα — γρήγορα στην πόρτα σου.
            Real-time tracking, διαφανείς προμήθειες, μηδέν χάος.""",
)
it = it.replace(
    'linear-gradient(165deg, #F4A125 0%, #FF8A3D 45%, #E94E8F 135%)',
    'linear-gradient(165deg, #EA580C 0%, #F97316 42%, #FB7185 130%)',
)
it = it.replace(
    'Fresh2GO — Φρέσκο. Σε 2. Στην πόρτα σου.',
    'Fresh2GO — Fresh Meals. Fast Delivery.',
)
idx.write_text(it, encoding='utf-8')
print('index ok')
cfg = Path('src/hooks/useCustomerAppConfig.ts')
if cfg.exists():
    ct = cfg.read_text(encoding='utf-8')
    ct = ct.replace(
        "tagline: 'Η Ήπειρος στο σπίτι σου, γρήγορα.',",
        "tagline: 'Fresh Meals. Fast Delivery.',",
    )
    cfg.write_text(ct, encoding='utf-8')
    print('config ok')
