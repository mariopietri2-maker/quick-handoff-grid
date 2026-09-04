from pathlib import Path

repo = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/CustomerRepository.kt")
rt = repo.read_text()
if "fun fetchAppConfig" not in rt:
    insert = '''
    suspend fun fetchAppConfig(): CustomerAppConfig {
        val row = runCatching {
            client.postgrest.from("customer_app_config").select { limit(1L) }.decodeSingleOrNull<CustomerAppConfigRow>()
        }.getOrNull()
        val el = row?.published_config ?: return CustomerAppConfig()
        return runCatching {
            val obj = el.jsonObject
            fun str(k: String, d: String) = obj[k]?.jsonPrimitive?.contentOrNull ?: d
            val tiles = obj["tiles"]?.jsonArray?.mapNotNull { x ->
                val o = x.jsonObject
                CategoryTile(
                    label = o["label"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null,
                    emoji = o["emoji"]?.jsonPrimitive?.contentOrNull ?: "•",
                    category = o["category"]?.jsonPrimitive?.contentOrNull ?: "all",
                )
            } ?: CustomerAppConfig().tiles
            val promos = obj["promos"]?.jsonArray?.mapNotNull { x ->
                val o = x.jsonObject
                PromoBanner(
                    tag = o["tag"]?.jsonPrimitive?.contentOrNull ?: "NEW",
                    title = o["title"]?.jsonPrimitive?.contentOrNull ?: "",
                    subtitle = o["subtitle"]?.jsonPrimitive?.contentOrNull ?: "",
                    code = o["code"]?.jsonPrimitive?.contentOrNull ?: "",
                    enabled = o["enabled"]?.jsonPrimitive?.booleanOrNull ?: true,
                )
            }?.filter { it.enabled } ?: CustomerAppConfig().promos
            CustomerAppConfig(
                appName = str("appName", "Fresh Meal"),
                cityLabel = str("cityLabel", "Ιωάννινα"),
                tagline = str("tagline", "Fast · Fresh · Local"),
                logoUrl = obj["logoUrl"]?.jsonPrimitive?.contentOrNull,
                tiles = tiles,
                promos = promos,
            )
        }.getOrDefault(CustomerAppConfig())
    }
'''
    idx = rt.find("suspend fun placeOrder")
    assert idx > 0, "placeOrder not found"
    rt = rt[:idx] + insert + rt[idx:]
    for imp in [
        "import kotlinx.serialization.json.jsonObject",
        "import kotlinx.serialization.json.jsonArray",
        "import kotlinx.serialization.json.jsonPrimitive",
        "import kotlinx.serialization.json.contentOrNull",
        "import kotlinx.serialization.json.booleanOrNull",
    ]:
        if imp not in rt:
            lines = rt.splitlines()
            for i, ln in enumerate(lines):
                if ln.startswith("import "):
                    lines.insert(i, imp)
                    break
            rt = "\n".join(lines) + "\n"
    repo.write_text(rt)
    print("fetchAppConfig added")
else:
    print("fetchAppConfig already present")

vm = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
vt = vm.read_text()
if "appConfig:" not in vt:
    vt = vt.replace(
        "val info: String? = null,\n) {",
        "val info: String? = null,\n    val appConfig: com.freshdelivery.nativecustomer.data.CustomerAppConfig = com.freshdelivery.nativecustomer.data.CustomerAppConfig(),\n) {",
    )
    vt = vt.replace(
        "recomputeDeliveryFee()\n        }\n        registerFcm(userId)",
        "recomputeDeliveryFee()\n        }\n        runCatching {\n            val cfg = repo.fetchAppConfig()\n            _state.value = _state.value.copy(appConfig = cfg)\n        }\n        registerFcm(userId)",
    )
    vm.write_text(vt)
    print("ViewModel appConfig wired")
else:
    print("ViewModel appConfig already present")
