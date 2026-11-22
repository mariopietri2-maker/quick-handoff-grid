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
        'TextButton(onClick = onDownload) { Text("Λήψη & εγκατάσταση") }',
        'if (playStoreOnly) { TextButton(onClick = onOpenPlayStore) { Text("Ενημέρωση στο Play Store") } } else { TextButton(onClick = onDownload) { Text("Λήψη & εγκατάσταση") } }',
    )
    p.write_text(t)
    print("dialog patched")

def patch_main():
    p = ROOT / "native-customer/app/src/main/java/com/freshdelivery/nativecustomer/MainActivity.kt"
    t = p.read_text()
    if "onOpenPlayStore" in t:
        print("main ok")
        return
    if "onDownload =" in t:
        t = t.replace("onDownload =", "onOpenPlayStore = { updateChecker.openPlayStore() },\n                    playStoreOnly = true,\n                    onDownload =", 1)
        p.write_text(t)
        print("main patched")

def patch_models():
    p = ROOT / "native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/Models.kt"
    t = p.read_text()
    block = t.split("data class OrderRow")[1].split("data class")[0]
    if "payment_status" in block:
        print("models ok")
        return
    t = t.replace("val payment_method: String? = null,\n)", "val payment_method: String? = null,\n    val payment_status: String? = null,\n)")
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
    t += "\n\ninternal fun paymentStatusLabel(method: String?, status: String?, orderStatus: String?): String? {\n    val m = method?.lowercase().orEmpty()\n    if (m != \"card\" && m != \"stripe\") {\n        if (m == \"cash\") return \"Πληρωμή: μετρητά\"\n        return null\n    }\n    val ps = status?.lowercase().orEmpty()\n    return when {\n        ps in setOf(\"paid\", \"succeeded\", \"complete\", \"completed\") -> \"Πληρώθηκε με κάρτα ✓\"\n        orderStatus != null && orderStatus !in setOf(\"pending\", \"placed\") && ps !in setOf(\"failed\", \"unpaid\") ->\n            \"Πληρώθηκε με κάρτα ✓\"\n        ps in setOf(\"failed\", \"canceled\", \"cancelled\") -> \"Πληρωμή απέτυχε\"\n        else -> \"Αναμονή πληρωμής κάρτας\"\n    }\n}\n\ninternal fun isOrderPaid(method: String?, paymentStatus: String?, orderStatus: String?): Boolean {\n    val m = method?.lowercase().orEmpty()\n    if (m == \"cash\" || m == \"cod\") return true\n    val ps = paymentStatus?.lowercase().orEmpty()\n    if (ps in setOf(\"paid\", \"succeeded\", \"complete\", \"completed\")) return true\n    if (orderStatus != null && orderStatus !in setOf(\"pending\", \"placed\")) return m == \"card\" || m == \"stripe\" || m.isEmpty()\n    return false\n}\n"
    p.write_text(t)
    print("status ui patched")

def patch_vm():
    p = ROOT / "native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt"
    t = p.read_text()
    t = t.replace(
        'info = "Η πληρωμή ολοκληρώθηκε! Πληρωμή OK — η παραγγελία πάει στο κατάστημα μόνο μετά την επιβεβαίωση Stripe…",',
        'info = "Πληρώθηκε ✓ — στέλνουμε την παραγγελία στο κατάστημα…",',
    )
    t = t.replace(
        'info = "Ολοκλήρωσε την πληρωμή στο φύλλο κάρτας.",',
        'info = "Συμπλήρωσε τα στοιχεία κάρτας για άμεση πληρωμή.",',
    )
    t = t.replace(
        'info = "Η πληρωμή ολοκληρώθηκε!",',
        'info = "Πληρώθηκε ✓ Η παραγγελία στάλθηκε στο κατάστημα.",',
    )
    p.write_text(t)
    print("vm patched")

