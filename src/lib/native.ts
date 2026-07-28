import { registerPlugin } from "@capacitor/core"

export interface StayKidsNativePlugin {
  isAccessibilityEnabled(): Promise<{ enabled: boolean }>
  openAccessibilitySettings(): Promise<void>
  performRemoteNavigation(options: { action: string }): Promise<{ success: boolean }>
  performRemoteTouch(options: { x: number; y: number }): Promise<{ success: boolean }>
  getInstalledApps(): Promise<{ success: boolean; apps: { name: string; packageName: string; isBlocked: boolean }[] }>
  updateBlockedApp(options: { packageName: string; blocked: boolean }): Promise<{ success: boolean }>
  updateWebFilter(options: { enabled: boolean }): Promise<{ success: boolean }>
  setDailyLimit(options: { limit: number }): Promise<{ success: boolean }>
  checkCameraPermission(): Promise<{ granted: boolean }>
  requestCameraPermission(): Promise<{ granted: boolean; error?: string }>
  captureCameraSnapshot(): Promise<{ success: boolean; granted?: boolean; filePath?: string; error?: string }>
  checkLocationPermission(): Promise<{ granted: boolean }>
  requestLocationPermission(): Promise<{ granted: boolean; error?: string }>
  getCurrentLocation(): Promise<{ success: boolean; granted?: boolean; latitude?: number; longitude?: number; error?: string }>
  checkMicrophonePermission(): Promise<{ granted: boolean }>
  requestMicrophonePermission(): Promise<{ granted: boolean; error?: string }>
  isDeviceAdminEnabled(): Promise<{ enabled: boolean }>
  enableDeviceAdmin(): Promise<void>
  isBatteryOptimizationDisabled(): Promise<{ disabled: boolean }>
  openBatteryOptimizationSettings(): Promise<void>
  isOverlayPermissionGranted(): Promise<{ granted: boolean }>
  requestOverlayPermission(): Promise<void>
  startScreenShare(): Promise<{ success: boolean; streaming?: boolean; error?: string; message?: string }>
  stopScreenShare(): Promise<{ success: boolean }>
  isScreenSharingActive(): Promise<{ active: boolean }>
  startAudioCapture(): Promise<{ success: boolean; capturing?: boolean; error?: string }>
  stopAudioCapture(): Promise<{ success: boolean; capturing?: boolean }>
  isAudioCapturing(): Promise<{ capturing: boolean }>
  startLiveCamera(options: { facing: string }): Promise<{ success: boolean; streaming?: boolean; error?: string }>
  stopLiveCamera(): Promise<{ success: boolean }>
  isLiveCameraActive(): Promise<{ active: boolean }>
  addListener(eventName: string, listenerFunc: (data: any) => void): Promise<{ remove: () => void }>
  triggerSiren(): Promise<{ success: boolean }>
  stopSiren(): Promise<{ success: boolean }>
  setBedtimeSchedule(options: { time: string }): Promise<{ success: boolean }>
  addGeofence(options: { latitude: number; longitude: number; radius: number }): Promise<{ success: boolean }>
}

