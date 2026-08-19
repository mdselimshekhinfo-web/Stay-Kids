package com.staykids.parent.data

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.android.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

object SupabaseClient {

    // You can inject these from BuildConfig later.
    var PROJECT_ID = "ewsehvgwzczlshyoyhqf"
    var PUBLIC_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3c2Vodmd3emN6bHNoeW95aHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMTA2MjIsImV4cCI6MjA5OTY4NjYyMn0.kWqk1d-8mNt3mG5zwfaRC9RUgZt7WgEyRNrqn7frn-s"
    var HMAC_SECRET = "b71c22d744b4c73f30d07e6027a054db68700940562e6e3c1a8d46e270a25dc9"

    private val jsonConfig = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private val client = HttpClient(Android) {
        install(ContentNegotiation) {
            json(jsonConfig)
        }
    }

    private var authToken: String? = null

    fun setAuthToken(token: String?) {
        authToken = token
    }

    private fun generateHmacSignature(payload: String, timestamp: String): String {
        if (HMAC_SECRET.isEmpty()) return ""
        return try {
            val algorithm = "HmacSHA256"
            val mac = Mac.getInstance(algorithm)
            val secretKeySpec = SecretKeySpec(HMAC_SECRET.toByteArray(), algorithm)
            mac.init(secretKeySpec)
            val dataToSign = "$timestamp.$payload"
            val hash = mac.doFinal(dataToSign.toByteArray())
            hash.joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            ""
        }
    }

    suspend fun getStayKidsState(): StayKidsState {
        return request("/state", HttpMethod.Get)
    }

    suspend fun sendStayKidsAction(action: JsonObject): StayKidsState {
        return request("/action", HttpMethod.Post, action)
    }

    private suspend inline fun <reified T> request(
        path: String,
        method: HttpMethod,
        bodyData: JsonObject? = null
    ): T {
        val token = authToken ?: PUBLIC_ANON_KEY
        val timestamp = System.currentTimeMillis().toString()
        val payload = bodyData?.let { jsonConfig.encodeToString(it) } ?: path
        val signature = generateHmacSignature(payload, timestamp)
        val baseUrl = "https://$PROJECT_ID.supabase.co/functions/v1/server"

        val response: HttpResponse = client.request(baseUrl + path) {
            this.method = method
            header(HttpHeaders.ContentType, ContentType.Application.Json.toString())
            header(HttpHeaders.Authorization, "Bearer $token")
            if (signature.isNotEmpty()) {
                header("X-Request-Timestamp", timestamp)
                header("X-Request-Signature", signature)
            }
            if (bodyData != null) {
                setBody(bodyData)
            }
        }

        if (!response.status.isSuccess()) {
            throw Exception("HTTP Error ${response.status.value}: ${response.bodyAsText()}")
        }

        return response.body()
    }
}
