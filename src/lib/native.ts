import { registerPlugin } from "@capacitor/core"

export interface StayKidsNativePlugin {
  isAccessibilityEnabled(): Promise<{ enabled: boolean }>
  openAccessibilitySettings(): Promise<void>
  performRemoteNavigation(options: { action: string }): Promise<{ success: boolean }>
  performRemoteTouch(options: { x: number; y: number }): Promise<{ success: boolean }>
  getInstalledApps(): Promise<{ success: boolean; apps: { name: string; packageName: string; isBlocked: boolean }[] }>
  updateBlockedApp(options: { packageName: string; blocked: boolean }): Promise<{ success: boolean }>
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
  stopScreenShare(): Promise<{ success: boolean; streaming?: boolean }>
  isScreenSharingActive(): Promise<{ active: boolean }>
}

const StayKidsNative = registerPlugin<StayKidsNativePlugin>("StayKidsNative")

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