const StayKidsNative = registerPlugin<StayKidsNativePlugin>("StayKidsNative", {
  web: {
    isAccessibilityEnabled: async () => ({ enabled: false }),
    openAccessibilitySettings: async () => {},
    performRemoteNavigation: async () => ({ success: true }),
    performRemoteTouch: async () => ({ success: true }),
    getInstalledApps: async () => ({ success: true, apps: [] }),
    updateBlockedApp: async () => ({ success: true }),
    updateWebFilter: async () => ({ success: true }),
    setDailyLimit: async () => ({ success: true }),
    checkCameraPermission: async () => ({ granted: true }),
    requestCameraPermission: async () => ({ granted: true }),
    captureCameraSnapshot: async () => ({ success: true }),
    checkLocationPermission: async () => ({ granted: true }),
    requestLocationPermission: async () => ({ granted: true }),
    getCurrentLocation: async () => ({ success: true, latitude: 23.8103, longitude: 90.4125 }),
    checkMicrophonePermission: async () => ({ granted: true }),
    requestMicrophonePermission: async () => ({ granted: true }),
    isDeviceAdminEnabled: async () => ({ enabled: false }),
    enableDeviceAdmin: async () => {},
    isBatteryOptimizationDisabled: async () => ({ disabled: false }),
    openBatteryOptimizationSettings: async () => {},
    isOverlayPermissionGranted: async () => ({ granted: false }),
    requestOverlayPermission: async () => {},
    startScreenShare: async () => ({ success: true, streaming: true }),
    stopScreenShare: async () => ({ success: true }),
    isScreenSharingActive: async () => ({ active: false }),
    startAudioCapture: async () => ({ success: true, capturing: true }),
    stopAudioCapture: async () => ({ success: true }),
    isAudioCapturing: async () => ({ capturing: false }),
    startLiveCamera: async () => ({ success: true, streaming: true }),
    stopLiveCamera: async () => ({ success: true }),
    isLiveCameraActive: async () => ({ active: false }),
    addListener: async () => ({ remove: () => {} }),
    triggerSiren: async () => ({ success: true }),
    stopSiren: async () => ({ success: true }),
    setBedtimeSchedule: async () => ({ success: true }),
    addGeofence: async () => ({ success: true }),
  } as any,
})

export const APP_PACKAGE_MAP: Record<string, string> = {
  Roblox: "com.roblox.client",
  TikTok: "com.zhiliaoapp.musically",
  YouTube: "com.google.android.youtube",
  Instagram: "com.instagram.android",
}

export const checkAccessibilityEnabled = async (): Promise<boolean> => {
  try {
    const res = await StayKidsNative.isAccessibilityEnabled()
    return res.enabled ?? false
  } catch (_e) {
    console.warn("StayKidsNative plugin not available (Web / Simulated Mode)")
    return false
  }
}

export const openAccessibilitySettings = async (): Promise<void> => {
  try {
    await StayKidsNative.openAccessibilitySettings()
  } catch (_e) {
    console.warn("StayKidsNative: Unable to open accessibility settings in web mode.")
  }
}

export const triggerRemoteNavigation = async (
  action: "HOME" | "BACK" | "RECENTS" | "NOTIFICATIONS" | "QUICK_SETTINGS" | "LOCK_SCREEN" | "OPEN_SETTINGS" | "SWIPE_UP" | "SWIPE_DOWN"
): Promise<boolean> => {
  try {
    const res = await StayKidsNative.performRemoteNavigation({ action })
    return res.success ?? false
  } catch (_e) {
    console.warn(`StayKidsNative: Remote navigation ${action} simulated in web mode.`)
    return false
  }
}

export const triggerRemoteTouch = async (x: number, y: number): Promise<boolean> => {
  try {
    const res = await StayKidsNative.performRemoteTouch({ x, y })
    return res.success ?? false
  } catch (_e) {
    console.warn(`StayKidsNative: Remote touch (${x}, ${y}) simulated in web mode.`)
    return false
  }
}

export const stopLiveCamera = async (): Promise<boolean> => {
  try {
    const res = await StayKidsNative.stopLiveCamera()
    return res.success ?? false
  } catch (_e) {
    console.warn("StayKidsNative: stopLiveCamera simulated in web mode.")
    return false
  }
}


export const syncNativeAppBlock = async (appName: string, blocked: boolean): Promise<boolean> => {
  try {
    const packageName = APP_PACKAGE_MAP[appName] || appName
    const res = await StayKidsNative.updateBlockedApp({ packageName, blocked })
    return res.success ?? false
  } catch (_e) {
    console.warn(`StayKidsNative: App block ${appName} (${blocked ? "blocked" : "allowed"}) simulated in web mode.`)
    return false
  }
}

export const syncWebFilter = async (enabled: boolean): Promise<boolean> => {
  try {
    const res = await StayKidsNative.updateWebFilter({ enabled })
    return res.success ?? false
  } catch (_e) {
    console.warn(`StayKidsNative: Web Filter (${enabled ? "enabled" : "disabled"}) simulated in web mode.`)
    return false
  }
}

export const syncDailyLimit = async (limit: number): Promise<boolean> => {
  try {
    const res = await StayKidsNative.setDailyLimit({ limit })
    return res.success ?? false
  } catch (_e) {
    console.warn(`StayKidsNative: Daily limit (${limit} min) simulated in web mode.`)
    return false
  }
}

