import fs from 'fs';
import path from 'path';

async function testRemoteEndpoints() {
  console.log("🚀 Testing Remote Action Endpoints...");

  const API_URL = "https://ewsehvgwzczlshyoyhqf.supabase.co/functions/v1/server";
  const HMAC_SECRET = "b71c22d744b4c73f30d07e6027a054db68700940562e6e3c1a8d46e270a25dc9";

  const crypto = globalThis.crypto;
  async function generateHmacSignature(payload, timestamp) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", enc.encode(HMAC_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const dataToSign = `${timestamp}.${payload}`;
    const signature = await crypto.subtle.sign("HMAC", key, enc.encode(dataToSign));
    return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function apiRequest(endpoint, body, token) {
    const timestamp = Date.now().toString();
    const payload = body !== undefined ? JSON.stringify(body) : `/server${endpoint}`;
    const signature = await generateHmacSignature(payload, timestamp);

    const headers = {
      "Content-Type": "application/json",
      "X-Request-Timestamp": timestamp,
      "X-Request-Signature": signature
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${endpoint}`, {
      method: body !== undefined ? "POST" : "GET",
      headers,
      body: body !== undefined ? payload : undefined
    });
    
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  }

  try {
    console.log("Logging in as Parent...");
    const loginRes = await apiRequest("/auth/login", { email: "mdselimshekh.info@gmail.com", password: "Mdselim@121" });
    const token = loginRes.token;
    console.log("✅ Login successful");

    console.log("Adding a test child to ensure ownership...");
    let state = await apiRequest("/action", { 
      type: "add-child", 
      newChild: { id: "test-child-123", name: "Test Remote Child", device: "Emulator" }
    }, token);
    const childId = state.activeChildId || "test-child-123";
    console.log("State after add-child:", JSON.stringify(state, null, 2));
    console.log("Found/Created child ID:", childId);
    
    console.log("Testing mirror-toggle action...");
    state = await apiRequest("/action", { type: "mirror-toggle", active: true, childId }, token);
    if (!state.remote || state.remote.mirrorStreamActive !== true) throw new Error("Mirror state not set correctly");
    console.log("✅ mirror-toggle processed successfully");

    console.log("Testing capture-snapshot action...");
    state = await apiRequest("/action", { type: "capture-snapshot", childId }, token);
    if (state.remote.tool !== "Camera Snapshot") throw new Error("Snapshot tool state not set");
    console.log("✅ capture-snapshot processed successfully");

    console.log("Testing trigger-alarm action...");
    const alarmState = state.remote.alarmActive;
    state = await apiRequest("/action", { type: "trigger-alarm", childId }, token);
    if (state.remote.alarmActive === alarmState) throw new Error("Alarm state did not toggle");
    console.log("✅ trigger-alarm processed successfully");

    console.log("Testing webrtc-signal (Ephemeral KV) action...");
    const signalRes = await apiRequest("/action", { type: "webrtc-signal", offer: { type: "offer", sdp: "dummy-sdp-data" }, childId }, token);
    if (!signalRes.ephemeral) throw new Error("WebRTC signal was not ephemeral as expected");
    if (signalRes.remote.webrtcOffer.sdp !== "dummy-sdp-data") throw new Error("WebRTC offer not saved correctly");
    console.log("✅ webrtc-signal processed successfully");

    console.log("\n🎉 ALL REMOTE FEATURE API ENDPOINTS TESTED SUCCESSFULLY!");
  } catch (err) {
    console.error("❌ TEST FAILED:", err);
  }
}

testRemoteEndpoints();
