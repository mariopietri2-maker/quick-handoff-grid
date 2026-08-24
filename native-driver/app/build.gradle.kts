plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.gms.google-services")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.freshdelivery.nativedriver"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.freshdelivery.driver"
        minSdk = 26
        targetSdk = 35
        versionCode = 261
        versionName = "2.6.10-native"

        // Mapbox public access token (pk.*) — injected from CI secrets or local gradle.properties.
        // Never commit a secret token; sk.* tokens must not ship in the APK.
        val mapboxToken =
            (project.findProperty("MAPBOX_ACCESS_TOKEN") as String?)
                ?: System.getenv("MAPBOX_ACCESS_TOKEN")
                ?: ""
        buildConfigField("String", "MAPBOX_TOKEN", "\"$mapboxToken\"")
        buildConfigField(
            "String",
            "SUPABASE_URL",
            "\"https://ojkesspghyqmjmupybva.supabase.co\"",
        )
        // Public anon key (safe to ship; RLS protects data).
        buildConfigField(
            "String",
            "SUPABASE_ANON_KEY",
            "\"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qa2Vzc3BnaHlxbWptdXB5YnZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MjU5MzMsImV4cCI6MjA3MzEwMTkzM30.3VQXqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJqJ\"",
        )
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    // Supabase Kotlin
    implementation(platform("io.github.jan-tennert.supabase:bom:3.0.3"))
    implementation("io.github.jan-tennert.supabase:postgrest-kt")
    implementation("io.github.jan-tennert.supabase:auth-kt")
    implementation("io.github.jan-tennert.supabase:realtime-kt")
    implementation("io.github.jan-tennert.supabase:storage-kt")
    implementation("io.ktor:ktor-client-android:3.0.3")

    // Mapbox
    implementation("com.mapbox.maps:android:11.9.0")

    // Firebase / FCM
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging-ktx")

    // Location
    implementation("com.google.android.gms:play-services-location:21.3.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
