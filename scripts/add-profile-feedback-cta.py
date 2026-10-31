#!/usr/bin/env python3
"""Add in-app feedback row on ProfileTab (opens support)."""
from pathlib import Path

p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = p.read_text()

if "Στείλε feedback" in t or "Στείλε Feedback" in t:
    print("already has feedback CTA")
    raise SystemExit(0)

# Insert feedback card before the final sign-out OutlinedButton block in ProfileTab
needle = '''        Spacer(Modifier.height(24.dp))
        OutlinedButton(
            onClick = onSignOut,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = RoundedCornerShape(24.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = FreshRose),
            border = androidx.compose.foundation.BorderStroke(1.5.dp, FreshRose),
        ) {
            Icon(Icons.Outlined.Logout, contentDescription = null, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
            Text("Αποσύνδεση", fontWeight = FontWeight.Bold)
        }
'''

insert = '''        Spacer(Modifier.height(16.dp))
        // Tester feedback CTA — opens support (Play / soft-launch insights)
        Surface(
            onClick = onOpenSupport,
            shape = RoundedCornerShape(18.dp),
            color = Color.White,
            shadowElevation = 3.dp,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Row(
                Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.RateReview, contentDescription = null, tint = FreshGreen)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text("Στείλε feedback", fontWeight = FontWeight.Bold)
                    Text(
                        "Πες μας τι δουλεύει και τι όχι — βοηθάει το soft launch.",
                        color = FreshMuted,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                Icon(Icons.AutoMirrored.Outlined.KeyboardArrowRight, contentDescription = null, tint = FreshMuted)
            }
        }
        Spacer(Modifier.height(24.dp))
        OutlinedButton(
            onClick = onSignOut,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = RoundedCornerShape(24.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = FreshRose),
            border = androidx.compose.foundation.BorderStroke(1.5.dp, FreshRose),
        ) {
            Icon(Icons.Outlined.Logout, contentDescription = null, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
            Text("Αποσύνδεση", fontWeight = FontWeight.Bold)
        }
'''

if needle not in t:
    raise SystemExit("Profile sign-out block not found")

# Ensure RateReview icon import
if "RateReview" not in t:
    t = t.replace(
        "import androidx.compose.material.icons.outlined.AccountCircle",
        "import androidx.compose.material.icons.outlined.AccountCircle\nimport androidx.compose.material.icons.outlined.RateReview",
        1,
    )

t = t.replace(needle, insert, 1)
p.write_text(t)
print("feedback CTA added")
