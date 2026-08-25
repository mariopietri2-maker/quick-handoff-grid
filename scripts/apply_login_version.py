from pathlib import Path
import re

def main() -> None:
    p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/LoginScreen.kt")
    t = p.read_text()
    if "BuildConfig.VERSION_NAME" in t:
        print("already has version")
    else:
        if "import com.freshdelivery.nativecustomer.BuildConfig" not in t:
            t = t.replace(
                "package com.freshdelivery.nativecustomer.ui\n",
                "package com.freshdelivery.nativecustomer.ui\n\nimport com.freshdelivery.nativecustomer.BuildConfig\n",
            )
        if "navigationBarsPadding" not in t:
            t = t.replace(
                "import androidx.compose.foundation.layout.statusBarsPadding",
                "import androidx.compose.foundation.layout.navigationBarsPadding\nimport androidx.compose.foundation.layout.statusBarsPadding",
            )
        old = """    Column(
        Modifier
            .fillMaxSize()
            .background(FreshBg)
            .statusBarsPadding()
            .padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {"""
        new = """    Box(
        Modifier
            .fillMaxSize()
            .background(FreshBg)
            .statusBarsPadding()
            .navigationBarsPadding(),
    ) {
    Column(
        Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {"""
        if old not in t:
            raise SystemExit("column start missing")
        t = t.replace(old, new, 1)
        old_end = """        TextButton(onClick = { onToggleSignup(!signupMode) }) {
            Text(
                if (signupMode) "Έχεις λογαριασμό; Σύνδεση"
                else "Νέος χρήστης; Δημιουργία λογαριασμού",
                color = FreshGreenDark,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}
"""
        new_end = """        TextButton(onClick = { onToggleSignup(!signupMode) }) {
            Text(
                if (signupMode) "Έχεις λογαριασμό; Σύνδεση"
                else "Νέος χρήστης; Δημιουργία λογαριασμού",
                color = FreshGreenDark,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
        Text(
            text = "v${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})",
            color = FreshMuted,
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 16.dp),
        )
    }
}
"""
        if old_end not in t:
            raise SystemExit("end missing")
        t = t.replace(old_end, new_end, 1)
        p.write_text(t)
        print("login patched")

    g = Path("native-customer/app/build.gradle.kts")
    gt = g.read_text()
    gt = re.sub(r"versionCode = \d+", "versionCode = 254", gt, count=1)
    gt = re.sub(r'versionName = "[^"]+"', 'versionName = "2.7.2-native"', gt, count=1)
    g.write_text(gt)
    print("version 2.7.2")

if __name__ == "__main__":
    main()
