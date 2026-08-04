import { projectId, publicAnonKey } from "../../utils/supabase/info"
import { Preferences } from '@capacitor/preferences'
import { authManager } from './auth-manager'
import { encryptData, decryptData } from './crypto'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import {
  SignUpSchema,
  LoginSchema,
  OtpSchema,
  PasswordResetSchema,
  PairingClaimSchema,
  ActionSchema,
} from './validation-schemas'
import { getAppCheckToken } from './app-check'

export const supabaseAuthClient = createSupabaseClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
)

const getApiBaseUrl = () => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_URL) {
      return import.meta.env.VITE_API_URL
    }
  } catch (_e) {}
  return `https://${projectId}.supabase.co/functions/v1/server`
}
const base = getApiBaseUrl()

export type ChildDeviceInfo = {
  id: string
  name: string
  device: string
  location: string
  school?: string
  coordinates?: { lat: number; lng: number }
  battery: number
  online: boolean
  protected: boolean
  screenWidth?: number
  screenHeight?: number
  installedApps?: { name: string; packageName: string; isBlocked: boolean }[]
  callSmsLogs?: { id: string; logType: string; contact: string; detail: string; timestamp: number }[]
  webHistory?: { id: string; url: string; timestamp: number }[]
}

export type StayKidsState = {
  isPremium?: boolean
  activeChildId?: string
  children?: ChildDeviceInfo[]
  child: ChildDeviceInfo
  usage: { minutes: number; limit: number; topApps: string[]; history?: any[] }
  controls: Record<string, any> & { bedtimeSchedule?: string; wakeTime?: string; appLimits?: Record<string, number> }
  blockedApps?: Record<string, boolean>
  rewards: { earned: number; balance: number }
  alerts: { id: string; title: string; detail: string; time: string; read: boolean }[]
  remote: { status: string; tool: string; consentRequired: boolean; audioActive: boolean; alarmActive?: boolean; lastSnapshotTime?: string; mirrorStreamActive?: boolean; lastSignal?: any; lastTouchAction?: string; liveFrame?: string; connectionState?: string; liveAudioChunk?: string; webrtcOffer?: string; webrtcAnswer?: string; webrtcCandidates?: any[] }
}

let inMemoryToken: string | null = null

export const loadAuthToken = async () => {
  const token = await authManager.getToken()
  inMemoryToken = token
  return token
}

export const setAuthToken = async (token: string | null) => {
  inMemoryToken = token
  try {
    if (typeof window !== 'undefined') {
      if (token) {
        await Preferences.set({ key: 'staykids_jwt_token', value: token })
      } else {
        await Preferences.remove({ key: 'staykids_jwt_token' })
        await authManager.clearSession()
      }
    }
  } catch (_e) {}
}

export const getAuthToken = () => inMemoryToken

const defaultChildren: ChildDeviceInfo[] = [
  {
    id: "child-1",
    name: "Child Phone",
    device: "Android Device",
    location: "Current Location",
    coordinates: { lat: 23.8103, lng: 90.4125 },
    battery: 95,
    online: true,
    protected: true,
  },
]

const defaultLocalState: StayKidsState = {
  activeChildId: "child-1",
  children: defaultChildren,
  child: defaultChildren[0],
  usage: {
    minutes: 0,
    limit: 120,
    topApps: [],
  },
  controls: {
    paused: false,
    limits: true,
    bedtime: true,
    filter: true,
  },
  blockedApps: {},
  rewards: {
    earned: 0,
    balance: 0,
  },
  alerts: [],
  remote: {
    status: "idle",
    tool: "Screen Mirror",
    consentRequired: false,
    audioActive: false,
  },
}



// 15-Second AbortController Timeout + Retry with Exponential Backoff
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  let attempt = 0
  let delay = 500

  while (true) {
    attempt++
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const response = await fetch(url, { ...options, signal: controller.signal })
      clearTimeout(timeoutId)
      return response
    } catch (err: any) {
      clearTimeout(timeoutId)
      if (attempt > maxRetries) throw err
      await new Promise((r) => setTimeout(r, delay))
      delay *= 2
    }
  }
}

const getHmacSecret = () => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_HMAC_SECRET) {
      return import.meta.env.VITE_HMAC_SECRET;
    }
  } catch (_e) {}
  return ""; 
}

async function generateHmacSignature(payload: string, timestamp: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) return "";
  const secret = getHmacSecret();
  if (!secret) return ""; // Skip HMAC if not configured
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const dataToSign = `${timestamp}.${payload}`;
    const signature = await crypto.subtle.sign("HMAC", key, enc.encode(dataToSign));
    return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return "";
  }
}

