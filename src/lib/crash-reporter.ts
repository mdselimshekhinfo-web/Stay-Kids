/**
 * StayKids Unified Crash & Error Reporting Utility
 * Integrates JS errors (React ErrorBoundary, unhandled rejections)
 * and relays them to native logging / Firebase Crashlytics if configured.
 */

export function reportError(error: unknown, context: string = "General"): void {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  console.error(`[StayKids Error Report] [${context}]:`, message, stack || "")

  // Check if native Android Crashlytics bridge is available via Capacitor
  if (typeof window !== "undefined" && (window as any).Capacitor?.isNativePlatform?.()) {
    try {
      const cap = (window as any).Capacitor
      if (cap && cap.Plugins && cap.Plugins.StayKidsCrashlytics) {
        cap.Plugins.StayKidsCrashlytics.logError({
          message: `[${context}] ${message}`,
          stack: stack || "",
        })
      }
    } catch (_e) {
      // Fallback silent
    }
  }
}

export function initGlobalErrorHandler(): void {
  if (typeof window === "undefined") return

  window.addEventListener("error", (event) => {
    reportError(event.error || event.message, "Unhandled Window Error")
  })

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, "Unhandled Promise Rejection")
  })
}
