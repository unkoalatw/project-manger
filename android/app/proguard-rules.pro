-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class io.github.unkoalatw.flatspec.AndroidBridge { *; }
