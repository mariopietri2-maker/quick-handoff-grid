#!/usr/bin/env python3
from pathlib import Path

p = Path("src/lib/customer-games.ts")
if p.exists():
    t = p.read_text()
    t = t.replace("Math.random() < 0.3", "Math.random() < 0.6")
    t = t.replace("~30% chance", "~60% chance")
    p.write_text(t)
    print("web ok")

p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
t = p.read_text()
old = "    private fun rollDailyGameShow(): Boolean = false // soft-launch"
if old in t:
    new = '''    private fun rollDailyGameShow(): Boolean {
        val prefs = getApplication<Application>().getSharedPreferences("fresh_customer", Context.MODE_PRIVATE)
        val day = java.time.LocalDate.now().toString()
        val key = "daily_game_show_$day"
        if (prefs.contains(key)) {
            val show = prefs.getBoolean(key, false)
            if (show) {
                val until = prefs.getLong("daily_game_until_$day", 0L)
                if (until > 0L && System.currentTimeMillis() < until) {
                    gameShowUntilMs = until
                    return true
                }
                return false
            }
            return false
        }
        val show = Random.nextDouble() < 0.6
        val until = if (show) System.currentTimeMillis() + GAME_SHOW_WINDOW_MS else 0L
        prefs.edit().putBoolean(key, show).putLong("daily_game_until_$day", until).apply()
        if (show) gameShowUntilMs = until
        return show
    }'''
    t = t.replace(old, new, 1)
    while old in t:
        t = t.replace(old, "", 1)
    p.write_text(t)
    print("vm ok")
elif "Random.nextDouble() < 0.6" in t:
    print("vm already")
else:
    print("vm miss")

p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = p.read_text()
if "if (false && showDiscovery && state.gameShow)" in t:
    p.write_text(t.replace("if (false && showDiscovery && state.gameShow)", "if (showDiscovery && state.gameShow)"))
    print("shell ok")
else:
    print("shell skip")
