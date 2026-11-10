from pathlib import Path
p = Path('src/lib/print-order-escpos.ts')
t = p.read_text()
if 'return enc.result()' in t:
    t = t.replace('return enc.result()', 'return enc.getChunks()')
    p.write_text(t)
    print('fixed getChunks')
elif 'return enc.getChunks()' in t:
    print('already getChunks')
else:
    print('return pattern not found')
    # show tail
    print(t[-200:])
