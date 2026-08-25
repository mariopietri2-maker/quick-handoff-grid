from pathlib import Path
import re

def main() -> None:
    p = Path("native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/auth/LoginScreen.kt")
    t = p.read_text()
    if "BuildConfig.VERSION_NAME" in t:
        print("login version already present")
    else:
        if "import com.freshdelivery.nativedriver.BuildConfig" not in t:
            t = t.replace(
                "import com.freshdelivery.nativedriver.R\n",
                "import com.freshdelivery.nativedriver.BuildConfig\nimport com.freshdelivery.nativedriver.R\n",
            )
        old = """            Text(
                "Με την είσοδο αποδέχεσαι τους όρους χρήσης",
                style = MaterialTheme.typography.labelSmall,
                color = cs.onSurfaceVariant.copy(alpha = 0.7f),
                textAlign = TextAlign.Center,
            )
        }
    }
}"""
        new = """            Text(
                "Με την είσοδο αποδέχεσαι τους όρους χρήσης",
                style = MaterialTheme.typography.labelSmall,
                color = cs.onSurfaceVariant.copy(alpha = 0.7f),
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(12.dp))
            Text(
                text = "v${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})",
                style = MaterialTheme.typography.labelSmall,
                color = cs.onSurfaceVariant.copy(alpha = 0.55f),
                textAlign = TextAlign.Center,
            )
        }
    }
}"""
        if old not in t:
            raise SystemExit("driver login end not found")
        t = t.replace(old, new, 1)
        p.write_text(t)
        print("driver login patched")

    g = Path("native-driver/app/build.gradle.kts")
    gt = g.read_text()
    gt = re.sub(r"versionCode = \d+", "versionCode = 265", gt, count=1)
    gt = re.sub(r'versionName = "[^"]+"', 'versionName = "2.6.14-native"', gt, count=1)
    g.write_text(gt)
    print("driver version 2.6.14")

    # ensure customer still 2.7.2
    cg = Path("native-customer/app/build.gradle.kts")
    cgt = cg.read_text()
    if "2.7.2-native" not in cgt:
        cgt = re.sub(r"versionCode = \d+", "versionCode = 254", cgt, count=1)
        cgt = re.sub(r'versionName = "[^"]+"', 'versionName = "2.7.2-native"', cgt, count=1)
        cg.write_text(cgt)
        print("customer version forced 2.7.2")

if __name__ == "__main__":
    main()
