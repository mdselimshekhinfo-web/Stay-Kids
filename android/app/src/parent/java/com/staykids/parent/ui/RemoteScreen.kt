package com.staykids.parent.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.foundation.layout.aspectRatio
import com.staykids.parent.ui.theme.*
import org.webrtc.EglBase
import org.webrtc.RendererCommon
import org.webrtc.SurfaceViewRenderer

@Composable
fun RemoteScreen(onClose: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Connecting to Child Device...", color = PrimaryGreen)
            Button(onClick = onClose, colors = ButtonDefaults.buttonColors(containerColor = DangerRed)) {
                Text("Close")
            }
        }
        Spacer(modifier = Modifier.height(16.dp))
        CircularProgressIndicator(color = PrimaryGreen)
        
        AndroidView(
            factory = { ctx -> 
                SurfaceViewRenderer(ctx).apply { 
                    try {
                        init(EglBase.create().eglBaseContext, null)
                        setEnableHardwareScaler(true)
                        setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FIT)
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                } 
            }, 
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(9f/16f)
                .padding(16.dp)
        )
    }
}

