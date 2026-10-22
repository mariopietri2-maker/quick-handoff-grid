# Fresh2GO customer — Play release (R8 optimize + obfuscate)
-keepattributes *Annotation*, InnerClasses, Signature, Exception
-keepattributes RuntimeVisibleAnnotations, AnnotationDefault
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Aggressive repackaging improves Play "obfuscation" score
-repackageclasses 'f2g'
-allowaccessmodification
-optimizationpasses 5

# Kotlin / Coroutines
-dontwarn kotlinx.coroutines.**
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}

# Kotlinx Serialization — keep serializers, allow obfuscating models otherwise
-keepattributes *Annotation*, InnerClasses
-dontwarn kotlinx.serialization.**
-keep,includedescriptorclasses class kotlinx.serialization.json.** { *; }
-keepclassmembers class **$$serializer { *** INSTANCE; }
-keepclassmembers class * {
    @kotlinx.serialization.SerialName <fields>;
}

# Supabase / Ktor — keep public API surfaces used by reflection
-dontwarn io.github.jan.supabase.**
-keep class io.github.jan.supabase.** { *; }
-dontwarn io.ktor.**
-keep class io.ktor.** { *; }

# Stripe
-dontwarn com.stripe.android.**
-keep class com.stripe.android.** { *; }

# Mapbox
-dontwarn com.mapbox.**
-keep class com.mapbox.** { *; }

# Firebase / FCM
-dontwarn com.google.firebase.**
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# App update checker + BuildConfig
-keep class com.freshdelivery.nativecustomer.BuildConfig { *; }
-keep class com.freshdelivery.nativecustomer.update.** { *; }

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Enums used in JSON
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}
