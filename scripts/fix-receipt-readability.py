#!/usr/bin/env python3
from pathlib import Path

p = Path('src/components/store/PrintOrderTicket.tsx')
t = p.read_text()

old_label = '''        .block .addr-label {
          display: block;
          width: 100%;
          margin: 10px auto 6px;
          background: #000;
          color: #fff;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.14em;
          padding: 4px 0;
        }'''
new_label = '''        .block .addr-label {
          display: block;
          width: 100%;
          margin: 10px auto 6px;
          background: #fff;
          color: #000;
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.12em;
          padding: 5px 4px;
          text-align: center !important;
        }'''
if old_label in t:
    t = t.replace(old_label, new_label, 1)
    print('labels')
else:
    print('labels skip')

old_addr = '''        .block .addr {
          display: block;
          width: 100%;
          text-align: center !important;
          font-weight: 900;
          font-size: 20px;
          line-height: 1.25;
          margin: 2px auto 6px;
          padding: 0 2px;
          letter-spacing: 0.01em;
        }'''
new_addr = '''        .block .addr {
          display: block;
          width: 100%;
          text-align: center !important;
          font-weight: 900;
          font-size: 16px;
          line-height: 1.35;
          margin: 4px auto 8px;
          padding: 0 4px;
          letter-spacing: 0;
          word-break: break-word;
          overflow-wrap: anywhere;
        }'''
if old_addr in t:
    t = t.replace(old_addr, new_addr, 1)
    print('addr')

old_tot = '''        .tot-row { display: flex; justify-content: space-between; gap: 8px; padding: 4px 0; font-weight: 700; font-size: 15px; }
        .tot-row .lab { flex: 1 1 auto; min-width: 0; }
        .tot-row .val { flex: 0 0 auto; font-weight: 900; white-space: nowrap; }
        .tot-grand { border-top: 2px solid #000; margin-top: 6px; padding-top: 8px; font-size: 18px; font-weight: 900; }
        .tot-grand .val { font-size: 20px; }'''
new_tot = '''        .tot-row { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; padding: 5px 2px; font-weight: 700; font-size: 14px; width: 100%; box-sizing: border-box; }
        .tot-row .lab { flex: 1 1 auto; min-width: 0; text-align: left; }
        .tot-row .val { flex: 0 0 auto; font-weight: 900; white-space: nowrap; text-align: right; font-variant-numeric: tabular-nums; }
        .tot-grand { border-top: 2px solid #000; margin-top: 6px; padding-top: 8px; font-size: 16px; font-weight: 900; }
        .tot-grand .val { font-size: 18px; }'''
if old_tot in t:
    t = t.replace(old_tot, new_tot, 1)
    print('totals')
else:
    # try already-patched largeType totals from earlier bump
    print('totals pattern check')

t = t.replace('ΠΑΡΑΔΟΣΗ · ΓΙΑ ΤΟΝ ΟΔΗΓΟ', 'ΠΑΡΑΔΟΣΗ')
t = t.replace('padding: 6px 4px 10px;', 'padding: 6px 6px 12px;', 1)

p.write_text(t)
print('OK')