def patch_shell():
    p = ROOT / "native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt"
    t = p.read_text()
    new_headline = '''private fun trackHeadline(
    status: String,
    hasDriverLoc: Boolean,
    platformDelivery: Boolean = true,
    paid: Boolean = true,
    paymentMethod: String? = null,
): Pair<String, String> = when (status) {
    "pending" -> {
        if (!paid && paymentMethod?.lowercase() == "card")
            "Ολοκλήρωσε την πληρωμή" to "Με κάρτα — μόλις πληρωθεί, η παραγγελία πάει στο κατάστημα"
        else
            "Σε επεξεργασία" to "Επιβεβαιώνουμε την παραγγελία"
    }
    "placed" -> "Στάλθηκε στο κατάστημα" to (if (paid) "Πληρωμή OK · περιμένουμε αποδοχή" else "Περιμένουμε επιβεβαίωση από το κατάστημα")
    "accepted", "confirmed" -> "Το κατάστημα αποδέχτηκε" to "Ετοιμάζουν την παραγγελία σου"
    "preparing" -> "Ετοιμάζεται" to "Το κατάστημα μαγειρεύει / ετοιμάζει"
    "ready" -> {
        if (platformDelivery)
            "Έτοιμη από το κατάστημα" to (if (hasDriverLoc) "Ο οδηγός Fresh2GO πλησιάζει" else "Αναζητούμε οδηγό Fresh2GO")
        else
            "Έτοιμη" to "Το κατάστημα θα την παραδώσει · δεν περιμένεις οδηγό πλατφόρμας"
    }
    "picked_up", "on_the_way", "in_transit", "arrived" -> {
        if (platformDelivery)
            "Καθ' οδόν" to (if (hasDriverLoc) "Ο οδηγός είναι στο δρόμο" else "Παράδοση Fresh2GO")
        else
            "Καθ' οδόν από το κατάστημα" to "Παράδοση από το κατάστημα — ολοκληρώνεται χωρίς οδηγό συστήματος"
    }
    "delivered" -> "Παραδόθηκε" to "Καλή όρεξη!"
    "cancelled" -> "Ακυρώθηκε" to "Η παραγγελία ακυρώθηκε"
    else -> statusLabel(status) to ""
}'''
    if "platformDelivery: Boolean" not in t:
        m = re.search(
            r"private fun trackHeadline\(status: String, hasDriverLoc: Boolean\): Pair<String, String> = when \(status\) \{.*?\n\}",
            t,
            re.S,
        )
        if m:
            t = t[: m.start()] + new_headline + t[m.end() :]
            print("headline replaced")
        else:
            print("headline miss")
    if "trackHeadline(order.order.status, state.driverLocation != null)" in t:
        t = t.replace(
            "trackHeadline(order.order.status, state.driverLocation != null)",
            "run {\n                    val store = state.stores.firstOrNull { it.id == order.order.store_id }\n                    val platform = store == null || isPlatformFulfilment(store)\n                    val paid = isOrderPaid(order.order.payment_method, order.order.payment_status, order.order.status)\n                    trackHeadline(\n                        order.order.status,\n                        state.driverLocation != null,\n                        platformDelivery = platform,\n                        paid = paid,\n                        paymentMethod = order.order.payment_method,\n                    )\n                }",
        )
        print("headline call ok")
    if "Το κατάστημα παραδίδει με τον δικό του διανομέα." in t and "δεν περιμένεις οδηγό συστήματος" not in t:
        t = t.replace(
            'order.order.status in listOf("ready", "picked_up", "on_the_way", "in_transit", "arrived") ->\n                                        "Το κατάστημα παραδίδει με τον δικό του διανομέα."',
            'order.order.status in listOf("ready", "picked_up", "on_the_way", "in_transit", "arrived") -> {\n                                        val store = state.stores.firstOrNull { it.id == order.order.store_id }\n                                        if (store != null && !isPlatformFulfilment(store))\n                                            "Το κατάστημα παραδίδει με τον δικό του διανομέα — δεν περιμένεις οδηγό συστήματος."\n                                        else if (order.order.status == "ready")\n                                            "Έτοιμη — αναζητούμε οδηγό Fresh2GO."\n                                        else\n                                            "Ο οδηγός Fresh2GO είναι καθ\' οδόν."\n                                    }',
        )
        print("ready banner patched")
    if "paymentStatusLabel(" not in t:
        t = t.replace(
            "StatusPill(order.order.status)",
            "StatusPill(order.order.status)\n                    paymentStatusLabel(order.order.payment_method, order.order.payment_status, order.order.status)?.let { payLabel ->\n                        Spacer(modifier = Modifier.height(6.dp))\n                        Surface(\n                            color = if (payLabel.contains(\"Πληρώθηκε\")) FreshGreenSoft else FreshChip,\n                            shape = RoundedCornerShape(999.dp),\n                        ) {\n                            Text(\n                                payLabel,\n                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),\n                                style = MaterialTheme.typography.labelMedium,\n                                fontWeight = FontWeight.SemiBold,\n                                color = if (payLabel.contains(\"Πληρώθηκε\")) FreshGreenDark else FreshInk,\n                            )\n                        }\n                    }",
            1,
        )
        print("pay chip added")
    p.write_text(t)
    print("shell done")

def main():
    patch_checker()
    patch_dialog()
    patch_main()
    patch_models()
    patch_repo()
    patch_order_status_ui()
    patch_vm()
    patch_shell()
    print("CUSTOMER_UX_PATCH_OK")

if __name__ == "__main__":
    main()
