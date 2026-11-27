#!/usr/bin/env python3
from pathlib import Path

def fix_supabase():
    p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/data/SupabaseModule.kt")
    p.write_text("""package com.freshdelivery.nativecustomer.data

import com.freshdelivery.nativecustomer.BuildConfig
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.functions.Functions
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.realtime.Realtime

object SupabaseModule {
    val client by lazy {
        createSupabaseClient(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseKey = BuildConfig.SUPABASE_ANON_KEY,
        ) {
            install(Auth) {
                // Keep JWT refreshed in background so the user is not kicked to login.
                alwaysAutoRefresh = true
            }
            install(Postgrest)
            install(Realtime)
            install(Functions)
        }
    }
}
""")
    print("supabase ok")

def fix_gradle():
    p = Path("native-customer/app/build.gradle.kts")
    t = p.read_text()
    if "multiplatform-settings" not in t:
        t = t.replace(
            'implementation("io.github.jan-tennert.supabase:functions-kt")',
            'implementation("io.github.jan-tennert.supabase:functions-kt")\n'
            '    implementation("com.russhwolf:multiplatform-settings-no-arg:1.2.0")',
        )
        p.write_text(t)
        print("gradle ok")
    else:
        print("gradle exists")

def fix_vm():
    p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
    t = p.read_text()
    if "ONLY explicit sign-out may clear" in t:
        print("vm already")
        return
    old = """                    is SessionStatus.NotAuthenticated -> {
                        // Only a real sign-out logs the user out. Transient NotAuthenticated
                        // (refresh, background, storage reload) must not kick them to login.
                        if (!status.isSignOut && _state.value.signedIn) {
                            _state.value = _state.value.copy(bootstrapping = false)
                            viewModelScope.launch {
                                kotlinx.coroutines.delay(1500)
                                runCatching { SupabaseModule.client.auth.refreshCurrentSession() }
                            }
                        } else {
                            pollJob?.cancel()
                            ordersRealtimeJob?.cancel()
                            driverRealtimeJob?.cancel()
                            driverChannelFor = null
                            liveChatJob?.cancel()
                            liveChatJob = null
                            liveChatSessionJob?.cancel()
                            liveChatSessionJob = null
                            ticketJob?.cancel()
                            ticketJob = null
                            repo.unsubscribeAll()
                            val gameActive = _state.value.gameActive
                            val cards = _state.value.cards
                            _state.value = CustomerUiState(bootstrapping = false, signedIn = false).copy(
                                gameActive = gameActive,
                                cards = cards,
                                gameShow = rollDailyGameShow(),
                            )
                        }
                    }"""
    new = """                    is SessionStatus.NotAuthenticated -> {
                        // ONLY explicit sign-out may clear the session UI.
                        // Startup, refresh, airplane mode, and storage reload all emit
                        // NotAuthenticated briefly — never treat those as logout.
                        val explicitSignOut = runCatching { status.isSignOut }.getOrDefault(false)
                        if (!explicitSignOut) {
                            if (_state.value.bootstrapping) {
                                viewModelScope.launch {
                                    kotlinx.coroutines.delay(800)
                                    runCatching { SupabaseModule.client.auth.refreshCurrentSession() }
                                    kotlinx.coroutines.delay(2000)
                                    val still = SupabaseModule.client.auth.currentSessionOrNull()
                                    if (still == null && _state.value.bootstrapping) {
                                        _state.value = _state.value.copy(bootstrapping = false, signedIn = false)
                                    }
                                }
                            } else if (_state.value.signedIn) {
                                viewModelScope.launch {
                                    kotlinx.coroutines.delay(1200)
                                    runCatching { SupabaseModule.client.auth.refreshCurrentSession() }
                                }
                            } else {
                                _state.value = _state.value.copy(bootstrapping = false, signedIn = false)
                            }
                        } else {
                            pollJob?.cancel()
                            ordersRealtimeJob?.cancel()
                            driverRealtimeJob?.cancel()
                            driverChannelFor = null
                            liveChatJob?.cancel()
                            liveChatJob = null
                            liveChatSessionJob?.cancel()
                            liveChatSessionJob = null
                            ticketJob?.cancel()
                            ticketJob = null
                            repo.unsubscribeAll()
                            val gameActive = _state.value.gameActive
                            val cards = _state.value.cards
                            _state.value = CustomerUiState(bootstrapping = false, signedIn = false).copy(
                                gameActive = gameActive,
                                cards = cards,
                                gameShow = rollDailyGameShow(),
                            )
                        }
                    }"""
    if old in t:
        p.write_text(t.replace(old, new))
        print("vm fixed")
    else:
        print("vm miss")

def fix_login():
    p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/LoginScreen.kt")
    t = p.read_text()
    t2 = t.replace(
        "var rememberMe by remember { mutableStateOf(false) }",
        "var rememberMe by remember { mutableStateOf(true) }",
    )
    if t2 != t:
        p.write_text(t2)
        print("login ok")
    else:
        print("login skip")

if __name__ == "__main__":
    fix_supabase()
    fix_gradle()
    fix_vm()
    fix_login()
    print("SESSION_PERSIST_1_0_62_OK")
