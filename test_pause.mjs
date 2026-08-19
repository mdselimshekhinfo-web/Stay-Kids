import { createHmac } from "crypto";
const BASE = "https://ewsehvgwzczlshyoyhqf.supabase.co/functions/v1/server";
const EMAIL = "mdselimshekh.info@gmail.com";
const PASSWORD = "Mdselim@121";
const HMAC_SECRET = "b71c22d744b4c73f30d07e6027a054db68700940562e6e3c1a8d46e270a25dc9";

function sign(payload, ts) {
  return createHmac("sha256", HMAC_SECRET).update("${ts}.${payload}").digest("hex");
}

async function api(path, method = "GET", body = null, token = null) {
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = "Bearer " + token;
  const ts = Date.now().toString();
  const serverPath = "/server" + path;
  const payload = body ? JSON.stringify(body) : serverPath;
  h["X-Request-Timestamp"] = ts;
  h["X-Request-Signature"] = sign(payload, ts);
  const req = { method, headers: h };
  if (body) req.body = JSON.stringify(body);
  const res = await fetch(BASE.replace("/server", "") + serverPath, req);
  const text = await res.text();
  try { return { ok: res.ok, data: JSON.parse(text) }; } catch { return { ok: res.ok, data: text }; }
}

async function run() {
  const login = await api("/auth/login", "POST", { email: EMAIL, password: PASSWORD });
  const tok = login.data.token;
  console.log("Adding child...");
  const r = await api("/action", "POST", { type: "add-child", newChild: { id: "child-1", name: "Child Phone", device: "Emulator" } }, tok);
  console.log("Add child result:", r.data);
  
  console.log("Pausing device...");
  const r2 = await api("/action", "POST", { type: "toggle-control", key: "paused", childId: "child-1" }, tok);
  console.log("Pause result:", r2.data);
}
run();
