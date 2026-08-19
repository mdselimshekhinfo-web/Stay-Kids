import { createHmac } from "crypto";

const BASE = "https://ewsehvgwzczlshyoyhqf.supabase.co/functions/v1/server";
const EMAIL = "mdselimshekh.info@gmail.com";
const PASSWORD = "Mdselim@121";
const HMAC_SECRET = "b71c22d744b4c73f30d07e6027a054db68700940562e6e3c1a8d46e270a25dc9";

function sign(payload, ts) {
  return createHmac("sha256", HMAC_SECRET).update(`${ts}.${payload}`).digest("hex");
}

async function api(path, method = "GET", body = null, token = null) {
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = "Bearer " + token;
  const ts = Date.now().toString();
  // Server uses rawBodyText for POST, c.req.path (/server/state) for GET
  // c.req.path strips the function prefix, so for /functions/v1/server/state the path is /server/state
  const serverPath = "/server" + path;
  const payload = body ? JSON.stringify(body) : serverPath;
  h["X-Request-Timestamp"] = ts;
  h["X-Request-Signature"] = sign(payload, ts);
  const r = await fetch(BASE + path, { method, headers: h, body: body ? JSON.stringify(body) : null });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data: d };
}

function P(msg) { console.log("  ✅", msg); }
function F(msg, detail) { console.log("  ❌", msg, detail ? "→ " + (typeof detail === "string" ? detail : JSON.stringify(detail)) : ""); }

async function run() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║  StayKids Full Backend API Test      ║");
  console.log("╚══════════════════════════════════════╝\n");

  const login = await api("/auth/login", "POST", { email: EMAIL, password: PASSWORD });
  if (!login.ok || !login.data.token) { F("Login", login.data); return; }
  const tok = login.data.token;
  P("Login OK");

  const s0 = await api("/state", "GET", null, tok);
  if (!s0.ok) { F("GET /state", s0.data); return; }
  const childId = s0.data.activeChildId || s0.data.child?.id;
  P(`GET /state → child: "${s0.data.child?.name}" id: ${childId}`);

  async function act(type, extra = {}) {
    const body = { type, childId, ...extra };
    const r = await api("/action", "POST", body, tok);
    if (r.ok) P(`[${type}]`);
    else F(`[${type}]`, r.data);
    return r;
  }
  async function st() { const r = await api("/state", "GET", null, tok); return r.data; }

  
  const r1 = await api("/action", "POST", { type: "add-child", newChild: { id: "child-1", name: "Child Phone", device: "Emulator" } }, tok);
  console.log("Add child res:", JSON.stringify(r1));
  const r2 = await api("/action", "POST", { type: "toggle-control", key: "paused", childId: "child-1" }, tok);
  console.log("Pause child res:", JSON.stringify(r2));
}
run();

