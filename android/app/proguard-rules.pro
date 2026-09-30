# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# Play Billing references Google's datatransport/Firebase telemetry uploader,
# which app/build.gradle excludes. Billing's logger constructs it inside a
# catch-all (billing 9.1.0, class zzdt) and switches logging off when it is
# missing, so the absence is handled at runtime; R8 only needs to not fail.
-dontwarn com.google.android.datatransport.**
-dontwarn com.google.firebase.**
