package com.staykids.parent

import android.app.AppOpsManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Bundle
import android.os.Process
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.staykids.parent.ui.theme.StayKidsTheme
import com.staykids.parent.ui.ChildDeviceScreen
import com.staykids.parent.ui.ChildOnboardingScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            StayKidsTheme {
                val context = LocalContext.current
                var hasPermissions by remember { mutableStateOf(checkAllPermissions(context)) }
                
                // Re-check permissions when activity resumes from Settings
                val lifecycleOwner = LocalLifecycleOwner.current
                DisposableEffect(lifecycleOwner) {
                    val observer = LifecycleEventObserver { _, event ->
                        if (event == Lifecycle.Event.ON_RESUME) {
                            hasPermissions = checkAllPermissions(context)
                        }
                    }
                    lifecycleOwner.lifecycle.addObserver(observer)
                    onDispose {
                        lifecycleOwner.lifecycle.removeObserver(observer)
                    }
                }

                if (hasPermissions) {
                    ChildDeviceScreen()
                } else {
                    ChildOnboardingScreen(onPermissionsGranted = { hasPermissions = checkAllPermissions(context) })
                }
            }
        }
    }

    private fun checkAllPermissions(context: Context): Boolean {
        return isUsageAccessGranted(context) && 
               isAccessibilityGranted(context) && 
               isDeviceAdminGranted(context)
    }

    private fun isUsageAccessGranted(context: Context): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            context.packageName
        )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun isAccessibilityGranted(context: Context): Boolean {
        var enabled = false
        try {
            val accessibilityEnabled = Settings.Secure.getInt(
                context.contentResolver,
                Settings.Secure.ACCESSIBILITY_ENABLED
            )
            if (accessibilityEnabled == 1) {
                val service = "${context.packageName}/${StayKidsAccessibilityService::class.java.name}"
                val settingValue = Settings.Secure.getString(
                    context.contentResolver,
                    Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
                )
                if (settingValue != null) {
                    enabled = settingValue.contains(service, ignoreCase = true)
                }
            }
        } catch (e: Exception) {
            enabled = StayKidsAccessibilityService.getInstance() != null
        }
        return enabled
    }

    private fun isDeviceAdminGranted(context: Context): Boolean {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val componentName = ComponentName(context, StayKidsDeviceAdminReceiver::class.java)
        return dpm.isAdminActive(componentName)
    }
}

