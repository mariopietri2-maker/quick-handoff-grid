#!/usr/bin/env python3
from pathlib import Path
p = Path('native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/home/HomeScreen.kt')
t = p.read_text()
if 'Αναμονή κλήσης καταστήματος' in t:
    print('already ok')
    raise SystemExit(0)
old = '''                            Text(
                                if (state.onBreak) "Σε διάλειμμα" else "Αναμονή παραγγελιών…",
                                fontWeight = FontWeight.Bold,
                                fontSize = 17.sp,
                                color = TextDark,
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                if (state.onBreak) "Δεν λαμβάνεις νέες προσφορές."
                                else "Θα εμφανιστούν αυτόματα όταν υπάρχει κοντινή παραγγελία.",
                                fontSize = 13.sp,
                                color = TextMuted,
                                textAlign = TextAlign.Center,
                            )'''
new = '''                            Text(
                                if (state.onBreak) "Σε διάλειμμα"
                                else if (state.isCallDriver) "Αναμονή κλήσης καταστήματος…"
                                else "Αναμονή παραγγελιών…",
                                fontWeight = FontWeight.Bold,
                                fontSize = 17.sp,
                                color = TextDark,
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                if (state.onBreak) "Δεν λαμβάνεις νέες προσφορές."
                                else if (state.isCallDriver) "Θα εμφανιστεί αυτόματα όταν ένα κατάστημα N καλέσει οδηγό."
                                else "Θα εμφανιστούν αυτόματα όταν υπάρχει κοντινή παραγγελία.",
                                fontSize = 13.sp,
                                color = TextMuted,
                                textAlign = TextAlign.Center,
                            )'''
if old not in t:
    raise SystemExit('pattern missing')
p.write_text(t.replace(old, new, 1))
print('patched')
