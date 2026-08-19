package com.staykids.parent.data

import io.ktor.client.*
import io.ktor.client.engine.android.*
import io.ktor.client.plugins.websocket.*
import io.ktor.websocket.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*

@Serializable
data class PhoenixMessage(
    val joinRef: String?,
    val ref: String?,
    val topic: String,
    val event: String,
    val payload: JsonObject
)

object RealtimeManager {
    // You can inject these from BuildConfig later.
    var PROJECT_ID = "ewsehvgwzczlshyoyhqf"
    var ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3c2Vodmd3emN6bHNoeW95aHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMTA2MjIsImV4cCI6MjA5OTY4NjYyMn0.kWqk1d-8mNt3mG5zwfaRC9RUgZt7WgEyRNrqn7frn-s"
    
    private val wsUrl: String
        get() = "wss://$PROJECT_ID.supabase.co/realtime/v1/websocket?apikey=$ANON_KEY&vsn=1.0.0"

    private val client = HttpClient(Android) {
        install(WebSockets) {
            pingInterval = 20_000
        }
    }

    private var session: DefaultClientWebSocketSession? = null
    private val jsonConfig = Json { ignoreUnknownKeys = true }
    private var refCount = 0

    private val _incomingMessages = MutableSharedFlow<PhoenixMessage>()
    val incomingMessages = _incomingMessages.asSharedFlow()

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var heartbeatJob: Job? = null

    suspend fun connect() {
        if (session != null) return
        try {
            session = client.webSocketSession(wsUrl)
            startHeartbeat()
            scope.launch {
                session?.incoming?.consumeAsFlow()?.collect { frame ->
                    if (frame is Frame.Text) {
                        val text = frame.readText()
                        try {
                            val array = jsonConfig.decodeFromString<JsonArray>(text)
                            if (array.size >= 5) {
                                val msg = PhoenixMessage(
                                    joinRef = if (array[0] is JsonNull) null else array[0].jsonPrimitive.contentOrNull,
                                    ref = if (array[1] is JsonNull) null else array[1].jsonPrimitive.contentOrNull,
                                    topic = array[2].jsonPrimitive.content,
                                    event = array[3].jsonPrimitive.content,
                                    payload = array[4].jsonObject
                                )
                                _incomingMessages.emit(msg)
                            }
                        } catch (e: Exception) {
                            // Ignored or log
                        }
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = scope.launch {
            while (isActive && session != null) {
                delay(30_000)
                sendRaw("phoenix", "heartbeat", JsonObject(emptyMap()))
            }
        }
    }

    suspend fun joinChannel(topic: String, joinRef: String = "1") {
        sendRaw(topic, "phx_join", JsonObject(emptyMap()), joinRef)
    }

    suspend fun leaveChannel(topic: String) {
        sendRaw(topic, "phx_leave", JsonObject(emptyMap()))
    }

    suspend fun sendBroadcast(topic: String, eventName: String, payload: JsonObject) {
        val outerPayload = buildJsonObject {
            put("type", "broadcast")
            put("event", eventName)
            put("payload", payload)
        }
        sendRaw(topic, "broadcast", outerPayload)
    }

    private suspend fun sendRaw(topic: String, event: String, payload: JsonObject, joinRef: String? = null) {
        val ref = (++refCount).toString()
        val array = buildJsonArray {
            if (joinRef != null) add(joinRef) else add(JsonNull)
            add(ref)
            add(topic)
            add(event)
            add(payload)
        }
        val text = jsonConfig.encodeToString(array)
        session?.send(Frame.Text(text))
    }

    fun disconnect() {
        scope.launch {
            heartbeatJob?.cancel()
            session?.close()
            session = null
        }
    }
}
