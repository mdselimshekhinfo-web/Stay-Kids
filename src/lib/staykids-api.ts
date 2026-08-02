import { projectId, publicAnonKey } from "../../utils/supabase/info"
import { Preferences } from '@capacitor/preferences'
import { authManager } from './auth-manager'
import { encryptData, decryptData } from './crypto'
import {
  SignUpSchema,
  LoginSchema,
  OtpSchema,
  PasswordResetSchema,
  PairingClaimSchema,
  ActionSchema,
} from './validation-schemas'

const base = import.meta.env.VITE_API_URL || `https://${projectId}.supabase.co/functions/v1/server`

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
  controls: Record<string, boolean> & { bedtimeSchedule?: string; wakeTime?: string }
  blockedApps?: Record<string, boolean>
  rewards: { earned: number; balance: number }
  alerts: { id: string; title: string; detail: string; time: string; read: boolean }[]
  remote: { status: string; tool: string; consentRequired: boolean; audioActive: boolean; alarmActive?: boolean; lastSnapshotTime?: string; mirrorStreamActive?: boolean; lastSignal?: any; lastTouchAction?: string; liveFrame?: string; connectionState?: string; liveAudioChunk?: string }
}

let inMemoryToken: string | null = null

export const loadAuthToken = async () => {
  const token = await authManager.getToken()
  inMemoryToken = token
  return token
}

export const setAuthToken = async (token: string | null) => {
  inMemoryToken = token
  if (token) {
    await Preferences.set({ key: 'staykids_jwt_token', value: token })
  } else {
    await Preferences.remove({ key: 'staykids_jwt_token' })
    await authManager.clearSession()
  }
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

// AES-256 Encrypted Offline Action Queue Implementation
type QueuedAction = {
  id: string
  action: Record<string, unknown>
  timestamp: number
}

const OFFLINE_QUEUE_KEY = "staykids_offline_queue_enc"
const MAX_QUEUE_AGE_MS = 5 * 60 * 1000 // Discard actions older than 5 minutes
const MAX_QUEUE_SIZE = 10

async function getEncryptionPassphrase(): Promise<string> {
  const token = inMemoryToken || (await loadAuthToken())
  if (token) return token
  // Generate a device-specific random key on first use, stored in localStorage
  const DEVICE_KEY_STORAGE = "staykids_device_enc_key"
  let deviceKey = localStorage.getItem(DEVICE_KEY_STORAGE)
  if (!deviceKey) {
    const randomBytes = new Uint8Array(32)
    crypto.getRandomValues(randomBytes)
    deviceKey = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')
    localStorage.setItem(DEVICE_KEY_STORAGE, deviceKey)
  }
  return deviceKey
}

async function getOfflineQueue(): Promise<QueuedAction[]> {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY)
    if (!raw) return []
    const passphrase = await getEncryptionPassphrase()
    const decrypted = await decryptData(raw, passphrase)
    return decrypted ? JSON.parse(decrypted) : []
  } catch (_e) {
    return []
  }
}

async function saveOfflineQueue(queue: QueuedAction[]) {
  try {
    const jsonStr = JSON.stringify(queue)
    const passphrase = await getEncryptionPassphrase()
    const encrypted = await encryptData(jsonStr, passphrase)
    localStorage.setItem(OFFLINE_QUEUE_KEY, encrypted)
  } catch (_e) {}
}

export async function enqueueOfflineAction(action: Record<string, unknown>) {
  if (action.type === "audio-chunk" || action.type === "webrtc-signal") return // Exclude high-frequency streaming frames

  const queue = (await getOfflineQueue()).filter((item) => Date.now() - item.timestamp < MAX_QUEUE_AGE_MS)
  queue.push({
    id: String(Date.now() + Math.random()),
    action,
    timestamp: Date.now(),
  })
  if (queue.length > MAX_QUEUE_SIZE) queue.shift()
  await saveOfflineQueue(queue)
}

export async function flushOfflineQueue() {
  if (typeof window === "undefined" || !navigator.onLine) return
  const queue = await getOfflineQueue()
  if (!queue.length) return

  const remaining = [...queue]
  for (let i = 0; i < remaining.length; i++) {
    try {
      await sendStayKidsAction(remaining[i].action)
      remaining.splice(i, 1)
      i--
      await saveOfflineQueue(remaining)
    } catch {
      break // stop on first failure
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushOfflineQueue().catch(() => {})
  })
}

// 10-Second AbortController Timeout + Retry with Exponential Backoff
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  let attempt = 0
  let delay = 500

  while (true) {
    attempt++
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

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

const request = async (path: string, init?: RequestInit, isIdempotentRead = false) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: publicAnonKey,
  }

  const token = inMemoryToken || (await loadAuthToken())
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  try {
    const response = isIdempotentRead
      ? await fetchWithRetry(`${base}${path}`, { ...init, headers }, 2)
      : await fetchWithRetry(`${base}${path}`, { ...init, headers }, 0)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const msg = errorData.error || `HTTP Error ${response.status}`
      const detailStr = errorData.details ? ` - Details: ${JSON.stringify(errorData.details)}` : ""
      throw new Error(msg + detailStr)
    } else {
      return await response.json()
    }
  } catch (err: any) {
    if (path.startsWith("/auth/")) {
      throw err
    }
    if (path === "/pairing/generate" || path === "/pairing/claim") {
      throw err
    }
    if (path === "/action" && init?.body) {
      try {
        const actionData = JSON.parse(init.body as string)
        await enqueueOfflineAction(actionData)
      } catch (_e) {}
    }

    if (path === "/state") {
      return defaultLocalState
    }
  }

  throw new Error("Failed to fetch data. Please check your connection.")
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
