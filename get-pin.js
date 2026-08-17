import fs from 'fs';
import path from 'path';

async function getPin() {
  const API_URL = "https://ewsehvgwzczlshyoyhqf.supabase.co/functions/v1/server";
  const HMAC_SECRET = "b71c22d744b4c73f30d07e6027a054db68700940562e6e3c1a8d46e270a25dc9";
  const crypto = globalThis.crypto;

  async function generateHmacSignature(payload, timestamp) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(HMAC_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${payload}`));
    return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function apiRequest(endpoint, body, token) {
    const timestamp = Date.now().toString();
    const payload = body !== undefined ? JSON.stringify(body) : `/server${endpoint}`;
    const signature = await generateHmacSignature(payload, timestamp);
    const headers = { "Content-Type": "application/json", "X-Request-Timestamp": timestamp, "X-Request-Signature": signature };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_URL}${endpoint}`, { method: body !== undefined ? "POST" : "GET", headers, body: body !== undefined ? payload : undefined });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  }

  try {
    const loginRes = await apiRequest("/auth/login", { email: "mdselimshekh.info@gmail.com", password: "Mdselim@121" });
    const token = loginRes.token;
    let state = await apiRequest("/state", undefined, token);
    const childId = state.activeChildId || state.child?.id || "test-child-123";
    const pairRes = await apiRequest("/pairing/generate", { childId }, token);
    console.log("PAIRING PIN:", pairRes.pin);
  } catch (err) {
    console.error("Failed:", err);
  }
}

getPin();
