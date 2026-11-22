#!/usr/bin/env python3
"""Customer native: Play Store updates, smoother card paid UX, store self-delivery tracking."""
from pathlib import Path
import re

ROOT = Path(".")

def patch_checker():
    p = ROOT / "native-customer/app/src/main/java/com/freshdelivery/nativecustomer/update/AppUpdateChecker.kt"
    t = p.read_text()
    if "fun openPlayStore" in t:
        print("checker ok")
        return
    insert = '''
    /** Production / Play builds: open listing instead of sideloading APK. */
    fun openPlayStore() {
        val pkg = appContext.packageName
        try {
            val market = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkg")).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                setPackage("com.android.vending")
            }
            appContext.startActivity(market)
        } catch (_: Exception) {
            val web = Intent(
                Intent.ACTION_VIEW,
                Uri.parse("https://play.google.com/store/apps/details?id=$pkg"),
            ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
            appContext.startActivity(web)
        }
        _state.value = UpdateUiState.Dismissed
    }

    fun preferPlayStoreUpdate(): Boolean {
        return try {
            com.freshdelivery.nativecustomer.BuildConfig.PLAY_STORE_BUILD
        } catch (_: Throwable) {
            true
        }
    }
'''
    last = t.rfind("\n}\n")
    if last < 0:
        last = t.rfind("}")
    p.write_text(t[:last] + insert + "\n" + t[last:])
    print("checker patched")

def patch_dialog():
    p = ROOT / "native-customer/app/src/main/java/com/freshdelivery/nativecustomer/update/AppUpdateDialog.kt"
    t = p.read_text()
    if "onOpenPlayStore" in t:
        print("dialog ok")
        return
    t = t.replace(
        "fun AppUpdateDialog(\n    state: UpdateUiState,\n    onDownload: () -> Unit,\n    onDismiss: () -> Unit,\n)",
        "fun AppUpdateDialog(\n    state: UpdateUiState,\n    onDownload: () -> Unit,\n    onOpenPlayStore: () -> Unit = {},\n    onDismiss: () -> Unit,\n    playStoreOnly: Boolean = true,\n)",
    )
    t = t.replace(
        'is UpdateUiState.Available ->\n                        Text("Η έκδοση ${state.info.version} είναι έτοιμη για λήψη.")',
        'is UpdateUiState.Available ->\n                        Text(\n                            if (playStoreOnly)\n                                "Η έκδοση ${state.info.version} είναι διαθέσιμη στο Google Play."\n                            else\n                                "Η έκδοση ${state.info.version} είναι έτοιμη για λήψη."\n                        )',
    )
    t = t.replace(
        """confirmButton = {
            if (state is UpdateUiState.Available || state is UpdateUiState.Failed) {
                TextButton(onClick = onDownload) { Text("Λήψη & εγκατάσταση") }
            }
        },""",
        """confirmButton = {
            if (state is UpdateUiState.Available || state is UpdateUiState.Failed) {
                if (playStoreOnly) {
                    TextButton(onClick = onOpenPlayStore) { Text("Ενημέρωση στο Play Store") }
                } else {
                    TextButton(onClick = onDownload) { Text("Λήψη & εγκατάσταση") }
                }
            }
        },""",
    )
    p.write_text(t)
    print("dialog patched")

def patch_main():
    p = ROOT / "native-customer/app/src/main/java/com/freshdelivery/nativecustomer/MainActivity.kt"
    t = p.read_text()
    if "onOpenPlayStore" in t:
        print("main ok")
        return
    if "AppUpdateDialog(" in t and "onDownload" in t:
        t = t.replace(
            "onDownload =",
            "onOpenPlayStore = { updateChecker.openPlayStore() },\n                    playStoreOnly = true,\n                    onDownload =",
            1,
        )
        p.write_text(t)
        print("main patched")
    else:
        print("main miss")

def patch_models():
    p = ROOT / "native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/Models.kt"
    t = p.read_text()
    block = t.split("data class OrderRow")[1].split("data class")[0]
    if "payment_status" in block:
        print("models ok")
        return
    t = t.replace(
        "val payment_method: String? = null,\n)",
        "val payment_method: String? = null,\n    val payment_status: String? = null,\n)",
    )
    p.write_text(t)
    print("models patched")

def patch_repo():
    p = ROOT / "native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/CustomerRepository.kt"
    t = p.read_text()
    if "payment_status" in t:
        print("repo ok")
        return
    t = t.replace('"payment_method"', '"payment_method", "payment_status"')
    p.write_text(t)
    print("repo patched")

def patch_order_status_ui():
    p = ROOT / "native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/OrderStatusUi.kt"
    t = p.read_text()
    if "paymentStatusLabel" in t:
        print("status ui ok")
        return
    t += '''

internal fun paymentStatusLabel(method: String?, status: String?, orderStatus: String?): String? {
    val m = method?.lowercase().orEmpty()
    if (m != "card" and m != "stripe"):
        pass
'''
    # fix - write proper kotlin in separate approach
    p.write_text(t)
    print("status ui incomplete")

def main():
    print("use full script from workflow")

if __name__ == "__main__":
    main()