export const checkCameraPermission = async (): Promise<boolean> => {
  try {
    const res = await StayKidsNative.checkCameraPermission()
    return res.granted ?? false
  } catch (_e) {
    return true // Fallback for Web mode
  }
}

export const requestCameraPermission = async (): Promise<{ granted: boolean; error?: string }> => {
  try {
    return await StayKidsNative.requestCameraPermission()
  } catch (e: any) {
    return { granted: true } // Fallback for Web mode
  }
}

export const captureNativeSnapshot = async (): Promise<{ success: boolean; granted?: boolean; filePath?: string; error?: string }> => {
  try {
    return await StayKidsNative.captureCameraSnapshot()
  } catch (e: any) {
    console.warn("StayKidsNative: Camera snapshot simulated in web mode.")
    return { success: false, error: e.message || "Simulated web mode" }
  }
}

export const checkLocationPermission = async (): Promise<boolean> => {
  try {
    const res = await StayKidsNative.checkLocationPermission()
    return res.granted ?? false
  } catch (_e) {
    return true // Fallback for Web mode
  }
}

export const requestLocationPermission = async (): Promise<{ granted: boolean; error?: string }> => {
  try {
    return await StayKidsNative.requestLocationPermission()
  } catch (e: any) {
    return { granted: true } // Fallback for Web mode
  }
}

export const getNativeLocation = async (): Promise<{ latitude: number; longitude: number; error?: string } | null> => {
  try {
    const res = await StayKidsNative.getCurrentLocation()
    if (res.success && res.latitude !== undefined && res.longitude !== undefined) {
      return { latitude: res.latitude, longitude: res.longitude }
    }
    return null
  } catch (_e) {
    console.warn("StayKidsNative: GPS Location simulated in web mode.")
    return null
  }
}

export const checkMicrophonePermission = async (): Promise<boolean> => {
  try {
    const res = await StayKidsNative.checkMicrophonePermission()
    return res.granted ?? false
  } catch (_e) {
    return true
  }
}

export const requestMicrophonePermission = async (): Promise<{ granted: boolean; error?: string }> => {
  try {
    return await StayKidsNative.requestMicrophonePermission()
  } catch (e: any) {
    return { granted: true }
  }
}

export const checkDeviceAdminEnabled = async (): Promise<boolean> => {
  try {
    const res = await StayKidsNative.isDeviceAdminEnabled()
    return res.enabled ?? false
  } catch (_e) {
    return false
  }
}

export const requestEnableDeviceAdmin = async (): Promise<void> => {
  try {
    await StayKidsNative.enableDeviceAdmin()
  } catch (_e) {
    console.warn("StayKidsNative: Enable Device Admin simulated in web mode.")
  }
}

export const checkBatteryOptimizationDisabled = async (): Promise<boolean> => {
  try {
    const res = await StayKidsNative.isBatteryOptimizationDisabled()
    return res.disabled ?? false
  } catch (_e) {
    return false
  }
}

export const requestDisableBatteryOptimization = async (): Promise<void> => {
  try {
    await StayKidsNative.openBatteryOptimizationSettings()
  } catch (_e) {
    console.warn("StayKidsNative: Battery Optimization settings simulated in web mode.")
  }
}

export const checkOverlayPermissionGranted = async (): Promise<boolean> => {
  try {
    const res = await StayKidsNative.isOverlayPermissionGranted()
    return res.granted ?? false
  } catch (_e) {
    return false
  }
}

export const requestOverlayPermission = async (): Promise<void> => {
  try {
    await StayKidsNative.requestOverlayPermission()
  } catch (_e) {
    console.warn("StayKidsNative: Display Over Other Apps settings simulated in web mode.")
  }
}

export const startNativeScreenShare = async (): Promise<{ success: boolean; streaming?: boolean; error?: string }> => {
  try {
    return await StayKidsNative.startScreenShare()
  } catch (e: any) {
    console.warn("StayKidsNative: Screen share simulated in web mode.")
    return { success: true, streaming: true }
  }
}

