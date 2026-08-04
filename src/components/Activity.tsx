import React, { useState } from "react"
import type { StayKidsState } from "../lib/staykids-api"

export const Activity = React.memo(function Activity({ state }: { state: StayKidsState }) {
  const [timeframe, setTimeframe] = useState("Today")

  const usage = state.usage || { minutes: 0, limit: 120, topApps: [] }
  const alerts = state.alerts || []
  const recentAlerts = alerts.slice(0, 5)

  const progress = Math.min(100, Math.round((usage.minutes / Math.max(1, usage.limit)) * 100)) || 0

  return (
    <div className="space-y-5 pb-24">
      <div className="pt-2">
        <p className="text-sm text-[#70808b]">{state.child?.name || 'Child'}’s digital day</p>
        <h1 className="mt-1 text-[28px] font-bold tracking-[-.05em]">Activity & Logs</h1>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {["Today", "7 days", "30 days"].map((label) => (
          <button
            key={label}
            onClick={() => setTimeframe(label)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition flex items-center gap-1 ${
              timeframe === label
                ? "bg-[#1d5946] text-white shadow"
                : "bg-[#edf1f2] text-[#6f7b82] hover:bg-[#e2e8ea]"
            }`}
          >
            {label}
            {timeframe === label && <span className="text-[10px] font-normal opacity-80">(Active)</span>}
          </button>
        ))}
      </div>

      <div className="rounded-[22px] border border-[#e1e7e8] bg-white p-5 shadow-sm">
        <h2 className="font-bold text-[#172226] flex items-center gap-2">
          <span className="text-[#287555]">⏱️</span> Screen Time Today
        </h2>
        <div className="mt-3">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">{Math.floor(usage.minutes / 60)}h {usage.minutes % 60}m used</span>
            <span className="text-[#71807a]">{Math.floor(usage.limit / 60)}h {usage.limit % 60}m limit</span>
          </div>
          <div className="h-2 w-full bg-[#edf1f2] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#287555] rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-[22px] border border-[#e1e7e8] bg-white p-5 shadow-sm">
        <h2 className="font-bold text-[#172226] flex items-center gap-2 mb-3">
          <span className="text-[#287555]">📱</span> {timeframe === "Today" ? "Top Apps Today" : `${timeframe} Usage History`}
        </h2>
        {timeframe === "Today" ? (
          usage.topApps && usage.topApps.length > 0 ? (
            <ul className="space-y-2">
              {usage.topApps.map((app, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm font-medium text-[#46545b] bg-[#f7faf8] p-3 rounded-xl border border-[#e4eae6]">
                  <span className="text-[#287555]">✓</span> {app}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-4 bg-[#f9fbfb] rounded-xl border border-[#edf1f2]">
              <span className="text-2xl mb-1 block">📊</span>
              <p className="text-sm text-[#71807a]">Activity data will appear as your child uses their device</p>
            </div>
          )
        ) : (
          <div>
            {(() => {
              const count = timeframe === "7 days" ? 7 : 30
              const historyData = (state.usage?.history && state.usage.history.length > 0)
                ? state.usage.history.slice(0, count)
                : []

              if (historyData.length === 0) {
                return (
                  <div className="text-center py-4 bg-[#f9fbfb] rounded-xl border border-[#edf1f2] mt-4">
                    <span className="text-2xl mb-1 block">📈</span>
                    <p className="text-sm text-[#71807a]">Historical data will appear here after 24 hours of usage.</p>
                  </div>
                )
              }

              return (
                <div className="h-44 flex items-end justify-between gap-1 mt-4 pt-2 px-1">
                  {historyData.reverse().map((day: any, i: number) => {
                    const h = Math.min(100, Math.round((day.minutes_used / Math.max(1, usage.limit)) * 100))
                    return (
                      <div key={i} className="flex flex-col items-center flex-1 group relative">
                        <span className="text-[8px] text-[#71807a] opacity-0 group-hover:opacity-100 transition mb-1">{day.minutes_used}m</span>
                        <div className="w-full bg-[#edf1f2] rounded-t-sm" style={{ height: '110px', display: 'flex', alignItems: 'flex-end' }}>
                          <div className="w-full bg-[#287555] rounded-t-sm transition-all duration-300 hover:bg-[#43a878]" style={{ height: `${Math.max(5, h)}%` }}></div>
                        </div>
                        <span className="text-[9px] text-[#71807a] mt-1 font-mono">{new Date(day.date).getDate()}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}
      </div>

      <div className="rounded-[22px] border border-[#e1e7e8] bg-white p-5 shadow-sm">
        <h2 className="font-bold text-[#172226] flex items-center gap-2 mb-3">
          <span className="text-[#287555]">🔔</span> Recent Alerts
        </h2>
        {recentAlerts.length > 0 ? (
          <ul className="space-y-3">
            {recentAlerts.map((alert) => (
              <li key={alert.id} className="flex flex-col gap-1 text-sm bg-[#f7faf8] p-3 rounded-xl border border-[#e4eae6]">
                <div className="flex justify-between">
                  <span className="font-bold text-[#172226]">{alert.title}</span>
                  <span className="text-xs text-[#71807a]">{alert.time}</span>
                </div>
                <span className="text-[#46545b]">{alert.detail}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-4 bg-[#f9fbfb] rounded-xl border border-[#edf1f2]">
            <span className="text-2xl mb-1 block">📊</span>
            <p className="text-sm text-[#71807a]">Activity data will appear as your child uses their device</p>
          </div>
        )}
      </div>

      {/* Priority 3: Call & SMS Metadata History Card */}
      <div className="rounded-[22px] border border-[#e1e7e8] bg-white p-5 shadow-sm">
        <h2 className="font-bold text-[#172226] flex items-center gap-2 mb-3">
          <span className="text-[#287555]">📞</span> Call & SMS History (Metadata)
        </h2>
        {state.child.callSmsLogs && state.child.callSmsLogs.length > 0 ? (
          <ul className="space-y-2 text-xs">
            {state.child.callSmsLogs.slice(0, 15).map((log) => (
              <li key={log.id} className="flex items-center justify-between bg-[#f8fbf9] p-2.5 rounded-xl border border-[#e8f0eb]">
                <div>
                  <span className="font-bold text-[#172226]">{log.contact}</span>
                  <p className="text-[#71807a] text-[11px]">{log.detail}</p>
                </div>
                <span className="text-[10px] text-[#809098] shrink-0">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-4 bg-[#f9fbfb] rounded-xl border border-[#edf1f2]">
            <span className="text-2xl mb-1 block">📞</span>
            <p className="text-sm text-[#71807a]">No recent call or SMS metadata logged yet</p>
          </div>
        )}
      </div>

      {/* Priority 4: Web & Search History Card */}
      <div className="rounded-[22px] border border-[#e1e7e8] bg-white p-5 shadow-sm">
        <h2 className="font-bold text-[#172226] flex items-center gap-2 mb-3">
          <span className="text-[#287555]">🌐</span> Web & Search History
        </h2>
        {state.child.webHistory && state.child.webHistory.length > 0 ? (
          <ul className="space-y-2 text-xs">
            {state.child.webHistory.slice(0, 15).map((web) => (
              <li key={web.id} className="flex items-center justify-between bg-[#f8fbf9] p-2.5 rounded-xl border border-[#e8f0eb]">
                <div className="min-w-0 flex-1 pr-2">
                  <p className="font-bold text-[#172226] truncate">{web.url}</p>
                </div>
                <span className="text-[10px] text-[#809098] shrink-0">{new Date(web.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-4 bg-[#f9fbfb] rounded-xl border border-[#edf1f2]">
            <span className="text-2xl mb-1 block">🌐</span>
            <p className="text-sm text-[#71807a]">No web browsing or search queries logged yet</p>
          </div>
        )}
      </div>
    </div>
  )
})
