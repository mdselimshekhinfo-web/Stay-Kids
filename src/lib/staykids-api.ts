import { projectId, publicAnonKey } from "../../utils/supabase/info"

const base = `https://${projectId}.supabase.co/functions/v1/make-server-2d83519f`

export type ChildDeviceInfo = {
  id: string
  name: string
  device: string
  location: string
  coordinates?: { lat: number; lng: number }
  battery: number
  online: boolean
  protected: boolean
}

export type StayKidsState = {
  isPremium?: boolean
  activeChildId?: string
  children?: ChildDeviceInfo[]
  child: ChildDeviceInfo
  usage: { minutes: number; limit: number; topApps: string[] }
  controls: Record<string, boolean>
  blockedApps?: Record<string, boolean>
  rewards: { earned: number; balance: number }
  alerts: { id: string; title: string; detail: string; time: string; read: boolean }[]
  remote: { status: string; tool: string; consentRequired: boolean; audioActive: boolean; alarmActive?: boolean; lastSnapshotTime?: string; mirrorStreamActive?: boolean; lastSignal?: any; lastTouchAction?: string; liveFrame?: string; connectionState?: string; liveAudioChunk?: string }
}

let inMemoryToken: string | null = typeof window !== "undefined" ? localStorage.getItem("staykids_jwt_token") : null

export const setAuthToken = (token: string | null) => {
  inMemoryToken = token
  if (token) {
    localStorage.setItem("staykids_jwt_token", token)
  } else {
    localStorage.removeItem("staykids_jwt_token")
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


// Offline Action Queue Implementation
type QueuedAction = {
  id: string
  action: Record<string, unknown>
  timestamp: number
}

const OFFLINE_QUEUE_KEY = "staykids_offline_queue"
const MAX_QUEUE_AGE_MS = 5 * 60 * 1000 // Discard actions older than 5 minutes
const MAX_QUEUE_SIZE = 10

function getOfflineQueue(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (_e) {
    return []
  }
}

function saveOfflineQueue(queue: QueuedAction[]) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
  } catch (_e) {}
}

export function enqueueOfflineAction(action: Record<string, unknown>) {
  if (action.type === "audio-chunk" || action.type === "webrtc-signal") return // Exclude high-frequency streaming frames

  const queue = getOfflineQueue().filter((item) => Date.now() - item.timestamp < MAX_QUEUE_AGE_MS)
  queue.push({
    id: String(Date.now() + Math.random()),
    action,
    timestamp: Date.now(),
  })
  if (queue.length > MAX_QUEUE_SIZE) queue.shift()
  saveOfflineQueue(queue)
}

export async function flushOfflineQueue() {
  if (typeof window === "undefined" || !navigator.onLine) return
  const queue = getOfflineQueue()
  if (!queue.length) return

  const remaining = [...queue]
  for (let i = 0; i < remaining.length; i++) {
    try {
      await sendStayKidsAction(remaining[i].action)
      remaining.splice(i, 1)
      i--
      saveOfflineQueue(remaining)
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
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10-second timeout

    try {
      const response = await fetch(url, { ...options, signal: controller.signal })
      clearTimeout(timeoutId)
      return response
    } catch (err: any) {
      clearTimeout(timeoutId)
      if (attempt > maxRetries) throw err
      await new Promise((r) => setTimeout(r, delay))
      delay *= 2 // Exponential backoff (500ms -> 1000ms)
    }
  }
}


const request = async (path: string, init?: RequestInit, isIdempotentRead = false) => {
  const token = inMemoryToken || publicAnonKey
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  }

  try {
    const response = isIdempotentRead
      ? await fetchWithRetry(`${base}${path}`, { ...init, headers }, 2)
      : await fetchWithRetry(`${base}${path}`, { ...init, headers }, 0)

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      if (errData.error) throw new Error(errData.error)
    } else {
      return await response.json()
    }
  } catch (err: any) {
    // If request failed due to offline network connection, enqueue for reconnection flush
    if (init?.method === "POST" && init?.body) {
      try {
        const bodyObj = JSON.parse(init.body as string)
        enqueueOfflineAction(bodyObj)
      } catch (_e) {}
    }

    if (err.message && err.message !== "Failed to fetch" && !err.message.includes("data service is unavailable")) {
      throw err
    }
    console.warn(`[StayKids API Fallback] ${path} using resilient local state:`, err)
  }

  // Resilient Local Fallbacks
  if (path.startsWith("/auth/") || path.startsWith("/pairing/")) {
    throw new Error("Server unavailable. Check your internet connection.")
  }

  return defaultLocalState
}

export const getStayKidsState = () => request("/state", undefined, true) as Promise<StayKidsState>

export const sendStayKidsAction = (action: Record<string, unknown>) => {
  // Idempotent signals get automatic retries
  const isIdempotentSignal = action.type === "protection-status" || action.type === "webrtc-signal" || action.type === "select-child" || action.type === "mark-all-read"
  return request("/action", { method: "POST", body: JSON.stringify(action) }, isIdempotentSignal) as Promise<StayKidsState>
}

export const signUpParent = async (data: { name?: string; email: string; password?: string }) => {
  return await request("/auth/signup", { method: "POST", body: JSON.stringify(data) })
}

export const verifyEmailOtp = async (data: { email: string; otp: string }) => {
  const result = await request("/auth/verify-otp", { method: "POST", body: JSON.stringify(data) })
  if (result.token) setAuthToken(result.token)
  return result
}

export const resendEmailOtp = async (data: { email: string }) => {
  return await request("/auth/resend-otp", { method: "POST", body: JSON.stringify(data) })
}

export const requestPasswordReset = async (data: { email: string }) => {
  return await request("/auth/forgot-password", { method: "POST", body: JSON.stringify(data) })
}

export const confirmPasswordReset = async (data: { email: string; otp: string; newPassword?: string }) => {
  const result = await request("/auth/reset-password", { method: "POST", body: JSON.stringify(data) })
  if (result.token) setAuthToken(result.token)
  return result
}

export const loginParent = async (data: { email: string; password?: string }) => {
  const result = await request("/auth/login", { method: "POST", body: JSON.stringify(data) })
  if (result.token) setAuthToken(result.token)
  return result
}

export const logoutParent = () => {
  setAuthToken(null)
}

export const generatePairingCode = (childId?: string) =>
  request("/pairing/generate", { method: "POST", body: JSON.stringify({ childId }) }) as Promise<{ pin: string; qrCode: string }>

export const claimDevicePairing = async (data: { pin: string; deviceName?: string }) => {
  const result = await request("/pairing/claim", { method: "POST", body: JSON.stringify(data) })
  if (result.deviceToken) {
    setAuthToken(result.deviceToken)
    try {
      localStorage.setItem("staykids_device_token", result.deviceToken)
    } catch (_e) {}
  }
  return result
}
