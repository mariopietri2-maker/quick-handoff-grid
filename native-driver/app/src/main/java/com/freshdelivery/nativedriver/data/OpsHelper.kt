package com.freshdelivery.nativedriver.data

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order

/**
 * Ops board helpers (admin / elevated M).
 * Separate from DriverRepository so we can ship without rewriting the large file.
 */
class OpsHelper(
    private val client: SupabaseClient = SupabaseProvider.client,
) {
    suspend fun loadRoles(userId: String): Set<String> =
        runCatching {
            client.from("user_roles").select(Columns.list("role")) {
                filter { eq("user_id", userId) }
            }.decodeList<UserRoleRow>().map { it.role }.toSet()
        }.getOrDefault(emptySet())

    fun isElevated(roles: Set<String>): Boolean =
        roles.any { it.equals("admin", true) || it.equals("m", true) }

    suspend fun fetchOpsOpenOrders(): List<OfferUi> {
        val orders = client.from("orders").select(Columns.ALL) {
            filter {
                isIn("status", listOf("placed", "accepted", "preparing", "ready"))
            }
            order("created_at", Order.ASCENDING)
            limit(60L)
        }.decodeList<OrderRow>()
        if (orders.isEmpty()) return emptyList()

        val storeIds = orders.map { it.store_id }.distinct()
        val stores = if (storeIds.isEmpty()) emptyMap()
        else client.from("stores")
            .select(Columns.list("id", "name", "address", "phone", "latitude", "longitude")) {
                filter { isIn("id", storeIds) }
            }.decodeList<StoreRow>().associateBy { it.id }

        val orderIds = orders.map { it.id }
        val items = runCatching {
            client.from("order_items").select(Columns.list("order_id", "name", "quantity")) {
                filter { isIn("order_id", orderIds) }
            }.decodeList<OrderItemRow>()
        }.getOrDefault(emptyList())
        val summaries = items.groupBy { it.order_id.orEmpty() }.mapValues { (_, rows) ->
            rows.joinToString(", ") { "${it.quantity ?: 1}× ${it.name ?: "?"}" }
        }

        return orders.map { order ->
            val store = stores[order.store_id]
            OfferUi(
                offerId = "",
                order = order,
                storeName = store?.name,
                storeAddress = store?.address,
                storePhone = store?.phone,
                storeLat = store?.latitude,
                storeLng = store?.longitude,
                expiresAt = null,
                itemsSummary = summaries[order.id],
            )
        }
    }
}
