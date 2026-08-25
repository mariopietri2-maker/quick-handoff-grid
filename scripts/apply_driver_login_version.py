from pathlib import Path
import re

def main() -> None:
    p = Path("native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/auth/LoginScreen.kt")
    if not p.exists():
        raise SystemExit(f"missing {p}")
    t = p.read_text(encoding="utf-8")

    if "BuildConfig.VERSION_NAME" not in t:
        if "import com.freshdelivery.nativedriver.BuildConfig" not in t:
            t = t.replace(
                "import com.freshdelivery.nativedriver.R\n",
                "import com.freshdelivery.nativedriver.BuildConfig\nimport com.freshdelivery.nativedriver.R\n",
            )
        needle = 'textAlign = TextAlign.Center,\n            )\n        }\n    }\n}'
        # Insert version before closing Column of the terms Text block
        marker = '"Με την είσοδο αποδέχεσαι τους όρους χρήσης"'
        idx = t.find(marker)
        if idx < 0:
            raise SystemExit("terms text not found")
        # find the closing of that Text( ... ) after marker
        close = t.find(")", t.find("textAlign = TextAlign.Center", idx))
        if close < 0:
            raise SystemExit("could not find Text close")
        insert_at = close + 1
        block = '''
            Spacer(Modifier.height(12.dp))
            Text(
                text = "v${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})",
                style = MaterialTheme.typography.labelSmall,
                color = cs.onSurfaceVariant.copy(alpha = 0.55f),
                textAlign = TextAlign.Center,
            )'''
        t = t[:insert_at] + block + t[insert_at:]
        p.write_text(t, encoding="utf-8")
        print("login version inserted")
    else:
        print("login version already present")

    g = Path("native-driver/app/build.gradle.kts")
    gt = g.read_text(encoding="utf-8")
    gt = re.sub(r"versionCode = \d+", "versionCode = 265", gt, count=1)
    gt = re.sub(r'versionName = "[^"]+"', 'versionName = "2.6.14-native"', gt, count=1)
    g.write_text(gt, encoding="utf-8")
    print("driver 2.6.14-native (265)")

if __name__ == "__main__":
    main()
