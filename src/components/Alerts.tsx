import { useState } from "react"
import type { StayKidsState } from "../lib/staykids-api"

const Icon = ({ name }: { name: string }) => (
  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f0f3f6] text-lg" aria-hidden="true">
    {name}
  </span>
)

export function Alerts({ state, onAction }: { state: StayKidsState; onAction: (action: Record<string, unknown>) => void }) {
  const [filter, setFilter] = useState<string>('all')

  const filteredAlerts = filter === 'all'
    ? (state.alerts || [])
    : (state.alerts || []).filter((a: any) => a.category === filter)

  const unreadCount = (state.alerts || []).filter((a) => !a.read).length

  return (
    <div className="space-y-4 pb-24 font-sans">
      <div className="pt-2 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-[#70808b]">Real-time Event Feed</p>
            {unreadCount > 0 && (
              <span className="rounded-full bg-[#c62828] px-2 py-0.5 text-[10px] font-bold text-white shadow">
                {unreadCount} new
              </span>
            )}
          </div>
          <h1 className="mt-1 text-[28px] font-bold tracking-[-.05em] text-[#172226]">Notification Logs</h1>
        </div>
        <button onClick={() => onAction({ type: "mark-all-read" })} className="text-sm font-bold text-[#287555] hover:underline">
          Mark all read
        </button>
      </div>

      {/* Notification Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        {[
          { key: 'all', label: 'All', icon: '📋' },
          { key: 'sos', label: 'SOS', icon: '🆘' },
          { key: 'location', label: 'Location', icon: '📍' },
          { key: 'activity', label: 'Activity', icon: '📱' },
          { key: 'block', label: 'System', icon: '⚠️' },
          { key: 'call', label: 'Calls', icon: '📞' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${
              filter === f.key
                ? 'bg-[#287555] text-white shadow-md'
                : 'bg-[#f0f5f0] text-[#556660] hover:bg-[#e0ebe0]'
            }`}
          >
            <span>{f.icon}</span> {f.label}
            {f.key !== 'all' && (
              <span className="ml-1 text-[9px] opacity-70">
                {(state.alerts || []).filter((a: any) => a.category === f.key).length > 0 && `(${(state.alerts || []).filter((a: any) => a.category === f.key).length})`}
              </span>
            )}
          </button>
        ))}
      </div>

      {filteredAlerts.length === 0 ? (
        <div className="rounded-[22px] border border-[#e4e9ea] bg-white p-8 text-center space-y-2">
          <p className="text-2xl">🔔</p>
          <p className="font-bold text-sm text-[#172226]">No notifications in this category</p>
          <p className="text-xs text-[#71807a]">New alerts will automatically appear here in real time.</p>
        </div>
      ) : (
        filteredAlerts.map((item) => (
          <button
            key={item.id}
            onClick={() => onAction({ type: "mark-read", id: item.id })}
            className={`flex w-full gap-3 rounded-[22px] border p-4 text-left transition ${
              item.read ? "border-[#e4e9ea] bg-white opacity-75" : "border-[#cbe2d4] bg-[#f5fbf3] shadow-sm ring-1 ring-[#cbe2d4]"
            }`}
          >
            <Icon
              name={
                (item as any).category === "sos" || item.title.includes("SOS") || item.title.includes("EMERGENCY") || item.title.includes("Alarm")
                  ? "🚨"
                  : (item as any).category === "location" || item.title.includes("place") || item.title.includes("School") || item.title.includes("Geofence")
                  ? "⌖"
                  : (item as any).category === "block" || item.title.includes("app") || item.title.includes("protection") || item.title.includes("Blocked")
                  ? "🚫"
                  : (item as any).category === "call" || item.title.includes("Call") || item.title.includes("SMS")
                  ? "📞"
                  : item.title.includes("Snapshot") || item.title.includes("Mirror")
                  ? "📷"
                  : "🔔"
              }
            />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-2">
                <p className="font-bold text-sm text-[#172226]">{item.title}</p>
                <p className="shrink-0 text-xs text-[#809098]">{item.time}</p>
              </div>
              <p className="mt-1 text-sm leading-5 text-[#71807a]">{item.detail}</p>
            </div>
          </button>
        ))
      )}

      <div className="rounded-[22px] bg-[#1d5946] p-5 text-white shadow-md">
        <p className="font-bold">Alert Preferences</p>
        <p className="mt-1 text-sm text-[#cce0d5]">All security alerts (SOS, App Blocks, Geofences, Remote Control logs) are live synced with parents.</p>
      </div>
    </div>
  )
}
