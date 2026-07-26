import React, { useEffect, useState } from "react"
import type { StayKidsState } from "../lib/staykids-api"
import { sendStayKidsAction } from "../lib/staykids-api"
import {
  captureNativeSnapshot,
  getNativeLocation,
  checkAccessibilityEnabled,
  checkDeviceAdminEnabled,
  checkOverlayPermissionGranted,
} from "../lib/native"

export function ChildDevice({ state, switchRole }: { state: StayKidsState; switchRole: () => void }) {
  const [help, setHelp] = useState(false)
  const isPaused = state.controls.paused
  const remainingMins = Math.max(0, state.usage.limit - state.usage.minutes)

  // Periodic Health-Check for Accessibility, Device Admin & System Protection
  useEffect(() => {
    const runHealthCheck = async () => {
      try {
        const acc = await checkAccessibilityEnabled().catch(() => ({ enabled: true }))
        const admin = await checkDeviceAdminEnabled().catch(() => ({ enabled: true }))
        const overlay = await checkOverlayPermissionGranted().catch(() => ({ granted: true }))

        sendStayKidsAction({
          type: "protection-status",
          status: {
            accessibility: acc.enabled !== false,
            admin: admin.enabled !== false,
            overlay: overlay.granted !== false,
          },
        }).catch(() => {})
      } catch (_e) {}
    }

    runHealthCheck()
    const interval = setInterval(runHealthCheck, 60000) // Poll health status every 60 seconds
    return () => clearInterval(interval)
  }, [])

  return (
    <main className={`min-h-screen p-5 font-sans text-white transition-colors duration-300 ${isPaused ? "bg-[#721c12]" : "bg-[#1d5946]"}`}>
      <div className="mx-auto max-w-[480px]">
        <div className="flex items-center justify-between pt-4">
          <p className="font-bold tracking-[-.04em]">
            stay<span className="text-[#d6f4ad]">kids</span>
          </p>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">Child device</span>
        </div>
        <div className="mt-16">
          <p className="text-sm text-[#cde0d5]">Hi, Mia</p>
          <h1 className="mt-2 text-4xl font-bold tracking-[-.06em]">{isPaused ? "Device Paused by Parent" : "Your day is on track."}</h1>

          <div className="mt-8 rounded-[28px] bg-white p-6 text-[#172226] shadow-md">
            <p className="text-sm font-bold text-[#6a7b76]">{isPaused ? "Status" : "Screen time remaining"}</p>
            {isPaused ? (
              <p className="mt-3 text-3xl font-bold tracking-tight text-[#b71c1c]">Paused until unpaused</p>
            ) : (
              <p className="mt-3 text-5xl font-bold tracking-[-.07em]">
                {Math.floor(remainingMins / 60)}h {remainingMins % 60}m
              </p>
            )}
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#e6ece8]">
              <div className="h-full rounded-full bg-[#43a878]" style={{ width: `${Math.min(100, Math.round((state.usage.minutes / state.usage.limit) * 100))}%` }} />
            </div>
            <p className="mt-3 text-sm text-[#6b7a76]">Your parent set a {Math.floor(state.usage.limit / 60)}h daily limit.</p>
          </div>

          <div className="mt-4 rounded-[28px] border border-white/15 bg-white/8 p-5 space-y-3">
            <p className="font-bold">One-Time Remote Permission Active</p>
            <p className="mt-2 text-sm leading-6 text-[#cde0d5]">Remote assistance permission was enabled during initial setup. Parent can launch tools directly when needed.</p>

            {/* Emergency Panic SOS Button for Child */}
            <button
              type="button"
              onClick={() => {
                setHelp(true)
                captureNativeSnapshot().catch(() => {})
                getNativeLocation().catch(() => {})
              }}
              className="w-full rounded-2xl bg-[#feebee] border-2 border-[#e53935] p-4 text-center text-[#c62828] hover:bg-[#ffcdd2] transition shadow-lg group"
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl animate-ping">🚨</span>
                <span className="font-bold text-sm">EMERGENCY SOS (জরুরী বিপদকালীন বাটন)</span>
              </div>
              <p className="mt-1 text-[11px] text-[#b71c1c]">অভিভাবককে তাৎক্ষণিক অ্যালার্ট পাঠাতে এবং আশপাশের ছবি তুলতে এখানে চাপ দিন</p>
            </button>

            {help && (
              <div className="rounded-xl bg-[#c62828] p-3 text-center text-xs font-bold text-white shadow">
                🚨 Emergency Alert Sent! Parent notified with GPS Location & Surroundings Photo.
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={() => setHelp(!help)} className="rounded-2xl bg-[#d6f4ad] px-4 py-3 text-xs font-bold text-[#17352b] transition hover:bg-[#c4ec94]">
                {help ? "Help Sent ✓" : "Ask for Help 💬"}
              </button>
              <button
                onClick={() => {
                  setHelp(true)
                  sendStayKidsAction({ type: "trigger-sos" }).catch(() => {})
                }}
                className="rounded-2xl bg-[#ff5252] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#ff1744] shadow-md animate-pulse"
              >
                🚨 Emergency SOS
              </button>
            </div>
          </div>

          <button onClick={switchRole} className="mt-8 text-sm font-bold text-[#d6f4ad] hover:underline">
            Switch to parent mode
          </button>
        </div>
      </div>
    </main>
  )
}
