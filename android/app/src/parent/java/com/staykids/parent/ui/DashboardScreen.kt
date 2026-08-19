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

import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker

@Composable
fun DashboardScreen(state: StayKidsState, onStartRemote: () -> Unit) {
    val context = LocalContext.current
    LaunchedEffect(Unit) {
        Configuration.getInstance().load(context, context.getSharedPreferences("osmdroid", android.content.Context.MODE_PRIVATE))
    }

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
                        .height(250.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(SurfaceHighlight),
                    contentAlignment = Alignment.Center
                ) {
                    val coords = state.child.coordinates
                    if (coords != null) {
                        AndroidView(
                            factory = { ctx ->
                                MapView(ctx).apply {
                                    setTileSource(TileSourceFactory.MAPNIK)
                                    setMultiTouchControls(true)
                                    controller.setZoom(15.0)
                                    val geoPoint = GeoPoint(coords.lat, coords.lng)
                                    controller.setCenter(geoPoint)
                                    
                                    val marker = Marker(this)
                                    marker.position = geoPoint
                                    marker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                                    marker.title = "Child Location"
                                    overlays.add(marker)
                                }
                            },
                            update = { mapView ->
                                val geoPoint = GeoPoint(coords.lat, coords.lng)
                                mapView.controller.animateTo(geoPoint)
                                mapView.overlays.filterIsInstance<Marker>().firstOrNull()?.position = geoPoint
                                mapView.invalidate()
                            },
                            modifier = Modifier.fillMaxSize()
                        )
                    } else {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("📍 Location not available", color = TextSecondary, fontSize = 14.sp)
                        }
                    }
                }
            }
        }
    }
}

