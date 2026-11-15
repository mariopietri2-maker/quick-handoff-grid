#!/usr/bin/env python3
from pathlib import Path

m = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/Models.kt')
t = m.read_text()
old = '''data class PromoBanner(
    val tag: String = "NEW",
    val title: String = "",
    val subtitle: String = "",
    val code: String = "",
    val gradient: String = "hero",
    val enabled: Boolean = true,
    val imageUrl: String? = null,
)'''
new = '''data class PromoBanner(
    val tag: String = "NEW",
    val title: String = "",
    val subtitle: String = "",
    val code: String = "",
    val gradient: String = "hero",
    val enabled: Boolean = true,
    val imageUrl: String? = null,
    /** Optional store id or name from admin promo link. */
    val storeId: String? = null,
)'''
if old in t:
    m.write_text(t.replace(old, new, 1))
    print('model ok')
elif 'val storeId' in t:
    print('model already')
else:
    print('model miss')

r = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/CustomerRepository.kt')
rt = r.read_text()
old_c = '''                PromoBanner(
                    tag = o["tag"]?.jsonPrimitive?.contentOrNull.orEmpty().ifBlank { "NEW" },
                    title = o["title"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    subtitle = o["subtitle"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    code = o["code"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    gradient = o["gradient"]?.jsonPrimitive?.contentOrNull ?: "hero",
                    enabled = true,
                    imageUrl = o["image_url"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() },
                )'''
new_c = '''                PromoBanner(
                    tag = o["tag"]?.jsonPrimitive?.contentOrNull.orEmpty().ifBlank { "NEW" },
                    title = o["title"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    subtitle = o["subtitle"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    code = o["code"]?.jsonPrimitive?.contentOrNull.orEmpty(),
                    gradient = o["gradient"]?.jsonPrimitive?.contentOrNull ?: "hero",
                    enabled = true,
                    imageUrl = o["image_url"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() },
                    storeId = o["store_id"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() },
                )'''
if old_c in rt:
    r.write_text(rt.replace(old_c, new_c, 1))
    print('repo ok')
elif 'storeId = o["store_id"]' in rt:
    print('repo already')
else:
    print('repo miss')
print('done')
