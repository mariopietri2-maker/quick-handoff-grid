package com.freshdelivery.nativedriver.push

/**
 * Fired when an FCM data message of type "store_call" arrives, so the
 * DriverViewModel can refresh store-call state immediately instead of
 * waiting for the next polling tick.
 */
object StoreCallSignal {
    @Volatile var listener: (() -> Unit)? = null

    fun fire() {
        listener?.invoke()
    }
}
