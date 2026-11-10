#!/usr/bin/env python3
from pathlib import Path
import re

p = Path('src/components/store/PrintOrderTicket.tsx')
t = p.read_text()

replacements = [
    (
        'font-size: ${largeType ? (narrow ? 15 : 16) : (narrow ? 13 : 14)}px;',
        'font-size: ${largeType ? (narrow ? 11 : 12) : (narrow ? 10 : 11)}px;',
    ),
    ('line-height: 1.4;', 'line-height: 1.25;'),
    ('padding: 6px 6px 12px;', 'padding: 4px 5px 8px;'),
    ('font-size: 16px;\n          font-weight: 900;', 'font-size: 13px;\n          font-weight: 900;'),
    ('font-size: 16px;\n          font-weight: 800;', 'font-size: 13px;\n          font-weight: 800;'),
    ('margin-bottom: 10px;', 'margin-bottom: 4px;'),
    (
        '''        .ticket-no {
          text-align: center;
          border: 2px solid #000;
          border-radius: 8px;
          padding: 12px 8px 10px;
          margin: 0 0 10px;
        }''',
        '''        .ticket-no {
          text-align: center;
          border: 2px solid #000;
          border-radius: 6px;
          padding: 4px 6px 4px;
          margin: 0 0 6px;
        }''',
    ),
    (
        'font-size: ${largeType ? (narrow ? 36 : 44) : (narrow ? 32 : 40)}px;',
        'font-size: ${largeType ? (narrow ? 22 : 24) : (narrow ? 20 : 22)}px;',
    ),
    (
        '.tot-row { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; padding: 5px 2px; font-weight: 700; font-size: 14px; width: 100%; box-sizing: border-box; }',
        '.tot-row { display: flex; justify-content: space-between; align-items: baseline; gap: 4px; padding: 1px 2px; font-weight: 700; font-size: 11px; width: 100%; box-sizing: border-box; }',
    ),
    (
        '.tot-grand { border-top: 2px solid #000; margin-top: 6px; padding-top: 8px; font-size: 16px; font-weight: 900; }',
        '.tot-grand { border-top: 2px solid #000; margin-top: 3px; padding-top: 3px; font-size: 13px; font-weight: 900; }',
    ),
    ('.tot-grand .val { font-size: 18px; }', '.tot-grand .val { font-size: 14px; }'),
    (
        '''        .block {
          margin: 12px auto 0;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          font-size: 13px;
          text-align: center !important;
          border: 2.5px solid #000;
          border-radius: 10px;
          padding: 14px 8px 16px;
          background: #fff;
        }''',
        '''        .block {
          margin: 6px auto 0;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          font-size: 11px;
          text-align: center !important;
          border: 1.5px solid #000;
          border-radius: 4px;
          padding: 6px 4px 8px;
          background: #fff;
        }''',
    ),
    (
        '''          margin: 10px auto 6px;
          background: #fff;
          color: #000;
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.12em;
          padding: 5px 4px;''',
        '''          margin: 4px auto 2px;
          background: #fff;
          color: #000;
          border-top: 1.5px solid #000;
          border-bottom: 1.5px solid #000;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.08em;
          padding: 2px 2px;''',
    ),
    (
        '''          font-size: 16px;
          line-height: 1.35;
          margin: 4px auto 8px;
          padding: 0 4px;''',
        '''          font-size: 12px;
          line-height: 1.2;
          margin: 1px auto 3px;
          padding: 0 2px;''',
    ),
    (
        '''          font-size: 18px;
          font-weight: 900;
          line-height: 1.3;
          margin: 4px auto 0;
          letter-spacing: 0.04em;''',
        '''          font-size: 13px;
          font-weight: 900;
          line-height: 1.2;
          margin: 1px auto 0;
          letter-spacing: 0.03em;''',
    ),
]

for a, b in replacements:
    if a in t:
        t = t.replace(a, b, 1)
        print('ok', a[:40].replace('\n', ' '))
    else:
        print('miss', a[:40].replace('\n', ' '))

# Remove driver block
drv = '''      ${
        extras.driverCode
          ? `<div class="block" style="margin-top:8px;border-style:dashed;">
              <strong>ΟΔΗΓΟΣ</strong>
              <span class="line">${e(String(extras.driverCode))}</span>
            </div>`
          : ''
      }
'''
if drv in t:
    t = t.replace(drv, '', 1)
    print('driver removed')
else:
    t2, n = re.subn(
        r"\s*\$\{\s*extras\.driverCode\s*\?[\s\S]*?:\s*''\s*\}",
        '',
        t,
        count=1,
    )
    if n:
        t = t2
        print('driver removed regex')
    else:
        print('driver miss')

# Skip empty doorbell
old_bell = '''        <span class="addr-label">ΚΟΥΔΟΥΝΙ</span>
        <span class="addr">${doorbell ? e(doorbell) : '—'}</span>'''
new_bell = '''        ${doorbell ? `<span class="addr-label">ΚΟΥΔΟΥΝΙ</span><span class="addr">${e(doorbell)}</span>` : ''}'''
if old_bell in t:
    t = t.replace(old_bell, new_bell, 1)
    print('doorbell conditional')

# Drop fake barcode spacer if present (saves length)
t = t.replace('<div class="barcode">▮▮▮ ▯▯▮ ▮▯▯ ▮▮▯ ▯▮▮ ▮▯▮</div>', '', 1)

p.write_text(t)

# ESC/POS remove driver
e = Path('src/lib/print-order-escpos.ts')
et = e.read_text()
et2, n = re.subn(
    r"\n  if \(extras\.driverCode\) \{[\s\S]*?\n  \}\n",
    "\n",
    et,
    count=1,
)
if n:
    e.write_text(et2)
    print('escpos driver gone')
else:
    print('escpos driver miss')

print('DONE')
