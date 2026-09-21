# Fresh2GO customer — Play release
-keepattributes *Annotation*, InnerClasses, Signature, Exception
-keepattributes RuntimeVisibleAnnotations, AnnotationDefault
-keepattributes SourceFile,LineNumberTable

-keep class kotlinx.serialization.** { *; }
-keepclassmembers class kotlinx.serialization.json.** { *; }
-dontwarn kotlinx.serialization.**

-keep class io.github.jan.supabase.** { *; }
-dontwarn io.github.jan.supabase.**

-keep class io.ktor.** { *; }
-dontwarn io.ktor.**

-keep class com.freshdelivery.nativecustomer.data.** { *; }
-keep class com.freshdelivery.nativecustomer.update.** { *; }
-keep class com.stripe.android.** { *; }
-dontwarn com.stripe.android.**

-dontwarn com.mapbox.**
-keep class com.mapbox.** { *; }

-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
