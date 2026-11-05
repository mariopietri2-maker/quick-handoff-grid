#!/usr/bin/env python3
from pathlib import Path

login = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/LoginScreen.kt")
t = login.read_text()

# Hide Google button block (keep callback param for call-site compatibility)
old = '''        // Google Sign-In (testers feedback)
        OutlinedButton(
            onClick = onGoogleSignIn,
            enabled = !busy,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = RoundedCornerShape(26.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF1C1917)),
        ) {
            Text("Συνέχεια με Google", fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.height(12.dp))
        Text("ή με email", color = FreshMuted, style = MaterialTheme.typography.labelMedium)
        Spacer(Modifier.height(12.dp))
'''

new = '''        // Google Sign-In disabled for soft launch (email/password only)
        // Re-enable when GOOGLE_WEB_CLIENT_ID is configured in the release build.
'''

if old in t:
    t = t.replace(old, new, 1)
    print("Google button removed")
elif "Συνέχεια με Google" in t:
    # broader remove
    start = t.find("// Google Sign-In")
    if start < 0:
        start = t.find("Συνέχεια με Google")
        start = t.rfind("OutlinedButton", 0, start)
    end = t.find('Text("ή με email"', start)
    if end > start:
        # remove through spacer after ή με email line block
        end2 = t.find("\n", t.find("Spacer", end)) 
        # find second spacer after ή με email
        idx = t.find("ή με email", start)
        # cut from Google comment/button to after the "ή με email" spacers
        chunk_end = t.find("Button(", idx)
        if chunk_end > start:
            t = t[:start] + "        // Google Sign-In disabled (soft launch)\n" + t[chunk_end:]
            print("Google block stripped broadly")
        else:
            raise SystemExit("could not strip google block")
    else:
        raise SystemExit("google markers messy")
else:
    print("Google UI already absent")

login.write_text(t)

# MainActivity: no-op Google handler message quieter
main = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/MainActivity.kt")
if main.exists():
    mt = main.read_text()
    # leave code but user won't see button
    print("MainActivity left as-is (button hidden)")
