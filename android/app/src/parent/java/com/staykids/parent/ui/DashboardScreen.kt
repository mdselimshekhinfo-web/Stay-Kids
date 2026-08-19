package com.staykids.parent.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.staykids.parent.data.StayKidsState
import com.staykids.parent.ui.theme.*

@Composable
fun DashboardScreen(state: StayKidsState, onStartRemote: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(16.dp)
    ) {
        Text("Child Dashboard", color = PrimaryGreen, style = MaterialTheme.typography.headlineMedium)
        Text(text = "Device: ${state.child.device} | Battery: ${state.child.battery ?: 100}%", color = TextSecondary)
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Card(colors = CardDefaults.cardColors(containerColor = DarkSurface), modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Remote Control Features", color = TextPrimary, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = onStartRemote, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = PrimaryGreen)) {
                        Text("Screen Mirroring", fontSize = 12.sp)
                    }
                    Button(onClick = { /* TODO: Remote Camera */ }, modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = PrimaryGreen)) {
                        Text("Remote Camera", fontSize = 12.sp)
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                Button(onClick = { /* TODO: One-Way Audio */ }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = PrimaryGreen)) {
                    Text("One-Way Audio (Listen In)")
                }
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Card(colors = CardDefaults.cardColors(containerColor = DarkSurface), modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Geofencing & Location", color = TextPrimary, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(8.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(150.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(SurfaceHighlight),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("🗺️ Map View Placeholder", color = TextPrimary, fontWeight = FontWeight.Bold)
                        Text("Live Tracking & Geofence Setup", color = TextSecondary, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

