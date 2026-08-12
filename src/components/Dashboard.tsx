import React, { useState, useEffect } from "react"
import { fetchChildUsageStats, fetchChildNotifications, fetchChildCallSmsLogs, StayKidsState } from "../lib/staykids-api"

export const Dashboard = React.memo(function Dashboard({ state }: { state: StayKidsState }) {
  const [activeTab, setActiveTab] = useState<"usage" | "notifications" | "calls">("usage")
  
  const [usageStats, setUsageStats] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [callLogs, setCallLogs] = useState<any[]>([])
  const [smsLogs, setSmsLogs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const childId = state.activeChildId || "child-1"

  useEffect(() => {
    let mounted = true
    const loadData = async () => {
      setIsLoading(true)
      try {
        if (activeTab === "usage") {
          const res = await fetchChildUsageStats(childId)
          if (mounted && res.success) setUsageStats(res.data || [])
        } else if (activeTab === "notifications") {
          const res = await fetchChildNotifications(childId)
          if (mounted && res.success) setNotifications(res.data || [])
        } else if (activeTab === "calls") {
          const [callsRes, smsRes] = await Promise.all([
            fetchChildCallSmsLogs(childId, 'CALL').catch(() => ({ success: false, data: [] })),
            fetchChildCallSmsLogs(childId, 'SMS').catch(() => ({ success: false, data: [] }))
          ])
          if (mounted) {
            if (callsRes.success) setCallLogs(callsRes.data || [])
            if (smsRes.success) setSmsLogs(smsRes.data || [])
          }
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    loadData()
    return () => { mounted = false }
  }, [childId, activeTab])

  const tabs = [
    { id: "usage", label: "App Usage Analytics", icon: "📊" },
    { id: "notifications", label: "Notifications Inbox", icon: "🔔" },
    { id: "calls", label: "Call & SMS Logs", icon: "📞" }
  ] as const

  return (
    <div className="space-y-5 pb-24">
      <div className="pt-2">
        <p className="text-sm text-[#70808b]">{state.child?.name || 'Child'}’s Device Data</p>
        <h1 className="mt-1 text-[28px] font-bold tracking-[-.05em]">Parent Dashboard</h1>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition flex items-center gap-2 ${
              activeTab === tab.id
                ? "bg-[#1d5946] text-white shadow"
                : "bg-[#edf1f2] text-[#6f7b82] hover:bg-[#e2e8ea]"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-[22px] border border-[#e1e7e8] bg-white p-5 shadow-sm min-h-[400px]">
        {isLoading ? (
          <div className="flex h-full min-h-[300px] items-center justify-center">
            <div className="w-8 h-8 border-4 border-[#287555] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {activeTab === "usage" && (
              <div className="space-y-4">
                <h2 className="font-bold text-[#172226] text-lg mb-2">Daily App Usage</h2>
                {usageStats.length > 0 ? (
                  <ul className="space-y-3">
                    {usageStats.map((stat, idx) => (
                      <li key={idx} className="flex items-center justify-between bg-[#f8fbf9] p-3 rounded-xl border border-[#e8f0eb]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#e2e8ea] rounded-xl flex items-center justify-center text-xl">📱</div>
                          <div>
                            <p className="font-bold text-[#172226]">{stat.app_name || stat.package_name}</p>
                            <p className="text-xs text-[#71807a]">Last used: {stat.last_used_time ? new Date(stat.last_used_time).toLocaleString() : 'N/A'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-[#287555]">{Math.round((stat.duration_ms || 0) / 60000)} min</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-8">
                    <span className="text-4xl mb-2 block">📉</span>
                    <p className="text-[#71807a]">No app usage data available for today.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "notifications" && (
              <div className="space-y-4">
                <h2 className="font-bold text-[#172226] text-lg mb-2">Intercepted Notifications</h2>
                {notifications.length > 0 ? (
                  <ul className="space-y-3">
                    {notifications.map((notif, idx) => (
                      <li key={idx} className="flex flex-col gap-1 bg-[#f8fbf9] p-3 rounded-xl border border-[#e8f0eb]">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-[#172226]">{notif.app_name || notif.package_name}</span>
                          <span className="text-xs text-[#809098]">{new Date(notif.post_time).toLocaleTimeString()}</span>
                        </div>
                        <p className="font-medium text-[#46545b] text-sm">{notif.title}</p>
                        {notif.content && <p className="text-xs text-[#71807a] mt-1">{notif.content}</p>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-8">
                    <span className="text-4xl mb-2 block">📭</span>
                    <p className="text-[#71807a]">No notifications intercepted recently.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "calls" && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-bold text-[#172226] text-lg mb-3">Call Logs</h2>
                  {callLogs.length > 0 ? (
                    <ul className="space-y-2">
                      {callLogs.map((log, idx) => (
                        <li key={idx} className="flex items-center justify-between bg-[#f8fbf9] p-3 rounded-xl border border-[#e8f0eb]">
                          <div>
                            <p className="font-bold text-[#172226]">{log.contact_name || log.phone_number}</p>
                            <p className="text-xs text-[#71807a] capitalize">{log.type?.toLowerCase()} · {Math.round((log.duration || 0) / 60)} min</p>
                          </div>
                          <span className="text-xs text-[#809098]">{log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-[#71807a] italic">No call logs found.</p>
                  )}
                </div>

                <div>
                  <h2 className="font-bold text-[#172226] text-lg mb-3">SMS Logs</h2>
                  {smsLogs.length > 0 ? (
                    <ul className="space-y-2">
                      {smsLogs.map((log, idx) => (
                        <li key={idx} className="flex flex-col gap-1 bg-[#f8fbf9] p-3 rounded-xl border border-[#e8f0eb]">
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-[#172226]">{log.contact_name || log.phone_number}</span>
                            <span className="text-xs text-[#809098]">{log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}</span>
                          </div>
                          <p className="text-xs text-[#71807a] capitalize mb-1">{log.type?.toLowerCase()}</p>
                          {log.message_body && <p className="text-sm text-[#46545b] bg-white p-2 rounded-lg border border-[#e1e7e8]">{log.message_body}</p>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-[#71807a] italic">No SMS logs found.</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
})
