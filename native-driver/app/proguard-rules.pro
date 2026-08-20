-keepattributes *Annotation*, InnerClasses, Signature, EnclosingMethod
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclassmembers @kotlinx.serialization.Serializable class ** {
    *** Companion; *** INSTANCE;
    kotlinx.serialization.KSerializer serializer(...);
}
-dontwarn io.ktor.**
-dontwarn io.github.jan.supabase.**
-keep class io.github.jan.supabase.** { *; }
-keep class io.ktor.** { *; }
-keep class com.mapbox.** { *; }
-dontwarn com.mapbox.**
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-keep class com.freshdelivery.nativedriver.data.** { *; }
