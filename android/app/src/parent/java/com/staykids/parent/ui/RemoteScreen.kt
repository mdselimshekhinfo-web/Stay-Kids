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

@Composable
fun RemoteScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("Connecting to Child Device...", color = PrimaryGreen)
        Spacer(modifier = Modifier.height(16.dp))
        CircularProgressIndicator(color = PrimaryGreen)
        
        AndroidView(factory = { ctx -> org.webrtc.SurfaceViewRenderer(ctx).apply { init(org.webrtc.EglBase.create().eglBaseContext, null); setEnableHardwareScaler(true); setScalingType(org.webrtc.RendererCommon.ScalingType.SCALE_ASPECT_FIT) } }, modifier = Modifier.fillMaxWidth().aspectRatio(9f/16f).padding(16.dp))
    }
}
