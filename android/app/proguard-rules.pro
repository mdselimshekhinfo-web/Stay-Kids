# StayKids ProGuard Obfuscation & Shrinking Rules

# Preserve line numbers and source attributes for crash stack traces
-keepattributes SourceFile,LineNumberTable,Signature,*Annotation*

# Preserve Capacitor core bridges and javascript interfaces
-keep class com.getcapacitor.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod public *;
}

# Preserve StayKids Native Plugin & Android Services
-keep class com.staykids.parent.** { *; }
-keepclassmembers class com.staykids.parent.** { *; }

# Preserve Web View JS Interfaces
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Ignore warnings for third-party libraries if any
-dontwarn okhttp3.**
-dontwarn okio.**
