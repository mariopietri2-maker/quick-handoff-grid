package com.freshdelivery.nativecustomer

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import coil.request.CachePolicy
import com.freshdelivery.nativecustomer.data.SupabaseModule

/**
 * App-wide Coil tuning: bounded memory/disk cache so store list scroll
 * stays close to efood-level snappiness on mid-range phones.
 */
class FreshCustomerApp : Application(), ImageLoaderFactory {
    override fun onCreate() {
        super.onCreate()
        SupabaseModule.client
    }

    override fun newImageLoader(): ImageLoader {
        return ImageLoader.Builder(this)
            .crossfade(120)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.22)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("coil_image_cache"))
                    .maxSizeBytes(48L * 1024 * 1024)
                    .build()
            }
            .memoryCachePolicy(CachePolicy.ENABLED)
            .diskCachePolicy(CachePolicy.ENABLED)
            .respectCacheHeaders(false)
            .build()
    }
}
