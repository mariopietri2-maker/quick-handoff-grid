package com.freshdelivery.nativedriver.data

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.flow.StateFlow

/**
 * Wraps Supabase Auth for the driver app. Role/eligibility checks against the
 * drivers table land once the offers/dispatch screen is wired, so today this
 * only proves identity and restores sessions across app restarts.
 */
class AuthRepository(private val supabase: SupabaseClient = SupabaseModule.client) {

    val sessionStatus: StateFlow<SessionStatus> = supabase.auth.sessionStatus

    suspend fun signIn(email: String, password: String) {
        supabase.auth.signInWith(Email) {
            this.email = email
            this.password = password
        }
    }

    suspend fun signOut() {
        supabase.auth.signOut()
    }
}
