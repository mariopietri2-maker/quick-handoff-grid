#!/usr/bin/env python3
from pathlib import Path
p = Path("src/hooks/useOrders.ts")
t = p.read_text()
orig = t
t = t.replace("startOrderAlertLoop({ maxRepeats: autoAcceptRef.current ? 10 : null })", "startOrderAlertLoop({ maxRepeats: autoAcceptRef.current ? 5 : null })")
t = t.replace("startOrderAlertLoop({ maxRepeats: 10 })", "startOrderAlertLoop({ maxRepeats: 5 })")
# If suppressSound prop is false but localStorage muted, still suppress
if "store_sound_muted" not in t:
    # inject at start of the effect that starts the loop
    old = "  useEffect(() => {\n    if (suppressSound) { stopOrderAlertLoop(); return; }"
    new = "  useEffect(() => {\n    const mutedLs = typeof localStorage !== 'undefined' && localStorage.getItem('store_sound_muted') === '1';\n    if (suppressSound || mutedLs) { stopOrderAlertLoop(); return; }"
    if old in t:
        t = t.replace(old, new, 1)
if t != orig:
    p.write_text(t)
    print("updated useOrders")
else:
    print("no change")
