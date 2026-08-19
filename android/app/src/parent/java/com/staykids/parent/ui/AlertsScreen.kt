package com.staykids.parent.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import kotlinx.serialization.json.put

data class FilterTab(val key: String, val label: String, val icon: String)

@Composable
fun AlertsScreen(
    state: StayKidsState,
    onAction: (JsonObject) -> Unit
) {
    var selectedFilter by remember { mutableStateOf("all") }

    val tabs = listOf(
        FilterTab("all", "All", "📋"),
        FilterTab("sos", "SOS", "🆘"),
        FilterTab("location", "Location", "📍"),
        FilterTab("activity", "Activity", "📱"),
        FilterTab("block", "System", "⚠️"),
        FilterTab("call", "Calls", "📞")
    )

    val alerts = state.alerts
    val filteredAlerts = if (selectedFilter == "all") {
        alerts
    } else {
        alerts.filter { alert ->
            val titleLower = alert.title.lowercase()
            val detailLower = alert.detail.lowercase()
            when (selectedFilter) {
                "sos" -> titleLower.contains("sos") || titleLower.contains("emergency") || titleLower.contains("alarm")
                "location" -> titleLower.contains("location") || titleLower.contains("place") || titleLower.contains("school") || titleLower.contains("geofence")
                "block" -> titleLower.contains("block") || titleLower.contains("app") || titleLower.contains("protection")
                "call" -> titleLower.contains("call") || titleLower.contains("sms")
                else -> titleLower.contains(selectedFilter) || detailLower.contains(selectedFilter)
            }
        }
    }
    val unreadCount = alerts.count { !it.read }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(16.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Bottom
        ) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Real-time Event Feed",
                        color = TextSecondary,
                        fontSize = 14.sp
                    )
                    if (unreadCount > 0) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Box(
                            modifier = Modifier
                                .background(DangerRed, CircleShape)
                                .padding(horizontal = 8.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = "$unreadCount new",
                                color = TextPrimary,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
                Text(
                    text = "Notification Logs",
                    color = TextPrimary,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold
                )
            }
            Text(
                text = "Mark all read",
                color = PrimaryGreen,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.clickable {
                    onAction(buildJsonObject { put("type", "mark-all-read") })
                }
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Tabs
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            items(tabs) { tab ->
                val isSelected = selectedFilter == tab.key
                Box(
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(if (isSelected) PrimaryGreen else DarkSurface)
                        .clickable { selectedFilter = tab.key }
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                ) {
                    Text(
                        text = "${tab.icon} ${tab.label}",
                        color = if (isSelected) TextPrimary else TextSecondary,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // List
        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.weight(1f)
        ) {
            if (filteredAlerts.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(22.dp))
                            .background(DarkSurface)
                            .padding(32.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("🔔", fontSize = 24.sp)
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("No notifications", color = TextPrimary, fontWeight = FontWeight.Bold)
                            Text("New alerts will appear here.", color = TextSecondary, fontSize = 12.sp)
                        }
                    }
                }
            } else {
                items(filteredAlerts) { alert ->
                    val icon = when {
                        alert.title.contains("SOS", ignoreCase = true) || alert.title.contains("Alarm", ignoreCase = true) -> "🚨"
                        alert.title.contains("Location", ignoreCase = true) || alert.title.contains("Geofence", ignoreCase = true) -> "⌖"
                        alert.title.contains("Blocked", ignoreCase = true) -> "🚫"
                        alert.title.contains("Call", ignoreCase = true) || alert.title.contains("SMS", ignoreCase = true) -> "📞"
                        else -> "🔔"
                    }

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(22.dp))
                            .background(DarkSurface)
                            .border(
                                1.dp,
                                if (alert.read) DarkSurface else PrimaryGreen.copy(alpha = 0.5f),
                                RoundedCornerShape(22.dp)
                            )
                            .clickable {
                                onAction(buildJsonObject { 
                                    put("type", "mark-read")
                                    put("id", alert.id) 
                                })
                            }
                            .padding(16.dp),
                        verticalAlignment = Alignment.Top
                    ) {
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
                        Column(modifier = Modifier.weight(1f)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = alert.title,
                                    color = TextPrimary,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp
                                )
                                Text(
                                    text = alert.time,
                                    color = TextSecondary,
                                    fontSize = 12.sp
                                )
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = alert.detail,
                                color = TextSecondary,
                                fontSize = 14.sp,
                                lineHeight = 20.sp
                            )
                        }
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(8.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(22.dp))
                        .background(PrimaryGreen)
                        .padding(20.dp)
                ) {
                    Column {
                        Text("Alert Preferences", color = TextPrimary, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            "All security alerts are live synced with parents.",
                            color = TextPrimary.copy(alpha = 0.8f),
                            fontSize = 14.sp
                        )
                    }
                }
                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }
}
