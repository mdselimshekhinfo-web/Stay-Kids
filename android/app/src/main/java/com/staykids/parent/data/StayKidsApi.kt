package com.staykids.parent.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable
data class Coordinates(
    val lat: Double,
    val lng: Double
)

@Serializable
data class InstalledApp(
    val name: String,
    val packageName: String,
    val isBlocked: Boolean
)

@Serializable
data class CallSmsLog(
    val id: String,
    val logType: String,
    val contact: String,
    val detail: String,
    val timestamp: Long
)

@Serializable
data class WebHistory(
    val id: String,
    val url: String,
    val timestamp: Long
)

@Serializable
data class ChildDeviceInfo(
    val id: String,
    val name: String,
    val device: String,
    val location: String,
    val school: String? = null,
    val coordinates: Coordinates? = null,
    val battery: Int,
    val online: Boolean,
    val protected: Boolean,
    val screenWidth: Int? = null,
    val screenHeight: Int? = null,
    val installedApps: List<InstalledApp>? = null,
    val callSmsLogs: List<CallSmsLog>? = null,
    val webHistory: List<WebHistory>? = null
)

@Serializable
data class Usage(
    val minutes: Int,
    val limit: Int,
    val topApps: List<String>,
    val history: List<JsonObject>? = null
)

@Serializable
data class Rewards(
    val earned: Int,
    val balance: Int
)

@Serializable
data class Alert(
    val id: String,
    val title: String,
    val detail: String,
    val time: String,
    val read: Boolean
)

@Serializable
data class Remote(
    val status: String,
    val tool: String,
    val consentRequired: Boolean,
    val audioActive: Boolean,
    val alarmActive: Boolean? = null,
    val lastSnapshotTime: String? = null,
    val mirrorStreamActive: Boolean? = null,
    val cameraStreamActive: Boolean? = null,
    val useFrontCamera: Boolean? = null,
    val lastSignal: JsonObject? = null,
    val lastTouchAction: String? = null,
    val liveFrame: String? = null,
    val connectionState: String? = null,
    val liveAudioChunk: String? = null,
    val webrtcOffer: String? = null,
    val webrtcAnswer: String? = null,
    val webrtcCandidates: List<JsonObject>? = null
)

@Serializable
data class StayKidsState(
    val isPremium: Boolean? = null,
    val activeChildId: String? = null,
    val children: List<ChildDeviceInfo>? = null,
    val child: ChildDeviceInfo,
    val usage: Usage,
    val controls: JsonObject,
    val blockedApps: Map<String, Boolean>? = null,
    val rewards: Rewards,
    val alerts: List<Alert>,
    val remote: Remote
)
