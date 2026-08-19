package com.staykids.parent

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import com.staykids.parent.ui.theme.StayKidsTheme
import com.staykids.parent.ui.ChildDeviceScreen
import com.staykids.parent.ui.ChildOnboardingScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            StayKidsTheme {
                var hasPermissions by remember { mutableStateOf(false) }
                if (hasPermissions) {
                    ChildDeviceScreen()
                } else {
                    ChildOnboardingScreen(onPermissionsGranted = { hasPermissions = true })
                }
            }
        }
    }
}