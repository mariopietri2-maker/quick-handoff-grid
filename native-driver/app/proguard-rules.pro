# Fresh2GO driver — Play release (R8 optimize + obfuscate)
-keepattributes *Annotation*, InnerClasses, Signature, Exception
-keepattributes RuntimeVisibleAnnotations, AnnotationDefault
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

-repackageclasses 'f2g'
-allowaccessmodification
-optimizationpasses 5

-dontwarn kotlinx.coroutines.**
-dontwarn kotlinx.serialization.**
-keep,includedescriptorclasses class kotlinx.serialization.json.** { *; }
-keepclassmembers class **$$serializer { *** INSTANCE; }

-dontwarn io.github.jan.supabase.**
-keep class io.github.jan.supabase.** { *; }
-dontwarn io.ktor.**
-keep class io.ktor.** { *; }

-dontwarn com.mapbox.**
-keep class com.mapbox.** { *; }

-dontwarn com.google.firebase.**
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

-keep class com.freshdelivery.nativedriver.BuildConfig { *; }
-keep class com.freshdelivery.nativedriver.update.** { *; }
-keep class com.freshdelivery.nativedriver.data.** { *; }

-keepclasseswithmembernames class * {
    native <methods>;
}

-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}
