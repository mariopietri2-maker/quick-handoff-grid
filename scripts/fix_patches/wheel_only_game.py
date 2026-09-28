#!/usr/bin/env python3
from pathlib import Path
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = p.read_text()
old = '''                when (state.gameActive) {
                    "wheel" -> LuckyWheelCard(state = state, onSpin = onSpinWheel)
                    else -> MysteryCardsSection(state = state, onOpenCard = onOpenCard)
                }'''
new = '''                // Only lucky wheel — mystery cards removed
                LuckyWheelCard(state = state, onSpin = onSpinWheel)'''
if old in t:
    p.write_text(t.replace(old, new))
    print("shell ok")
elif "Only lucky wheel" in t:
    print("shell already")
else:
    print("shell miss")
