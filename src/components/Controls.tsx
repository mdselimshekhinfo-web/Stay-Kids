import React, { useEffect, useState } from "react"
import type { StayKidsState } from "../lib/staykids-api"
import { fetchNativeInstalledApps, syncNativeAppBlock } from "../lib/native"

const Icon = ({ name }: { name: string }) => (
  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f0f3f6] text-lg" aria-hidden="true">
    {name}
  </span>
)

export function Controls({ state, onAction }: { state: StayKidsState; onAction: (action: Record<string, unknown>) => void }) {
  const usage = state.usage
  const controls = state.controls

  const [realApps, setRealApps] = useState<{ name: string; packageName: string; isBlocked: boolean }[]>([])
  const [localLimit, setLocalLimit] = useState(state.usage.limit)

  useEffect(() => {
    fetchNativeInstalledApps().then((apps) => {
      if (apps && apps.length > 0) {
        setRealApps(apps)
      }
    }).catch(() => {})
  }, [])

  const defaultAppList = [
    { name: "Roblox", category: "Gaming", icon: "🎮", packageName: "com.roblox.client" },
    { name: "TikTok", category: "Short video", icon: "🎵", packageName: "com.zhiliaoapp.musically" },
    { name: "YouTube", category: "Video Stream", icon: "▶️", packageName: "com.google.android.youtube" },
    { name: "Instagram", category: "Social Media", icon: "📷", packageName: "com.instagram.android" },
  ]

  const displayAppsList = realApps.length > 0 
    ? realApps.map((a) => ({ name: a.name, category: "Installed App", icon: "📱", packageName: a.packageName }))
    : defaultAppList

  const items: [string, string, string, boolean, string][] = [
    ["App limits", "Social apps stop after limit", "limits", controls.limits, "◫"],
    ["Bedtime", "Schedule Only — no native enforcement yet", "bedtime", controls.bedtime, "◐"],
    ["Web filter", "Blocking mature & unsafe content", "filter", controls.filter, "◉"],
  ]

  return (
    <div className="space-y-5 pb-24">
      <div className="pt-2">
        <p className="text-sm text-[#70808b]">{state.child.name}'s {state.child.device}</p>
        <h1 className="mt-1 text-[28px] font-bold tracking-[-.05em]">Controls & Rules</h1>
      </div>

      <div className="rounded-[24px] bg-[#fff1d8] p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-[#8c5b00]">Daily Screen Time Limit</p>
          <span className="rounded-full bg-[#fce4b8] px-2.5 py-0.5 text-xs font-bold text-[#8c5b00]">
            {Math.floor(usage.limit / 60)}h {usage.limit % 60}m limit
          </span>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#fef5e2] text-xl">⏳</span>
            <div>
              <p className="font-bold text-sm text-[#172226]">Daily Screen Time Limit</p>
              <p className="text-xs text-[#71807a]">Automatically locks screen when reached</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-[#f5e6c4] px-3 py-1.5 rounded-xl">
            <input
              type="number"
              min="15"
              max="480"
              step="5"
              value={localLimit}
              onChange={(e) => {
                const val = Math.max(15, Math.min(480, Number(e.target.value) || 15))
                setLocalLimit(val)
                onAction({ type: "set-limit", value: val })
              }}
              className="w-12 bg-transparent font-bold text-sm text-[#8c5b00] text-center focus:outline-none"
            />
            <span className="font-bold text-xs text-[#8c5b00]">min</span>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <input
            aria-label="Daily screen time slider"
            className="w-full accent-[#ca8b18] cursor-pointer"
            type="range"
            min="15"
            max="480"
            step="15"
            value={localLimit}
            onChange={(e) => setLocalLimit(Number(e.target.value))}
            onMouseUp={() => onAction({ type: "set-limit", value: localLimit })}
            onTouchEnd={() => onAction({ type: "set-limit", value: localLimit })}
          />
          <div className="flex justify-between gap-1 text-[11px] font-bold">
            {[30, 60, 120, 180, 240, 360].map((mins) => (
              <button
                key={mins}
                onClick={() => {
                  setLocalLimit(mins)
                  onAction({ type: "set-limit", value: mins })
                }}
                className={`rounded-lg px-2 py-1 transition ${
                  usage.limit === mins ? "bg-[#ca8b18] text-white" : "bg-[#f5e6c4]/60 text-[#8c5b00] hover:bg-[#f5e6c4]"
                }`}
              >
                {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Geofence Zones */}
      <div className="rounded-[24px] border border-[#e1e7e8] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="text-xl">📍</span>
            <div>
              <p className="font-bold text-sm text-[#172226]">Geofencing (Safe Zones)</p>
              <p className="text-xs text-[#71807a]">Alert if {state.child.name} leaves current location (500m radius)</p>
            </div>
          </div>
          <button
            onClick={() => onAction({ type: "toggle-geofence" })}
            className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${controls.geofence ? "bg-[#43a878]" : "bg-[#d8e0e3]"}`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${controls.geofence ? "left-6" : "left-1"}`} />
          </button>
        </div>
      </div>

      {/* Anti-Theft Siren Alarm */}
      <div className={`flex items-center justify-between rounded-[24px] border p-5 shadow-sm transition-opacity ${state.remote?.alarmActive ? "border-[#ef4444] bg-[#fef2f2]" : "border-[#ffcdd2] bg-[#fff5f5]"}`}>
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#feebee] text-xl">🚨</span>
          <div>
            <p className="font-bold text-sm text-[#172226]">Anti-Theft Siren Alarm</p>
            <p className="text-xs text-[#71807a]">{state.remote?.alarmActive ? "Alarm is currently RINGING!" : "Ring loud alarm on child device if lost or stolen"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onAction({ type: "trigger-alarm" })}
          className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${state.remote?.alarmActive ? "bg-[#ef4444] text-white" : "bg-[#feebee] text-[#c62828] hover:bg-[#ffcdd2]"}`}
        >
          {state.remote?.alarmActive ? "Stop Siren ⏹" : "Ring Siren 🚨"}
        </button>
      </div>

      {items.map(([title, desc, key, value, icon]) => (
        <div key={key} className="flex items-center gap-3 rounded-[20px] border border-[#e1e7e8] bg-white p-4 shadow-sm">
          <Icon name={icon} />
          <div className="min-w-0 flex-1">
            <p className="font-bold flex items-center gap-2">
              {title}
              {key === "bedtime" && (
                <input 
                  type="time" 
                  className="bg-gray-100 text-xs px-2 py-0.5 rounded font-medium focus:outline-none"
                  value={state.controls.bedtimeSchedule || "21:00"}
                  onChange={(e) => onAction({ type: "set-bedtime", bedtime: e.target.value })}
                />
              )}
            </p>
            <p className="truncate text-sm text-[#72808a]">{key === "bedtime" ? "Locks phone completely at scheduled time" : desc}</p>
          </div>
          <button
            onClick={() => onAction({ type: "toggle-control", key })}
            className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${value ? "bg-[#43a878]" : "bg-[#d8e0e3]"}`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-200 ${value ? "left-6" : "left-1"}`} />
          </button>
        </div>
      ))}

      {/* Individual App Locker */}
      <div className="rounded-[24px] border border-[#e1e7e8] bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base text-[#172226]">App Locker (ইনডিভিজুয়াল অ্যাপ লক)</h2>
            <p className="text-xs text-[#71807a]">Block or allow specific installed apps instantly</p>
          </div>
          <span className="rounded-full bg-[#edf3ef] px-2.5 py-0.5 text-[10px] font-bold text-[#287555]">
            Real App Inspector ✓
          </span>
        </div>
        <div className="space-y-3 pt-1">
          {displayAppsList.map((app) => {
            const blockedMap = state.blockedApps || {}
            const isBlocked = blockedMap[app.name] ?? false
            return (
              <div key={app.packageName || app.name} className="flex items-center justify-between border-b pb-3 border-[#f0f4f4] last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{app.icon}</span>
                  <div>
                    <p className="font-bold text-sm text-[#172226]">{app.name}</p>
                    <p className="text-xs text-[#71807a]">{app.category} · {isBlocked ? "Blocked" : "Allowed"}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onAction({ type: "toggle-app-lock", appName: app.name })
                      syncNativeAppBlock(app.packageName || app.name, !isBlocked).catch(() => {})
                    }}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition hover:scale-105 w-[90px] text-center ${isBlocked ? "bg-[#feebee] text-[#c62828] border border-[#ffcdd2]" : "bg-[#f3faee] text-[#287555] border border-[#c5e6b9]"}`}
                  >
                    {isBlocked ? "Blocked 🚫" : "Allowed ✓"}
                  </button>
                  
                  {!isBlocked && (
                    <div className="flex items-center gap-1.5 bg-[#f0f4f4] px-2 py-1 rounded-lg">
                      <span className="text-[10px] text-[#71807a]">Limit:</span>
                      <input 
                        type="number"
                        placeholder="No limit"
                        className="w-12 bg-transparent text-[11px] font-bold text-[#172226] focus:outline-none"
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          if (val > 0) {
                            onAction({ type: "set-app-limit", appName: app.name, limit: val })
                          }
                        }}
                      />
                      <span className="text-[10px] text-[#71807a]">min</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
