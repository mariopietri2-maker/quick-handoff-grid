#!/usr/bin/env python3
"""Make driver-map store pins larger and order counts easy to read."""
from pathlib import Path
import re

NEW_CREATE = r'''private fun createStoreMarkerBitmap(photo: Bitmap?, name: String, count: Long): Bitmap {
    // Larger pin so stores stay readable on the driver map; count badge always visible.
    val box = 104f
    val radius = 22f
    val badgeH = 32f
    val gap = 6f
    val pad = 6f
    val countLabel = if (count > 99) "99+" else count.toString()
    val badgeW = maxOf(48f, 18f + countLabel.length * 14f)
    val w = (box + pad * 2).toInt()
    val h = (pad + box + gap + badgeH + pad).toInt()
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bmp)

    val rect = RectF(pad, pad, pad + box, pad + box)
    val hasOrders = count > 0

    canvas.drawRoundRect(
        RectF(rect.left - 3f, rect.top - 3f, rect.right + 3f, rect.bottom + 3f),
        radius + 2f,
        radius + 2f,
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.argb(if (hasOrders) 140 else 90, 6, 193, 103)
            style = Paint.Style.FILL
        },
    )

    val clip = Path().apply { addRoundRect(rect, radius, radius, Path.Direction.CW) }
    canvas.save()
    canvas.clipPath(clip)
    if (photo != null) {
        val shader = BitmapShader(photo, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
        val scale = maxOf(rect.width() / photo.width, rect.height() / photo.height)
        val matrix = Matrix().apply {
            setScale(scale, scale)
            postTranslate(
                rect.centerX() - photo.width * scale / 2f,
                rect.centerY() - photo.height * scale / 2f,
            )
        }
        shader.setLocalMatrix(matrix)
        canvas.drawRect(rect, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.shader = shader })
    } else {
        canvas.drawRect(rect, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.parseColor("#0B2E20")
        })
        val letter = (name.firstOrNull()?.toString() ?: "S").uppercase()
        val tp = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.parseColor("#2FE795")
            textSize = 42f
            textAlign = Paint.Align.CENTER
            typeface = Typeface.DEFAULT_BOLD
        }
        val baseline = rect.centerY() - (tp.descent() + tp.ascent()) / 2f
        canvas.drawText(letter, rect.centerX(), baseline, tp)
    }
    canvas.restore()

    canvas.drawRoundRect(
        rect,
        radius,
        radius,
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 5.5f
            color = android.graphics.Color.WHITE
        },
    )
    canvas.drawRoundRect(
        rect,
        radius,
        radius,
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 3f
            color = if (hasOrders) android.graphics.Color.parseColor("#2FE795")
            else android.graphics.Color.parseColor("#06C167")
        },
    )

    val badgeLeft = w / 2f - badgeW / 2f
    val badgeTop = pad + box + gap
    val badgeRect = RectF(badgeLeft, badgeTop, badgeLeft + badgeW, badgeTop + badgeH)
    canvas.drawRoundRect(
        badgeRect,
        badgeH / 2f,
        badgeH / 2f,
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = if (hasOrders) android.graphics.Color.parseColor("#06C167")
            else android.graphics.Color.parseColor("#1A2420")
        },
    )
    canvas.drawRoundRect(
        badgeRect,
        badgeH / 2f,
        badgeH / 2f,
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 2.2f
            color = android.graphics.Color.WHITE
        },
    )
    val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        textSize = 18f
        textAlign = Paint.Align.CENTER
        typeface = Typeface.DEFAULT_BOLD
    }
    val textBaseline = badgeRect.centerY() - (textPaint.descent() + textPaint.ascent()) / 2f
    canvas.drawText(countLabel, badgeRect.centerX(), textBaseline, textPaint)

    return bmp
}
'''

