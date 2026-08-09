package com.freshdelivery.nativecustomer.data

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.Json
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.RealtimeChannel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onEach
import java.util.UUID

class CustomerRepository(
    private val supabase = SupabaseModule.client
) {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun fetchOrders(userId: String): List<OrderUi> {
        val result = supabase.from("orders")
            .select(Columns.raw("*, stores(id, name, latitude, longitude), order_items(*, products(name, price, image_url))"))
            .eq("customer_id", userId)
            .order("created_at", ascending = false)
            .decodeList<JsonObject>()

        return result.map { row ->
            val store = row["stores"]?.jsonObject
            val items = row["order_items"]?.jsonArray ?: emptyList()
            OrderUi(
                id = row["id"]?.jsonPrimitive?.contentOrNull ?: "",
                status = row["status"]?.jsonPrimitive?.contentOrNull ?: "placed",
                total = row["total"]?.jsonPrimitive?.doubleOrNull ?: 0.0,
                createdAt = row["created_at"]?.jsonPrimitive?.contentOrNull ?: "",
                storeName = store?.get("name")?.jsonPrimitive?.contentOrNull ?: "Store",
                storeLat = store?.get("latitude")?.jsonPrimitive?.doubleOrNull,
                storeLng = store?.get("longitude")?.jsonPrimitive?.doubleOrNull,
                deliveryLat = row["delivery_lat"]?.jsonPrimitive?.doubleOrNull,
                deliveryLng = row["delivery_lng"]?.jsonPrimitive?.doubleOrNull,
                driverId = row["driver_id"]?.jsonPrimitive?.contentOrNull,
                items = items.map { it.jsonObject }.map { item ->
                    val product = item["products"]?.jsonObject
                    OrderItemUi(
                        name = product?.get("name")?.jsonPrimitive?.contentOrNull ?: "Item",
                        quantity = item["quantity"]?.jsonPrimitive?.intOrNull ?: 1,
                        price = product?.get("price")?.jsonPrimitive?.doubleOrNull ?: 0.0,
                        imageUrl = product?.get("image_url")?.jsonPrimitive?.contentOrNull
                    )
                }
            )
        }
    }

    // ... remaining methods truncated for this call - will do full in next if needed
}
