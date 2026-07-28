// WebCrypto-based Secure PBKDF2 Password Hashing, JWT Sign/Verify & Security Helper

function getSecretKey(): string {
  const secret = Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_AUTH_JWT_SECRET");
  if (!secret || secret.trim() === "") {
    throw new Error("JWT_SECRET environment variable is required and must be set in Supabase project secrets.");
  }
  return secret;
}

function buf2hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hex2buf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function base64urlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return atob(base64);
}

// 1. Slow Password Hashing via WebCrypto PBKDF2 (100,000 Iterations + 128-bit Salt)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = buf2hex(salt);
  
  const passKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    passKey,
    256
  );
  
  const hashHex = buf2hex(derivedBits);
  return `pbkdf2:${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    if (!storedHash) return false;
    
    if (storedHash.startsWith("pbkdf2:")) {
      const parts = storedHash.split(":");
      if (parts.length !== 3) return false;
      const saltHex = parts[1];
      const expectedHashHex = parts[2];
      const salt = hex2buf(saltHex);
      
      const encoder = new TextEncoder();
      const passKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits"]
      );
      
      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          salt: salt,
          iterations: 100000,
          hash: "SHA-256",
        },
        passKey,
        256
      );
      
      const actualHashHex = buf2hex(derivedBits);
      return actualHashHex === expectedHashHex;
    }
    
    if (storedHash.startsWith("sha256:")) {
      const parts = storedHash.split(":");
      if (parts.length !== 3) return false;
      const saltHex = parts[1];
      const expectedHashHex = parts[2];
      const encoder = new TextEncoder();
      const keyBuffer = encoder.encode(password + saltHex);
      const hashBuffer = await crypto.subtle.digest("SHA-256", keyBuffer);
      return buf2hex(hashBuffer) === expectedHashHex;
    }
    
    return false;
  } catch (_e) {
    return false;
  }
}

// 2. JWT Signing & Verification (HMAC-SHA256)
async function getHmacKey(): Promise<CryptoKey> {
  const secretKey = getSecretKey();
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signJwt(payload: Record<string, any>, expiresInSeconds = 86400 * 30): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSeconds };
  
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  
  const key = await getHmacKey();
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(dataToSign)
  );
  const encodedSignature = base64urlEncode(String.fromCharCode(...new Uint8Array(signatureBuffer)));
  
  return `${dataToSign}.${encodedSignature}`;
}

export async function verifyJwt(token: string): Promise<Record<string, any> | null> {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const dataToSign = `${encodedHeader}.${encodedPayload}`;
    
    const key = await getHmacKey();
    const signatureBytes = Uint8Array.from(base64urlDecode(encodedSignature), (c) => c.charCodeAt(0));
    
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(dataToSign)
    );
    
    if (!isValid) return null;
    
    const payload = JSON.parse(base64urlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    
    return payload;
  } catch (_e) {
    return null;
  }
}

export async function signDeviceJwt(payload: { parentEmail: string; deviceId: string; deviceName: string; childId?: string }, expiresInSeconds = 86400 * 365): Promise<string> {
  return signJwt({
    type: "device",
    parentEmail: payload.parentEmail.toLowerCase(),
    deviceId: payload.deviceId,
    deviceName: payload.deviceName,
    childId: payload.childId || "child-1",
  }, expiresInSeconds);
}

// 3. Sliding Window Rate Limiter Class
export class RateLimiter {
  private hits: Map<string, number[]> = new Map();

  isAllowed(key: string, maxHits: number, windowMs: number): boolean {
    const now = Date.now();
    const windowStart = now - windowMs;
    const timestamps = (this.hits.get(key) || []).filter((t) => t > windowStart);

    if (timestamps.length >= maxHits) {
      this.hits.set(key, timestamps);
      return false;
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);
    return true;
  }

  reset(key: string): void {
    this.hits.delete(key);
  }
}

const globalLimiter = new RateLimiter();

export async function checkRateLimit(key: string, maxHits = 5, windowMs = 60000): Promise<boolean> {
  return globalLimiter.isAllowed(key, maxHits, windowMs);
}
