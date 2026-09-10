#!/usr/bin/env python3
"""Add efood-style Παράγγειλε ξανά (open same store from a past order)."""
from pathlib import Path
import sys

vm = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
shell = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
main = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/MainActivity.kt")

if not vm.exists():
    sys.exit(0)

t = vm.read_text()
if "fun reorderFromOrder" not in t:
    needle = "    fun openStore(store: StoreRow) {"
    insert = (
        "    /** efood-style order again: jump into the same store from a past order. */\n"
        "    fun reorderFromOrder(order: OrderUi) {\n"
        "        val storeId = order.order.store_id\n"
        "        val store = _state.value.stores.find { it.id == storeId }\n"
        "        if (store != null) {\n"
        "            openStore(store)\n"
        "            _state.update { it.copy(info = \"Παράγγειλε ξανά από ${store.name ?: \"το κατάστημα\"}\") }\n"
        "        } else {\n"
        "            _state.update {\n"
        "                it.copy(\n"
        "                    tab = CustomerTab.Home,\n"
        "                    info = \"Το κατάστημα δεν είναι διαθέσιμο αυτή τη στιγμή.\",\n"
        "                )\n"
        "            }\n"
        "        }\n"
        "    }\n"
        "\n"
    )
    if needle in t:
        vm.write_text(t.replace(needle, insert + needle, 1))
        print("ViewModel: reorderFromOrder")
    else:
        print("WARN: openStore not found")
else:
    print("ViewModel ok")

if shell.exists():
    t = shell.read_text()
    if "onReorderFromOrder" not in t:
        t = t.replace(
            "    onSendTicket: (String) -> Unit = {},\n) {",
            "    onSendTicket: (String) -> Unit = {},\n"
            "    onReorderFromOrder: (OrderUi) -> Unit = {},\n) {",
        )
    t = t.replace(
        "CustomerTab.Orders -> OrdersTab(state, onTrack, onRefresh, onSubmitReview, onBackToHome = { onTab(CustomerTab.Home) })",
        "CustomerTab.Orders -> OrdersTab(state, onTrack, onRefresh, onSubmitReview, "
        "onBackToHome = { onTab(CustomerTab.Home) }, onReorderFromOrder = onReorderFromOrder)",
    )
    old_sig = (
        "private fun OrdersTab(\n"
        "    state: CustomerUiState,\n"
        "    onTrack: (OrderUi?) -> Unit,\n"
        "    onRefresh: () -> Unit,\n"
        "    onSubmitReview: (String, String, Int, String) -> Unit = { _, _, _, _ -> },\n"
        "    onBackToHome: () -> Unit = {},\n"
        ") {"
    )
    new_sig = (
        "private fun OrdersTab(\n"
        "    state: CustomerUiState,\n"
        "    onTrack: (OrderUi?) -> Unit,\n"
        "    onRefresh: () -> Unit,\n"
        "    onSubmitReview: (String, String, Int, String) -> Unit = { _, _, _, _ -> },\n"
        "    onBackToHome: () -> Unit = {},\n"
        "    onReorderFromOrder: (OrderUi) -> Unit = {},\n"
        ") {"
    )
    t = t.replace(old_sig, new_sig)
    if "Παράγγειλε ξανά" not in t:
        old = (
            "                    .clickable { onTrack(item) }\n"
            "                    .padding(16.dp),\n"
            "            ) {"
        )
        new = (
            "                    .clickable { onTrack(item) }\n"
            "                    .padding(16.dp),\n"
            "            ) {\n"
            "                Row(\n"
            "                    Modifier.fillMaxWidth(),\n"
            "                    horizontalArrangement = Arrangement.End,\n"
            "                ) {\n"
            "                    TextButton(\n"
            "                        onClick = { onReorderFromOrder(item) },\n"
            "                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),\n"
            "                    ) {\n"
            "                        Text(\"Παράγγειλε ξανά\", color = FreshGreen, style = MaterialTheme.typography.labelLarge)\n"
            "                    }\n"
            "                }"
        )
        opos = t.find("items(state.orders, key = { it.order.id })")
        if opos >= 0:
            oend = t.find("private fun ProfileTab", opos)
            section = t[opos:oend]
            if old in section:
                t = t[:opos] + section.replace(old, new, 1) + t[oend:]
                print("Shell: order-again button")
    shell.write_text(t)
    print("Shell saved")

if main.exists():
    mt = main.read_text()
    if "onReorderFromOrder" not in mt:
        mt = mt.replace(
            "                            onSendTicket = vm::sendTicketMessage,\n                        )",
            "                            onSendTicket = vm::sendTicketMessage,\n"
            "                            onReorderFromOrder = vm::reorderFromOrder,\n                        )",
        )
        main.write_text(mt)
        print("MainActivity wired")
print("done")