const request = async (path: string, init?: RequestInit, _isIdempotentRead = false) => {
  const token = inMemoryToken || (await loadAuthToken())
  const authHeader = token ? `Bearer ${token}` : `Bearer ${publicAnonKey}`

  const timestamp = Date.now().toString()
  const payload = init?.body ? (typeof init.body === "string" ? init.body : JSON.stringify(init.body)) : path
  const signature = await generateHmacSignature(payload, timestamp)

  const appCheckToken = await getAppCheckToken()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: authHeader,
    "X-Firebase-AppCheck": appCheckToken,
  }

  if (signature) {
    headers["X-Request-Timestamp"] = timestamp
    headers["X-Request-Signature"] = signature
  }

  try {
    const response = await fetchWithRetry(`${base}${path}`, { ...init, headers }, 2)

    if (!response.ok) {
      if (response.status === 401) {
        await setAuthToken(null)
        if (typeof window !== "undefined") {
          window.location.href = "/"
        }
      }
      const errorData = await response.json().catch(() => ({}))
      const msg = errorData.error || `HTTP Error ${response.status}`
      const detailStr = errorData.details ? ` - Details: ${JSON.stringify(errorData.details)}` : ""
      throw new Error(msg + detailStr)
    } else {
      return await response.json()
    }
  } catch (err: any) {
    let finalError = err
    if (err?.name === "AbortError" || (err?.message && err.message.toLowerCase().includes("failed to fetch"))) {
      finalError = new Error("Network Connection Error: Could not reach StayKids server. Please check your mobile data / Wi-Fi connection.")
    }
    if (path.startsWith("/auth/")) {
      throw finalError
    }
    if (path === "/pairing/generate" || path === "/pairing/claim") {
      throw finalError
    }

    if (path === "/state") {
      return defaultLocalState
    }
    throw finalError
  }
}

export const getStayKidsState = () => request("/state", undefined, true) as Promise<StayKidsState>

export const sendStayKidsAction = async (action: Record<string, unknown>) => {
  ActionSchema.parse(action)
  const isIdempotentSignal = action.type === "protection-status" || action.type === "webrtc-signal" || action.type === "select-child" || action.type === "mark-all-read"
  return request("/action", { method: "POST", body: JSON.stringify(action) }, isIdempotentSignal) as Promise<StayKidsState>
}

export const signUpParent = async (data: { name?: string; email: string; password?: string }) => {
  const validated = SignUpSchema.parse(data)
  return await request("/auth/signup", { method: "POST", body: JSON.stringify(validated) })
}

export const verifyEmailOtp = async (data: { email: string; otp: string }) => {
  const validated = OtpSchema.parse(data)
  const result = await request("/auth/verify-otp", { method: "POST", body: JSON.stringify(validated) })
  if (result.token) {
    await setAuthToken(result.token)
    await authManager.setSession({ name: result.user?.name || data.email.split('@')[0], email: data.email }, result.token, 'parent')
  }
  return result
}

export const resendEmailOtp = async (data: { email: string }) => {
  const validated = OtpSchema.pick({ email: true }).parse(data)
  return await request("/auth/resend-otp", { method: "POST", body: JSON.stringify(validated) })
}

export const requestPasswordReset = async (data: { email: string }) => {
  const validated = OtpSchema.pick({ email: true }).parse(data)
  return await request("/auth/forgot-password", { method: "POST", body: JSON.stringify(validated) })
}

export const confirmPasswordReset = async (data: { email: string; otp: string; newPassword?: string }) => {
  const validated = PasswordResetSchema.parse(data)
  const result = await request("/auth/reset-password", { method: "POST", body: JSON.stringify(validated) })
  if (result.token) {
    await setAuthToken(result.token)
    await authManager.setSession({ name: result.user?.name || data.email.split('@')[0], email: data.email }, result.token, 'parent')
  }
  return result
}

export const loginParent = async (data: { email: string; password?: string }) => {
  const validated = LoginSchema.parse(data)
  const result = await request("/auth/login", { method: "POST", body: JSON.stringify(validated) })
  if (result.token) {
    await setAuthToken(result.token)
    await authManager.setSession({ name: result.user?.name || data.email.split('@')[0], email: data.email }, result.token, 'parent')
  }
  return result
}

export const logoutParent = async () => {
  await setAuthToken(null)
  await authManager.clearSession()
}

export const generatePairingCode = (childId?: string) =>
  request("/pairing/generate", { method: "POST", body: JSON.stringify({ childId }) }) as Promise<{ pin: string; qrCode: string }>

export const claimDevicePairing = async (data: { pin: string; deviceName?: string }) => {
  const validated = PairingClaimSchema.parse(data)
  const result = await request("/pairing/claim", { method: "POST", body: JSON.stringify(validated) })
  if (result.deviceToken) {
    await setAuthToken(result.deviceToken)
    // Device token already saved via setAuthToken above; remove insecure localStorage duplicate
  }
  return result
}

export const changeParentPassword = async (data: { currentPassword: string; newPassword: string }) => {
  return request("/auth/change-password", { method: "POST", body: JSON.stringify(data) }) as Promise<{ success: boolean; message?: string; error?: string }>
}

export const exportUserData = async () => {
  return request("/user/export-data", { method: "GET" }) as Promise<any>
}

export const deleteUserAccount = async () => {
  return request("/user/delete-account", { method: "POST" }) as Promise<{ success: boolean; message?: string; error?: string }>
}

export const revokeAllParentSessions = async () => {
  return request("/auth/revoke-all-sessions", { method: "POST" }) as Promise<{ success: boolean; message?: string; error?: string }>
}