def main() -> None:
    p = Path("native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/map/DriverMapView.kt")
    t = p.read_text(encoding="utf-8")
    start = t.find("private fun createStoreMarkerBitmap(photo: Bitmap?, name: String, count: Long): Bitmap {")
    end = t.find("\n@Composable", start)
    if start < 0 or end < 0:
        raise SystemExit("createStoreMarkerBitmap bounds missing")
    t = t[:start] + NEW_CREATE + t[end:]

    old_ann = '''                .withIconSize(0.9)
                .withTextField(m.name.take(16))
                .withTextSize(10.0)
                .withTextOffset(listOf(0.0, 2.1))
                .withTextColor(textColor)
                .withTextHaloColor(haloColor)
                .withTextHaloWidth(1.4)'''
    new_ann = '''                .withIconSize(1.35)
                .withTextField(
                    if (m.count > 0) "${m.count} · ${m.name.take(14)}" else m.name.take(16),
                )
                .withTextSize(12.0)
                .withTextOffset(listOf(0.0, 2.35))
                .withTextColor(textColor)
                .withTextHaloColor(haloColor)
                .withTextHaloWidth(2.0)'''
    if old_ann in t:
        t = t.replace(old_ann, new_ann)
        print("annotations updated")
    elif "withIconSize(1.35)" in t:
        print("annotations already large")
    else:
        print("WARN annotations")
    p.write_text(t, encoding="utf-8")

    r = Path("native-driver/app/src/main/java/com/freshdelivery/nativedriver/data/DriverRepository.kt")
    rt = r.read_text(encoding="utf-8")
    old_fetch = '''    suspend fun fetchMapStores(): List<StoreRow> {
        return client.from("stores_public")
            .select(Columns.list("id", "name", "latitude", "longitude", "image_url", "cover_image_url")) {
                order("name", Order.ASCENDING)
                limit(100L)
            }.decodeList<StoreRow>()
    }'''
    new_fetch = '''    suspend fun fetchMapStores(): List<StoreRow> {
        return client.from("stores_public")
            .select(Columns.list("id", "name", "latitude", "longitude", "image_url", "cover_image_url", "is_active")) {
                order("name", Order.ASCENDING)
                limit(150L)
            }.decodeList<StoreRow>()
            .filter { (it.is_active != false) && it.latitude != null && it.longitude != null }
    }'''
    if old_fetch in rt:
        rt = rt.replace(old_fetch, new_fetch)
        print("fetchMapStores")
    old_counts = '''    suspend fun fetchStoreActiveCounts(): Map<String, Long> {
        val rows = runCatching {
            client.postgrest.rpc("get_store_active_order_counts").decodeList<StoreCountRow>()
        }.getOrDefault(emptyList())
        return rows.associate { it.store_id to (it.active_count ?: 0L) }
    }'''
    new_counts = '''    suspend fun fetchStoreActiveCounts(): Map<String, Long> {
        val rows = runCatching {
            client.postgrest.rpc("get_store_active_order_counts").decodeList<StoreCountRow>()
        }.getOrDefault(emptyList())
        if (rows.isNotEmpty()) {
            return rows.associate { it.store_id to (it.active_count ?: 0L) }
        }
        return runCatching {
            client.from("orders")
                .select(Columns.list("store_id")) {
                    filter {
                        isIn("status", listOf("placed", "accepted", "preparing", "ready"))
                        exact("driver_id", null)
                    }
                    limit(500L)
                }.decodeList<StoreIdOnlyRow>()
                .groupingBy { it.store_id }
                .eachCount()
                .mapValues { it.value.toLong() }
        }.getOrDefault(emptyMap())
    }'''
    if old_counts in rt:
        rt = rt.replace(old_counts, new_counts)
        print("counts fallback")
    r.write_text(rt, encoding="utf-8")

    m = Path("native-driver/app/src/main/java/com/freshdelivery/nativedriver/data/Models.kt")
    mt = m.read_text(encoding="utf-8")
    if "is_active" not in mt[mt.find("data class StoreRow"):mt.find("data class StoreRow")+450]:
        mt = mt.replace(
            "    val cover_image_url: String? = null,\n)",
            "    val cover_image_url: String? = null,\n    val is_active: Boolean? = true,\n)",
            1,
        )
        print("StoreRow is_active")
    if "StoreIdOnlyRow" not in mt:
        mt = mt.replace(
            "@Serializable\ndata class StoreCountRow(",
            "@Serializable\ndata class StoreIdOnlyRow(val store_id: String)\n\n@Serializable\ndata class StoreCountRow(",
        )
        print("StoreIdOnlyRow")
    m.write_text(mt, encoding="utf-8")

    g = Path("native-driver/app/build.gradle.kts")
    gt = g.read_text(encoding="utf-8")
    gt = re.sub(r"versionCode = \d+", "versionCode = 267", gt, count=1)
    gt = re.sub(r'versionName = "[^"]+"', 'versionName = "2.6.16-native"', gt, count=1)
    g.write_text(gt, encoding="utf-8")
    print("version 2.6.16")

    apk = Path("src/lib/apk-downloads.ts")
    if apk.exists():
        at = apk.read_text(encoding="utf-8")
        at = re.sub(
            r"APK_NATIVE_DRIVER_VERSION = '[^']+'",
            "APK_NATIVE_DRIVER_VERSION = '2.6.16-native'",
            at,
        )
        apk.write_text(at, encoding="utf-8")
        print("website label")

if __name__ == "__main__":
    main()
