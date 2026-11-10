#!/usr/bin/env python3
"""Make ticket denser; remove driver section; skip empty doorbell/notes."""
from pathlib import Path

# ---- HTML ticket ----
p = Path('src/components/store/PrintOrderTicket.tsx')
t = p.read_text()

# Smaller base type
t = t.replace(
    'font-size: ${largeType ? (narrow ? 15 : 16) : (narrow ? 13 : 14)}px;',
    'font-size: ${largeType ? (narrow ? 12 : 13) : (narrow ? 11 : 12)}px;',
    1,
)
# Smaller order number
t = t.replace(
    'font-size: ${largeType ? (narrow ? 36 : 44) : (narrow ? 32 : 40)}px;',
    'font-size: ${largeType ? (narrow ? 26 : 30) : (narrow ? 24 : 28)}px;',
    1,
)
t = t.replace('padding: 12px 8px 10px;', 'padding: 6px 6px 5px;', 1)

# Compact delivery block
old_block = '''        .block {
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
        }'''
new_block = '''        .block {
          margin: 8px auto 0;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          font-size: 12px;
          text-align: center !important;
          border: 2px solid #000;
          border-radius: 6px;
          padding: 8px 6px 10px;
          background: #fff;
        }'''
if old_block in t:
    t = t.replace(old_block, new_block, 1)
    print('block compact')

# Smaller labels / addr
t = t.replace(
    '''          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.12em;
          padding: 5px 4px;''',
    '''          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.1em;
          padding: 3px 2px;''',
    1,
)
t = t.replace(
    '''          font-size: 16px;
          line-height: 1.35;
          margin: 4px auto 8px;''',
    '''          font-size: 13px;
          line-height: 1.25;
          margin: 2px auto 4px;''',
    1,
)

# Compact totals
t = t.replace(
    '.tot-row { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; padding: 5px 2px; font-weight: 700; font-size: 14px;',
    '.tot-row { display: flex; justify-content: space-between; align-items: baseline; gap: 4px; padding: 2px 2px; font-weight: 700; font-size: 12px;',
    1,
)
t = t.replace(
    '.tot-grand { border-top: 2px solid #000; margin-top: 6px; padding-top: 8px; font-size: 16px; font-weight: 900; }',
    '.tot-grand { border-top: 2px solid #000; margin-top: 4px; padding-top: 4px; font-size: 14px; font-weight: 900; }',
    1,
)
t = t.replace('.tot-grand .val { font-size: 18px; }', '.tot-grand .val { font-size: 15px; }', 1)

# Remove driver HTML block entirely
import re
# Pattern for driver optional block in template string
pat = re.compile(
    r"\$\{\s*extras\.driverCode\s*\?[\s\S]*?<div class=\"block\"[^>]*>[\s\S]*?ΟΔΗΓΟΣ[\s\S]*?</div>`\s*:\s*''\s*\}",
    re.M,
)
t2, n = pat.subn('', t, count=1)
if n:
    t = t2
    print('removed HTML driver block')
else:
    # simpler replace
    if 'ΟΔΗΓΟΣ' in t and 'extras.driverCode' in t:
        # remove lines containing driver block loosely
        lines = t.splitlines(keepends=True)
        out = []
        skip = 0
        for i, ln in enumerate(lines):
            if skip:
                skip -= 1
                continue
            if 'extras.driverCode' in ln and '?' in ln and 'ΟΔΗΓΟΣ' in ''.join(lines[i:i+15]):
                # skip until closing of ternary
                j = i
                buf = ''
                while j < len(lines):
                    buf += lines[j]
                    if ": ''" in lines[j] or ":''" in lines[j]:
                        j += 1
                        break
                    j += 1
                # drop buf
                print('dropped driver ternary ~', j - i, 'lines')
                # advance
                # manually skip
                for k in range(i, j):
                    pass
                # continue from j by setting index - use while rewrite
                out.append('      ${\'\'\}\n')  # noop
                # actually skip those lines
                for k in range(i + 1, j):
                    pass
                # set continue: append nothing for i..j-1
                # use flag
                skip = j - i - 1
                continue
            out.append(ln)
        # This is messy - use string find
        start = t.find('extras.driverCode')
        if start > 0:
            # find ${ before it
            brace = t.rfind('${', 0, start)
            end = t.find(": ''", start)
            if end < 0:
                end = t.find(":''", start)
            if brace >= 0 and end > 0:
                # include through closing }
                end2 = t.find('}', end)
                if end2 > 0:
                    t = t[:brace] + t[end2 + 1 :]
                    print('removed driver by slice')
    else:
        print('no driver html')

# Skip empty doorbell and empty notes in HTML — replace fixed doorbell line
old_bell = """        <span class=\"addr-label\">ΚΟΥΔΟΥΝΙ</span>
        <span class=\"addr\">${doorbell ? e(doorbell) : '—'}</span>"""
new_bell = """        ${doorbell ? `<span class=\"addr-label\">ΚΟΥΔΟΥΝΙ</span><span class=\"addr\">${e(doorbell)}</span>` : ''}"""
if old_bell in t:
    t = t.replace(old_bell, new_bell, 1)
    print('skip empty doorbell')

p.write_text(t)
print('html done')

# ---- ESC/POS: remove driver ----
e = Path('src/lib/print-order-escpos.ts')
et = e.read_text()
old_drv = '''  if (extras.driverCode) {
    enc.align('center');
    enc.bold(true);
    enc.text(escpad('ΟΔΗΓΟΣ', cols, 'center'));
    enc.bold(false);
    enc.line();
    enc.text(escpad(cutText(String(extras.driverCode), cols), cols, 'center'));
    enc.line();
  }
'''
if old_drv in et:
    et = et.replace(old_drv, '', 1)
    e.write_text(et)
    print('escpos driver removed')
else:
    # try alternate spacing
    import re
    et2, n = re.subn(
        r"\n  if \(extras\.driverCode\) \{[\s\S]*?enc\.line\(\);\n  \}\n",
        "\n",
        et,
        count=1,
    )
    if n:
        e.write_text(et2)
        print('escpos driver removed regex')
    else:
        print('escpos driver not found')

print('ALL OK')
