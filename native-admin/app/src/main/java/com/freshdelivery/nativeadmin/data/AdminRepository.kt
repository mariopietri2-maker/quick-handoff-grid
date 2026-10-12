package com.freshdelivery.nativeadmin.data

import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.rpc
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class AdminRepository {
    private val sb get() = SupabaseModule.client

    suspend fun signIn(email: String, password: String) {
        sb.auth.signInWith(Email) {
            this.email = email.trim()
            this.password = password
        }
    }

    suspend fun signOut() {
        runCatching { sb.auth.signOut() }
    }

    suspend fun currentUserId(): String? =
        sb.auth.currentSessionOrNull()?.user?.id

    @Serializable
    private data class RoleRow(
        val user_id: String? = null,
        val role: String? = null,
    )

    suspend fun isAdmin(userId: String): Boolean {
        return try {
            val rows = sb.from("user_roles").select {
                filter { eq("user_id", userId) }
            }.decodeList<RoleRow>()
            if (rows.any { it.role == "admin" }) return true
            val p = sb.from("profiles").select {
                filter { eq("user_id", userId) }
            }.decodeList<ProfileRow>()
            p.firstOrNull()?.role == "admin"
        } catch (_: Throwable) {
            false
        }
    }

    suspend fun loadDrivers(): List<DriverUi> {
        val states = runCatching {
            sb.from("driver_state").select().decodeList<DriverStateRow>()
        }.getOrDefault(emptyList())
        val profiles = runCatching {
            sb.from("driver_profiles").select().decodeList<DriverProfileRow>()
        }.getOrDefault(emptyList())
        val names = runCatching {
            sb.from("profiles").select().decodeList<ProfileRow>()
        }.getOrDefault(emptyList()).associateBy { it.user_id }

        val byId = profiles.associateBy { it.user_id }
        val stateBy = states.associateBy { it.driver_id }
        val ids = (byId.keys + stateBy.keys).distinct()
        return ids.map { id ->
            val st = stateBy[id]
            val dp = byId[id]
            val prof = names[id]
            DriverUi(
                id = id,
                name = prof?.full_name?.ifBlank { null } ?: id.take(8),
                phone = prof?.phone,
                online = st?.shift_started_at != null,
                onBreak = st?.on_break == true,
                active = dp?.is_active != false,
                callRole = dp?.call_role ?: "standard",
                vehicle = dp?.vehicle_type,
                lat = st?.last_lat,
                lng = st?.last_lng,
                updatedAt = st?.updated_at,
            )
        }.sortedWith(
            compareByDescending<DriverUi> { it.online }
                .thenByDescending { it.active }
                .thenBy { it.name },
        )
    }

    suspend fun loadOpenOrders(): List<OrderRow> {
        return runCatching {
            sb.from("orders").select().decodeList<OrderRow>()
                .filter {
                    it.status in setOf(
                        "placed", "accepted", "preparing", "ready",
                        "picked_up", "delivering",
                    )
                }
                .sortedByDescending { it.created_at }
                .take(100)
        }.getOrDefault(emptyList())
    }

    suspend fun loadStores(): List<StoreRow> {
        return runCatching {
            sb.from("stores").select().decodeList<StoreRow>()
                .sortedBy { it.name }
        }.getOrDefault(emptyList())
    }

    suspend fun loadStoreCalls(): List<StoreCallRow> {
        return runCatching {
            sb.from("store_driver_calls").select().decodeList<StoreCallRow>()
                .filter { it.status in setOf("open", "accepted") }
                .sortedByDescending { it.created_at }
                .take(50)
        }.getOrDefault(emptyList())
    }

    fun snapshot(
        drivers: List<DriverUi>,
        orders: List<OrderRow>,
        stores: List<StoreRow>,
        calls: List<StoreCallRow>,
    ): OpsSnapshot {
        return OpsSnapshot(
            openOrders = orders.count { it.status in setOf("placed", "accepted", "preparing", "ready") },
            onlineDrivers = drivers.count { it.online && !it.onBreak },
            onBreakDrivers = drivers.count { it.online && it.onBreak },
            activeStores = stores.count { it.is_active == true },
            onRoadOrders = orders.count { it.status in setOf("picked_up", "delivering") },
            openStoreCalls = calls.count { it.status == "open" },
            acceptedStoreCalls = calls.count { it.status == "accepted" },
        )
    }

    suspend fun forceEndShift(driverId: String) {
        sb.postgrest.rpc(
            "admin_force_end_driver_shift",
            buildJsonObject { put("p_driver_id", driverId) },
        )
    }

    suspend fun setDriverActive(driverId: String, active: Boolean) {
        sb.postgrest.rpc(
            "admin_set_driver_active",
            buildJsonObject {
                put("p_driver_id", driverId)
                put("p_active", active)
            },
        )
    }

    suspend fun forceOrderStatus(orderId: String, status: String) {
        sb.postgrest.rpc(
            "admin_force_order_status",
            buildJsonObject {
                put("p_order_id", orderId)
                put("p_status", status)
            },
        )
    }

    suspend fun assignOrderDriver(orderId: String, driverId: String) {
        sb.postgrest.rpc(
            "admin_assign_order_driver",
            buildJsonObject {
                put("p_order_id", orderId)
                put("p_driver_id", driverId)
            },
        )
    }

    suspend fun closeStoreCall(callId: String) {
        sb.postgrest.rpc(
            "close_store_driver_call",
            buildJsonObject { put("p_call_id", callId) },
        )
    }
}
