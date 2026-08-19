import { createHmac } from "crypto";
const BASE = "https://ewsehvgwzczlshyoyhqf.supabase.co/functions/v1/server";
const EMAIL = "mdselimshekh.info@gmail.com";
const PASSWORD = "Mdselim@121";
const HMAC_SECRET = "b71c22d744b4c73f30d07e6027a054db68700940562e6e3c1a8d46e270a25dc9";
function sign(payload, ts) { return createHmac("sha256", HMAC_SECRET).update(`${ts}.${payload}`).digest("hex"); }
async function api(path, method = "GET", body = null, token = null) {
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = "Bearer " + token;
  const ts = Date.now().toString();
  const serverPath = "/server" + path;
  const payload = body ? JSON.stringify(body) : serverPath;
  h["X-Request-Timestamp"] = ts;
  h["X-Request-Signature"] = sign(payload, ts);
  const r = await fetch(BASE + path, { method, headers: h, body: body ? JSON.stringify(body) : null });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data: d };
}
async function run() {
  const login = await api("/auth/login", "POST", { email: EMAIL, password: PASSWORD });
  console.log("Login ok:", login.ok, "token:", login.data.token ? "YES" : "NO");
  const tok = login.data.token;
  const s0 = await api("/state", "GET", null, tok);
  console.log("State ok:", s0.ok);
  // Print top-level keys to understand structure
  console.log("State keys:", Object.keys(s0.data || {}));
  console.log("child:", JSON.stringify(s0.data.child));
  console.log("activeChildId:", s0.data.activeChildId);
  console.log("children:", JSON.stringify(s0.data.children));
  console.log("perChild keys:", Object.keys(s0.data.perChild || {}));
}
run().catch(e => console.error("CRASH:", e.message));
