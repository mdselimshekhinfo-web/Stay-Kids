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
              value={usage.limit}
              onChange={(e) => {
                const val = Math.max(15, Math.min(480, Number(e.target.value) || 15))
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
            value={usage.limit}
            onChange={(e) => onAction({ type: "set-limit", value: Number(e.target.value) })}
          />
          <div className="flex justify-between gap-1 text-[11px] font-bold">
            {[30, 60, 120, 180, 240, 360].map((mins) => (
              <button
                key={mins}
                onClick={() => onAction({ type: "set-limit", value: mins })}
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
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xl">📍</span>
          <div>
            <p className="font-bold text-sm text-[#172226]">Geofencing — Coming Soon</p>
            <p className="text-xs text-[#71807a]">Set safe zones and get alerts when your child arrives or leaves.</p>
          </div>
        </div>
      </div>

      {/* Anti-Theft Siren Alarm */}
      <div className="flex items-center justify-between rounded-[24px] border border-[#ffcdd2] bg-[#fff5f5] p-5 shadow-sm opacity-50">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#feebee] text-xl">🚨</span>
          <div>
            <p className="font-bold text-sm text-[#172226]">Anti-Theft Siren Alarm <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-medium ml-1">(Coming Soon)</span></p>
            <p className="text-xs text-[#71807a]">Ring loud alarm on child device if lost or stolen</p>
          </div>
        </div>
        <button
          type="button"
          disabled
          onClick={() => {}}
          className="rounded-xl px-3.5 py-2 text-xs font-bold transition bg-[#feebee] text-[#c62828] cursor-not-allowed"
        >
          Ring Siren 🚨
        </button>
      </div>

      {items.map(([title, desc, key, value, icon]) => (
        <div key={key} className="flex items-center gap-3 rounded-[20px] border border-[#e1e7e8] bg-white p-4 shadow-sm">
          <Icon name={icon} />
          <div className="min-w-0 flex-1">
            <p className="font-bold">{title}</p>
            <p className="truncate text-sm text-[#72808a]">{desc}</p>
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
                <button
                  type="button"
                  onClick={() => {
                    onAction({ type: "toggle-app-lock", appName: app.name })
                    syncNativeAppBlock(app.packageName || app.name, !isBlocked).catch(() => {})
                  }}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition hover:scale-105 ${isBlocked ? "bg-[#feebee] text-[#c62828] border border-[#ffcdd2]" : "bg-[#f3faee] text-[#287555] border border-[#c5e6b9]"}`}
                >
                  {isBlocked ? "Blocked 🚫" : "Allowed ✓"}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
