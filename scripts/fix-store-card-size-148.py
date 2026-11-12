#!/usr/bin/env python3
"""Restore store card image size closer to the preferred (screenshot) proportions."""
from pathlib import Path

p = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt')
t = p.read_text()

# Hero image: screenshot-like height (~148dp), not tiny 72/92/110
replacements = [
    (
        'Box(Modifier.fillMaxWidth().height(72.dp).clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp)))',
        'Box(Modifier.fillMaxWidth().height(148.dp).clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp)))',
    ),
    (
        'Box(Modifier.fillMaxWidth().height(92.dp).clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp)))',
        'Box(Modifier.fillMaxWidth().height(148.dp).clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp)))',
    ),
    (
        'Box(Modifier.fillMaxWidth().height(110.dp).clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp)))',
        'Box(Modifier.fillMaxWidth().height(148.dp).clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp)))',
    ),
    ('height = 72,', 'height = 148,'),
    ('height = 92,', 'height = 148,'),
    ('height = 110,', 'height = 148,'),
    # skeleton
    ('Box(Modifier.fillMaxWidth().height(110.dp).background(FreshChip))',
     'Box(Modifier.fillMaxWidth().height(148.dp).background(FreshChip))'),
    ('Box(Modifier.fillMaxWidth().height(72.dp).background(FreshChip))',
     'Box(Modifier.fillMaxWidth().height(148.dp).background(FreshChip))'),
]

for a, b in replacements:
    if a in t:
        t = t.replace(a, b)
        print('ok', a[:50])
    else:
        print('skip', a[:50])

# Body under image: tight (no big empty gap) — keep chips close to name
t = t.replace(
    'Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp))',
    'Column(Modifier.padding(horizontal = 12.dp, vertical = 10.dp))',
    1,
)
t = t.replace(
    'Spacer(Modifier.height(6.dp))\n            Row(\n                verticalAlignment = Alignment.CenterVertically,\n                horizontalArrangement = Arrangement.spacedBy(8.dp),\n            ) {\n                Surface(color = FreshGreenSoft, shape = RoundedCornerShape(8.dp))',
    'Spacer(Modifier.height(8.dp))\n            Row(\n                verticalAlignment = Alignment.CenterVertically,\n                horizontalArrangement = Arrangement.spacedBy(6.dp),\n            ) {\n                Surface(color = FreshGreenSoft, shape = RoundedCornerShape(8.dp))',
    1,
)

p.write_text(t)
print('DONE card size 148')
