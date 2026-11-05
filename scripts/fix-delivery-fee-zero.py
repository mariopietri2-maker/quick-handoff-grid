#!/usr/bin/env python3
from pathlib import Path

# --- Models: PlatformFees defaults 0 ---
models = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/Models.kt")
mt = models.read_text()
mt2 = mt.replace(
    "val platform_service_fee: Double? = 0.99,",
    "val platform_service_fee: Double? = 0.0,",
)
if mt2 == mt:
    print("Models: platform_service_fee default already ok or missing")
else:
    models.write_text(mt2)
    print("Models: default fee -> 0")

# --- Repository: implement platformFees from RPC ---
repo = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/CustomerRepository.kt")
rt = repo.read_text()
old = "suspend fun platformFees(): PlatformFees = PlatformFees()"
new = '''suspend fun platformFees(): PlatformFees {
        return runCatching {
            val raw = client.postgrest.rpc("get_platform_settings_public")
            val row = raw.decodeList<JsonObject>().firstOrNull() ?: return@runCatching PlatformFees(
                platform_service_fee = 0.0,
                customer_base_fee = 0.0,
                customer_per_km_fee = 0.0,
            )
            fun num(key: String): Double? =
                row[key]?.jsonPrimitive?.contentOrNull?.toDoubleOrNull()
                    ?: row[key]?.jsonPrimitive?.doubleOrNull
            PlatformFees(
                platform_service_fee = num("platform_service_fee") ?: 0.0,
                customer_base_fee = num("customer_base_fee") ?: 0.0,
                customer_per_km_fee = num("customer_per_km_fee") ?: 0.0,
            )
        }.getOrElse {
            PlatformFees(
                platform_service_fee = 0.0,
                customer_base_fee = 0.0,
                customer_per_km_fee = 0.0,
            )
        }
    }'''
if old in rt:
    repo.write_text(rt.replace(old, new, 1))
    print("Repo: platformFees loads from get_platform_settings_public")
else:
    print("Repo: platformFees stub not found")

# Ensure JsonObject / doubleOrNull imports exist
rt = repo.read_text()
if "jsonPrimitive" in rt and "import kotlinx.serialization.json.JsonObject" not in rt:
    if "import kotlinx.serialization.json" in rt:
        pass
    # file already uses JsonObject elsewhere likely
if "doubleOrNull" not in rt:
    # contentOrNull path is enough
    pass

# --- ViewModel defaults 0.0 instead of 0.99 ---
vm = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
vt = vm.read_text()
vt = vt.replace("val deliveryFee: Double = 0.99,", "val deliveryFee: Double = 0.0,")
vt = vt.replace("val feeBase: Double = 0.99,", "val feeBase: Double = 0.0,")
vt = vt.replace(
    "val base = fees.customer_base_fee ?: fees.platform_service_fee ?: 0.99",
    "val base = fees.customer_base_fee ?: fees.platform_service_fee ?: 0.0",
)
vm.write_text(vt)
print("ViewModel: defaults and fallback -> 0.0")
