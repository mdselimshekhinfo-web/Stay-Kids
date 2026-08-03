import React, { useEffect, useState } from "react"
import type { StayKidsState } from "../lib/staykids-api"
import { sendStayKidsAction } from "../lib/staykids-api"
import {
  captureNativeSnapshot,
  getNativeLocation,
  checkAccessibilityEnabled,
  checkDeviceAdminEnabled,
  checkOverlayPermissionGranted,
  isAppIconHiddenNative,
  toggleAppIconVisibilityNative,
} from "../lib/native"

export function ChildDevice({ state, switchRole }: { state: StayKidsState; switchRole: () => void }) {
  const [help, setHelp] = useState(false)
  const [goalCompleted, setGoalCompleted] = useState(false)
  const [sendingSos, setSendingSos] = useState(false)
  const [sosError, setSosError] = useState(false)
  const [iconHidden, setIconHidden] = useState(false)
  const isPaused = state.controls.paused
  const remainingMins = Math.max(0, state.usage.limit - state.usage.minutes)
  const rewards = state.rewards || { earned: 0, balance: 0 }

  useEffect(() => {
    isAppIconHiddenNative().then(setIconHidden).catch(() => {})
  }, [])

  // Periodic Health-Check for Accessibility, Device Admin & System Protection
  useEffect(() => {
    const runHealthCheck = async () => {
      try {
        const acc = await checkAccessibilityEnabled().catch(() => false)
        const admin = await checkDeviceAdminEnabled().catch(() => false)
        const overlay = await checkOverlayPermissionGranted().catch(() => false)

        sendStayKidsAction({
          type: "protection-status",
          status: {
            accessibility: acc,
            admin: admin,
            overlay: overlay,
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
          <p className="text-sm text-[#cde0d5]">Hi, {state.child.name}</p>
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
              <div className="h-full rounded-full bg-[#43a878]" style={{ width: `${Math.min(100, Math.round((state.usage.minutes / Math.max(1, state.usage.limit)) * 100))}%` }} />
            </div>
            <p className="mt-3 text-sm text-[#6b7a76]">Your parent set a {Math.floor(state.usage.limit / 60)}h daily limit.</p>
          </div>

          {/* Rewards System */}
          <div className="mt-4 rounded-[28px] border border-[#d6f4ad]/30 bg-[#d6f4ad]/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-[#d6f4ad]">⭐ Rewards Points</p>
                <p className="text-sm text-[#cde0d5]">Complete goals to earn extra time</p>
              </div>
              <div className="rounded-2xl bg-[#d6f4ad] px-4 py-2 text-[#17352b] font-bold text-xl shadow-[0_0_15px_rgba(214,244,173,0.3)]">
                {rewards.balance} pts
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  if (goalCompleted) return
                  sendStayKidsAction({ type: "add-reward-points", points: 10 })
                  setGoalCompleted(true)
                }}
                disabled={goalCompleted}
                className="w-full rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 p-3 text-sm font-bold transition flex flex-col items-center justify-center gap-1"
              >
                <span className="text-2xl">✅</span>
                <span>{goalCompleted ? "Goal Done ✓" : "Complete Goal"}</span>
                <span className="text-[10px] text-[#d6f4ad]">{goalCompleted ? "Claimed" : "+10 pts"}</span>
              </button>
              
              <button
                onClick={() => {
                  if (rewards.balance >= 30) {
                    sendStayKidsAction({ type: "redeem-reward-points", cost: 30, mins: 15 })
                  }
                }}
                disabled={rewards.balance < 30}
                className={`w-full rounded-xl p-3 text-sm font-bold transition flex flex-col items-center justify-center gap-1 ${
                  rewards.balance >= 30 
                    ? "bg-[#d6f4ad] text-[#17352b] hover:bg-[#c5e69c] shadow-[0_0_10px_rgba(214,244,173,0.2)]" 
                    : "bg-white/5 text-white/40 cursor-not-allowed"
                }`}
              >
                <span className="text-2xl">⏳</span>
                <span>Get 15 Mins</span>
                <span className="text-[10px] opacity-70">-30 pts</span>
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-[28px] border border-white/15 bg-white/8 p-5 space-y-3">
            <p className="font-bold">One-Time Remote Permission Active</p>
            <p className="mt-2 text-sm leading-6 text-[#cde0d5]">Remote assistance permission was enabled during initial setup. Parent can launch tools directly when needed.</p>

            {/* Emergency Panic SOS Button for Child */}
            <button
              type="button"
              disabled={sendingSos}
              onClick={async () => {
                if (sendingSos) return
                setSendingSos(true)
                setSosError(false)

                // Capture native location & surroundings snapshot in parallel
                const [locRes, snapRes] = await Promise.all([
                  getNativeLocation().catch(() => null),
                  captureNativeSnapshot().catch(() => null),
                ])

                const payload: Record<string, unknown> = {
                  type: "trigger-sos",
                  source: "panic-button",
                }
                if (locRes?.latitude && locRes?.longitude) {
                  payload.lat = locRes.latitude
                  payload.lng = locRes.longitude
                }

                sendStayKidsAction(payload)
                  .then((res) => {
                    setSendingSos(false)
                    if (res && res.success !== false) {
                      setHelp(true)
                      setTimeout(() => setHelp(false), 7000)
                      if (snapRes?.success) {
                        sendStayKidsAction({ type: "capture-snapshot", facing: "environment" }).catch(() => {})
                      }
                    } else {
                      setSosError(true)
                      setTimeout(() => setSosError(false), 7000)
                    }
                  })
                  .catch(() => {
                    setSendingSos(false)
                    setSosError(true)
                    setTimeout(() => setSosError(false), 7000)
                  })
              }}
              className={`w-full rounded-2xl bg-[#feebee] border-2 border-[#e53935] p-4 text-center text-[#c62828] hover:bg-[#ffcdd2] transition shadow-lg group ${sendingSos ? "opacity-70 cursor-wait" : ""}`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl animate-ping">🚨</span>
                <span className="font-bold text-sm">EMERGENCY SOS (জরুরী বিপদকালীন বাটন)</span>
              </div>
              <p className="mt-1 text-[11px] text-[#b71c1c]">অভিভাবককে তাৎক্ষণিক অ্যালার্ট পাঠাতে এবং আশপাশের ছবি তুলতে এখানে চাপ দিন</p>
            </button>

            {sendingSos && (
              <div className="rounded-xl bg-[#e53935]/80 p-3 text-center text-xs font-bold text-white shadow animate-pulse">
                📡 Sending Emergency Alert to Parent...
              </div>
            )}

            {help && (
              <div className="rounded-xl bg-[#c62828] p-3 text-center text-xs font-bold text-white shadow">
                🚨 Emergency Alert Sent! Parent notified with GPS Location & Surroundings Photo.
              </div>
            )}

            {sosError && (
              <div className="rounded-xl bg-[#d32f2f] p-3 text-center text-xs font-bold text-white shadow border border-white/20">
                ⚠️ Couldn't send alert — check connection and try again.
              </div>
            )}
          </div>

          {/* Off-Store Stealth Mode Icon Concealment Card */}
          <div className="mt-4 rounded-[28px] border border-white/15 bg-white/8 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-white">🥷 Off-Store Stealth Mode</p>
                <p className="text-xs text-[#cde0d5]">Launcher Icon Concealment & Dial Code (*#*#7829#*#*)</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const nextState = !iconHidden
                  const ok = await toggleAppIconVisibilityNative(nextState)
                  if (ok) setIconHidden(nextState)
                }}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  iconHidden ? "bg-[#d6f4ad] text-[#17352b]" : "bg-white/20 text-white hover:bg-white/30"
                }`}
              >
                {iconHidden ? "Icon Hidden ✓" : "Hide Launcher Icon"}
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-[#cde0d5]">
              {iconHidden
                ? "🔒 App icon is hidden from launcher. To open StayKids on this device, dial *#*#7829#*#* in the Phone app."
                : "App icon is visible in app drawer. Tap button above to conceal icon for Off-Store direct distribution."}
            </p>
          </div>

          <button onClick={switchRole} className="mt-8 text-sm font-bold text-[#d6f4ad] hover:underline">
            Switch to parent mode
          </button>
        </div>
      </div>
    </main>
  )
}
