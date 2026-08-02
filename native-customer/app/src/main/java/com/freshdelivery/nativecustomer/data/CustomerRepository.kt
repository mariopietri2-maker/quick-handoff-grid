package com.freshdelivery.nativecustomer.data

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.rpc
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class CustomerRepository(
    private val client: SupabaseClient = SupabaseModule.client,
) {
    suspend fun signIn(email: String, password: String) {
        client.auth.signInWith(Email) {
            this.email = email.trim()
            this.password = password
        }
        runCatching {
            client.postgrest.rpc(
                "sync_app_role",
                buildJsonObject { put("p_app", "customer") },
            )
        }
    }

    suspend fun signOut() = client.auth.signOut()

    suspend fun loadProfile(userId: String): ProfileRow? =
        client.from("profiles").select(Columns.ALL) {
            filter { eq("id", userId) }
            limit(1L)
        }.decodeList<ProfileRow>().firstOrNull()

    suspend fun fetchStores(): List<StoreRow> =
        client.from("stores").select(
            Columns.list("id", "name", "address", "latitude", "longitude", "is_active", "image_url"),
        ) {
            filter { eq("is_active", true) }
            order("name", Order.ASCENDING)
            limit(80L)
        }.decodeList<StoreRow>()

    suspend fun fetchOrders(userId: String): List<OrderUi> {
        val orders = client.from("orders").select(Columns.ALL) {
            filter { eq("customer_id", userId) }
            order("created_at", Order.DESCENDING)
            limit(40L)
        }.decodeList<OrderRow>()
        if (orders.isEmpty()) return emptyList()
        val storeIds = orders.map { it.store_id }.distinct()
        val stores = client.from("stores").select(Columns.list("id", "name")) {
            filter { isIn("id", storeIds) }
        }.decodeList<StoreRow>().associateBy { it.id }
        return orders.map { o ->
            OrderUi(order = o, storeName = stores[o.store_id]?.name)
        }
    }

    suspend fun fetchDriverLocation(driverId: String): DriverLocationRow? =
        client.from("driver_locations").select(Columns.ALL) {
            filter { eq("driver_id", driverId) }
            limit(1L)
        }.decodeList<DriverLocationRow>().firstOrNull()
}
