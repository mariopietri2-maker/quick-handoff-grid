#!/usr/bin/env python3
from pathlib import Path
import re
p = Path('src/components/store/StoreDriverIdPanel.tsx')
t = p.read_text(encoding='utf-8')
if 'fmtOrderId(active.driver_call_id)' in t:
    print('already')
else:
    pat = r'\{active && \([\s\S]*?Σε εξέλιξη[\s\S]*?</div>\s*\)\}'
    new = '''{active && (
              <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-3 space-y-1.5">
                <div className="flex items-center gap-2 mb-1">
                  <Bike className="h-4 w-4 text-sky-600 animate-pulse" />
                  <span className="text-[11px] font-heading font-bold uppercase tracking-wide text-sky-700 dark:text-sky-400">
                    Σε εξέλιξη
                  </span>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-heading">Οδηγός (ID)</p>
                  <p className="text-base font-heading font-extrabold text-foreground">{driverIdLabel(active)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-heading">Παραγγελία</p>
                  <p className="font-mono text-[20px] font-extrabold leading-none text-sky-600 dark:text-sky-400 tabular-nums">
                    {fmtOrderId(active.driver_call_id)}
                  </p>
                </div>
              </div>
            )}'''
    m = re.search(pat, t)
    if not m:
        raise SystemExit('pattern missing')
    p.write_text(t[:m.start()] + new + t[m.end():], encoding='utf-8')
    print('patched')
