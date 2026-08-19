package com.staykids.parent.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

@Composable
fun ControlsScreen(
    state: StayKidsState,
    onAction: (JsonObject) -> Unit
) {
    val child = state.child
    val usageLimit = state.usage.limit
    var localLimit by remember(usageLimit) { mutableStateOf(usageLimit.toFloat()) }
    val controlsObj = state.controls
    
    val getControlValue: (String) -> Boolean = { key ->
        controlsObj[key]?.jsonPrimitive?.booleanOrNull ?: false
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Column {
                Text(
                    text = "${child.name}'s ${child.device}",
                    color = TextSecondary,
                    fontSize = 14.sp
                )
                Text(
                    text = "Controls & Rules",
                    color = TextPrimary,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        // Screen Time Limit
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(DarkSurface)
                    .padding(20.dp)
            ) {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Daily Screen Time", color = TextPrimary, fontWeight = FontWeight.Bold)
                        Box(
                            modifier = Modifier
                                .background(SurfaceHighlight, RoundedCornerShape(12.dp))
                                .padding(horizontal = 12.dp, vertical = 4.dp)
                        ) {
                            val h = localLimit.toInt() / 60
                            val m = localLimit.toInt() % 60
                            Text("${h}h ${m}m", color = PrimaryGreen, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    Slider(
                        value = localLimit,
                        onValueChange = { localLimit = it },
                        onValueChangeFinished = {
                            onAction(buildJsonObject {
                                put("type", "set-limit")
                                put("value", localLimit.toInt())
                            })
                        },
                        valueRange = 15f..480f,
                        colors = SliderDefaults.colors(
                            thumbColor = PrimaryGreen,
                            activeTrackColor = PrimaryGreen,
                            inactiveTrackColor = DarkBackground
                        )
                    )
                }
            }
        }

        // Anti-Theft Alarm
        item {
            val alarmActive = state.remote.alarmActive ?: false
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .border(1.dp, if (alarmActive) DangerRed else DarkSurface, RoundedCornerShape(24.dp))
                    .background(if (alarmActive) DangerRed.copy(alpha = 0.1f) else DarkSurface)
                    .padding(20.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("🚨", fontSize = 24.sp)
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text("Anti-Theft Siren", color = TextPrimary, fontWeight = FontWeight.Bold)
                        Text(
                            if (alarmActive) "Ringing!" else "Ring alarm if lost",
                            color = TextSecondary,
                            fontSize = 12.sp
                        )
                    }
                }
                Button(
                    onClick = { onAction(buildJsonObject { put("type", "trigger-alarm") }) },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (alarmActive) DangerRed else SurfaceHighlight,
                        contentColor = TextPrimary
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(if (alarmActive) "Stop ⏹" else "Ring 🚨")
                }
            }
        }

        // Feature Toggles
        val featureItems = listOf(
            Triple("App limits", "limits", "◫"),
            Triple("Bedtime", "bedtime", "◐"),
            Triple("Web filter", "filter", "◉"),
            Triple("Stealth mode", "stealth", "👻")
        )

        items(featureItems) { (title, key, icon) ->
            val isEnabled = getControlValue(key)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(DarkSurface)
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(DarkBackground),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(icon, fontSize = 20.sp)
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(title, color = TextPrimary, fontWeight = FontWeight.Bold)
                }
                Switch(
                    checked = isEnabled,
                    onCheckedChange = {
                        onAction(buildJsonObject {
                            put("type", "toggle-control")
                            put("key", key)
                        })
                    },
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = TextPrimary,
                        checkedTrackColor = PrimaryGreen,
                        uncheckedThumbColor = TextSecondary,
                        uncheckedTrackColor = DarkBackground
                    )
                )
            }
        }

        // App Locker
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(DarkSurface)
                    .padding(20.dp)
            ) {
                Text("App Locker", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text("Block or limit apps", color = TextSecondary, fontSize = 12.sp)
                Spacer(modifier = Modifier.height(16.dp))
                
                val apps = child.installedApps ?: emptyList()
                if (apps.isEmpty()) {
                    Text("No apps installed.", color = TextSecondary, fontSize = 14.sp)
                } else {
                    apps.forEach { app ->
                        val isBlocked = state.blockedApps?.get(app.packageName) ?: false
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text(app.name, color = TextPrimary, fontWeight = FontWeight.Bold)
                                Text(if (isBlocked) "Blocked" else "Allowed", color = TextSecondary, fontSize = 12.sp)
                            }
                            Button(
                                onClick = {
                                    onAction(buildJsonObject {
                                        put("type", "toggle-app-lock")
                                        put("appName", app.packageName)
                                    })
                                },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (isBlocked) DangerRed.copy(alpha = 0.2f) else PrimaryGreen.copy(alpha = 0.2f),
                                    contentColor = if (isBlocked) DangerRed else PrimaryGreen
                                ),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text(if (isBlocked) "Blocked 🚫" else "Allowed ✓")
                            }
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}