export const stopNativeScreenShare = async (): Promise<boolean> => {
  try {
    const res = await StayKidsNative.stopScreenShare()
    return res.success ?? false
  } catch (_e) {
    return true
  }
}

export const checkNativeScreenShareActive = async (): Promise<boolean> => {
  try {
    const res = await StayKidsNative.isScreenSharingActive()
    return res.active ?? false
  } catch (_e) {
    return false
  }
}

export const listenScreenFrame = (callback: (frameBase64: string) => void): (() => void) => {
  try {
    const handlePromise = StayKidsNative.addListener("screenFrame", (data: any) => {
      if (data && data.frame) {
        callback(data.frame)
      }
    })
    return () => {
      handlePromise.then((h) => h.remove()).catch(() => {})
    }
  } catch (_e) {
    return () => {}
  }
}

export const startNativeAudioCapture = async (): Promise<{ success: boolean; capturing?: boolean; error?: string }> => {
  try {
    return await StayKidsNative.startAudioCapture()
  } catch (e: any) {
    console.warn("StayKidsNative: Audio capture simulated in web mode.")
    return { success: true, capturing: true }
  }
}

export const stopNativeAudioCapture = async (): Promise<boolean> => {
  try {
    const res = await StayKidsNative.stopAudioCapture()
    return res.success ?? false
  } catch (_e) {
    return true
  }
}

export const listenAudioChunk = (callback: (chunkBase64: string) => void): (() => void) => {
  try {
    const handlePromise = StayKidsNative.addListener("audioChunk", (data: any) => {
      if (data && data.chunk) {
        callback(data.chunk)
      }
    })
    return () => {
      handlePromise.then((h) => h.remove()).catch(() => {})
    }
  } catch (_e) {
    return () => {}
  }
}

export const fetchNativeInstalledApps = async (): Promise<{ name: string; packageName: string; isBlocked: boolean }[]> => {
  try {
    const res = await StayKidsNative.getInstalledApps()
    if (res.success && Array.isArray(res.apps)) {
      return res.apps
    }
    return []
  } catch (_e) {
    console.warn("StayKidsNative: Query installed apps simulated in web mode.")
    return []
  }
}

export const startNativeLiveCamera = async (facing: "environment" | "user" = "environment"): Promise<{ success: boolean; error?: string }> => {
  try {
    return await StayKidsNative.startLiveCamera({ facing })
  } catch (e: any) {
    console.warn("StayKidsNative: Live camera simulated in web mode.")
    return { success: true }
  }
}

export const stopNativeLiveCamera = async (): Promise<boolean> => {
  try {
    const res = await StayKidsNative.stopLiveCamera()
    return res.success ?? false
  } catch (_e) {
    return true
  }
}

export const listenCameraFrame = (callback: (frameBase64: string) => void): (() => void) => {
  try {
    const handlePromise = StayKidsNative.addListener("cameraFrame", (data: any) => {
      if (data && data.frame) {
        callback(data.frame)
      }
    })
    return () => {
      handlePromise.then((h) => h.remove()).catch(() => {})
    }
  } catch (_e) {
    return () => {}
  }
}

export const triggerSirenNative = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    return await StayKidsNative.triggerSiren()
  } catch (e: any) {
    console.warn("StayKidsNative: Siren triggered in web mode.")
    return { success: true }
  }
}

export const stopSirenNative = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    return await StayKidsNative.stopSiren()
  } catch (e: any) {
    console.warn("StayKidsNative: Siren stopped in web mode.")
    return { success: true }
  }
}

export const setBedtimeNative = async (time: string): Promise<{ success: boolean; error?: string }> => {
  try {
    return await StayKidsNative.setBedtimeSchedule({ time })
  } catch (e: any) {
    console.warn(`StayKidsNative: Bedtime set to ${time} in web mode.`)
    return { success: true }
  }
}

export const addGeofenceNative = async (latitude: number, longitude: number, radius = 100): Promise<{ success: boolean; error?: string }> => {
  try {
    return await StayKidsNative.addGeofence({ latitude, longitude, radius })
  } catch (e: any) {
    console.warn(`StayKidsNative: Geofence added in web mode.`)
    return { success: true }
  }
}
