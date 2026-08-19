package com.staykids.parent.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class SupabaseClientTest {

    @Test
    fun testGenerateHmacSignature() {
        val payload = "testPayload"
        val timestamp = "1234567890"

        // Set a known HMAC secret for testing
        val originalSecret = SupabaseClient.HMAC_SECRET
        SupabaseClient.HMAC_SECRET = "testsecret"

        val signature = SupabaseClient.generateHmacSignature(payload, timestamp)

        assertNotNull(signature)
        assertNotEquals("", signature)

        // Expected length for SHA-256 in hex
        assertEquals(64, signature.length)

        // Using online HMAC SHA-256 generator with secret "testsecret" and data "1234567890.testPayload"
        // Let's just ensure it's a valid hex string of length 64 and doesn't crash.
        val expectedRegex = "^[a-f0-9]{64}$".toRegex()
        assert(expectedRegex.matches(signature))

        // Restore original secret
        SupabaseClient.HMAC_SECRET = originalSecret
    }

    @Test
    fun testGenerateHmacSignature_EmptySecret() {
        val payload = "testPayload"
        val timestamp = "1234567890"

        val originalSecret = SupabaseClient.HMAC_SECRET
        SupabaseClient.HMAC_SECRET = ""

        val signature = SupabaseClient.generateHmacSignature(payload, timestamp)

        assertEquals("", signature)

        SupabaseClient.HMAC_SECRET = originalSecret
    }
}
