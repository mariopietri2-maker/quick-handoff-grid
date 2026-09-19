# Fresh2GO driver — keep network + serialization
-keepattributes *Annotation*, InnerClasses, Signature, Exception
-keepattributes RuntimeVisibleAnnotations, AnnotationDefault

-keep class kotlinx.serialization.** { *; }
-keepclassmembers class kotlinx.serialization.json.** { *; }
-dontwarn kotlinx.serialization.**

-keep class io.github.jan.supabase.** { *; }
-dontwarn io.github.jan.supabase.**

-keep class io.ktor.** { *; }
-dontwarn io.ktor.**

-keep class com.freshdelivery.nativedriver.data.** { *; }
-keep class com.freshdelivery.nativedriver.update.** { *; }
-keep class com.freshdelivery.nativedriver.ui.** { *; }

-dontwarn com.mapbox.**
-keep class com.mapbox.** { *; }
