#!/usr/bin/env python3
from pathlib import Path

# Index hero + SEO
idx = Path('src/pages/Index.tsx')
it = idx.read_text(encoding='utf-8')
it = it.replace(
    'title="Fresh2GO — Φρέσκο. Σε 2. Στην πόρτα σου."',
    'title="Fresh2GO — Fresh Meals. Fast Delivery."',
)
it = it.replace(
    'description="Φρέσκο. Σε 2. Στην πόρτα σου. Η πλατφόρμα delivery που συνδέει πελάτες, εστιατόρια και οδηγούς σε πραγματικό χρόνο. Γρήγορα, αξιόπιστα, στην πόρτα σας."',
    'description="Fresh Meals. Fast Delivery. Η πλατφόρμα delivery που συνδέει πελάτες, εστιατόρια και οδηγούς σε πραγματικό χρόνο."',
)
old_h = '''          <h1 className="font-heading font-extrabold text-white text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight mb-6 animate-fade-in"
              style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
            Φαγητό που φτάνει.<br />
            <span className="text-[#2C1A05]">Φρέσκο. Σε 2. Στην πόρτα σου.</span>
          </h1>

          <p className="text-white/85 text-base sm:text-lg max-w-xl mx-auto mb-10 animate-fade-in leading-relaxed"
             style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            Συνδέουμε εστιατόρια, οδηγούς και πελάτες σε πραγματικό χρόνο. Διαφανείς προμήθειες,
            άμεσες πληρωμές, μηδέν χάος.
          </p>'''
new_h = '''          <h1 className="font-heading font-extrabold text-white text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight mb-6 animate-fade-in"
              style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
            Fresh Meals.<br />
            <span className="text-white">Fast Delivery.</span>
          </h1>

          <p className="text-white/90 text-base sm:text-lg max-w-xl mx-auto mb-10 animate-fade-in leading-relaxed"
             style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            Φρέσκο φαγητό από τα αγαπημένα σου καταστήματα — γρήγορα στην πόρτα σου.
            Real-time tracking, διαφανείς προμήθειες, μηδέν χάος.
          </p>'''
if old_h in it:
    it = it.replace(old_h, new_h)
    print('hero')
elif 'Fresh Meals.' in it:
    print('hero already')
else:
    print('WARN hero')
it = it.replace(
    "style={{ background: 'linear-gradient(165deg, #F4A125 0%, #FF8A3D 45%, #E94E8F 135%)' }}",
    "style={{ background: 'linear-gradient(165deg, #EA580C 0%, #F97316 42%, #FB7185 130%)' }}",
)
idx.write_text(it, encoding='utf-8')

cfg = Path('src/hooks/useCustomerAppConfig.ts')
ct = cfg.read_text(encoding='utf-8')
ct = ct.replace(
    "tagline: 'Η Ήπειρος στο σπίτι σου, γρήγορα.',",
    "tagline: 'Fresh Meals. Fast Delivery.',",
)
cfg.write_text(ct, encoding='utf-8')
print('web done')
