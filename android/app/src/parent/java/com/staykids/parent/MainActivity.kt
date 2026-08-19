package com.staykids.parent

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.*
import com.staykids.parent.ui.AuthScreen
import com.staykids.parent.ui.MainParentScreen
import com.staykids.parent.ui.RemoteScreen
import com.staykids.parent.ui.theme.StayKidsTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            StayKidsTheme {
                var isLoggedIn by remember { mutableStateOf(false) }
                var isRemote by remember { mutableStateOf(false) }
                if (!isLoggedIn) { 
                    AuthScreen { isLoggedIn = true } 
                } else if (isRemote) { 
                    RemoteScreen(onClose = { isRemote = false }) 
                } else { 
                    MainParentScreen(onStartRemote = { isRemote = true }) 
                }
            }
        }
    }
}
