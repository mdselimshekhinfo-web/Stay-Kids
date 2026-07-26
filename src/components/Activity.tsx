import React, { useState } from "react"
import type { StayKidsState } from "../lib/staykids-api"

const Icon = ({ name }: { name: string }) => (
  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f0f3f6] text-lg" aria-hidden="true">
    {name}
  </span>
)

export function Activity({ state }: { state: StayKidsState }) {
  const [selected, setSelected] = useState("Activity View")
  const [timeframe, setTimeframe] = useState("Today")

  const detailsMap: Record<string, { title: string; body: string; items: string[] }> = {
    "Activity View": {
      title: "Today's Timeline",
      body: "Important device events recorded today:",
      items: ["8:11 AM - Arrived at Greenfield School", "1:15 PM - Chrome Web Filter blocked 1 search", "3:40 PM - Device limit at 58%"],
    },
    "Location View": {
      title: "Location Details",
      body: `${state.child.name} is currently at ${state.child.location}.`,
      items: ["Geofence status: Inside Greenfield School", "Last updated: Just now", "GPS Accuracy: High (within 10m)"],
    },
    "Daily Usage": {
      title: "App Breakdown",
      body: `Total used: ${Math.floor(state.usage.minutes / 60)}h ${state.usage.minutes % 60}m`,
      items: ["YouTube - 45 min", "Roblox - 35 min", "Chrome - 22 min"],
    },
    "Tracking App": {
      title: "Monitored Apps",
      body: "Apps with safety rules applied:",
      items: ["Instagram (Restricted mode)", "YouTube (SafeSearch on)", "Chrome (Web filter on)"],
    },
    Notifications: {
      title: "Device Alerts",
      body: "Recent security & status checks:",
      items: ["14 system checks completed", "No suspicious activity detected"],
    },
    "Browser Monitoring": {
      title: "Safe Search Status",
      body: "Web Content Protection active.",
      items: ["SafeSearch enforced on Google & Bing", "Explicit content blocked", "0 bypass attempts"],
    },
  }

  const cards = [
    ["Activity View", "Today’s important events", "9 events", "◌"],
    ["Location View", `${state.child.name} is at ${state.child.location}`, "Updated now", "⌖"],
    ["Daily Usage", `${Math.floor(state.usage.minutes / 60)}h ${state.usage.minutes % 60}m across 12 apps`, `${Math.round((state.usage.minutes / state.usage.limit) * 100)}% of limit`, "◔"],
    ["Tracking App", "Instagram, YouTube & Chrome", "3 monitored", "◫"],
    ["Notifications", "No concerning notifications", "14 checked", "✦"],
    ["Browser Monitoring", "SafeSearch is on", "No alerts", "◉"],
  ]

  const currentDetail = detailsMap[selected] ?? detailsMap["Activity View"]

  return (
    <div className="space-y-5 pb-24">
      <div className="pt-2">
        <p className="text-sm text-[#70808b]">Mia’s digital day</p>
        <h1 className="mt-1 text-[28px] font-bold tracking-[-.05em]">Activity & Logs</h1>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {["Today", "7 days", "30 days"].map((label) => (
          <button
            key={label}
            onClick={() => setTimeframe(label)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${timeframe === label ? "bg-[#1d5946] text-white" : "bg-[#edf1f2] text-[#6f7b82]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map(([title, detail, meta, icon]) => (
          <button
            key={title}
            onClick={() => setSelected(title)}
            className={`rounded-[21px] border p-4 text-left transition ${selected === title ? "border-[#43a878] bg-[#f3faee] shadow-sm" : "border-[#e1e7e8] bg-white"}`}
          >
            <Icon name={icon} />
            <p className="mt-4 text-sm font-bold leading-5">{title}</p>
            <p className="mt-1 text-xs leading-4 text-[#71807a] truncate">{detail}</p>
            <p className="mt-3 text-xs font-bold text-[#287555]">{meta} →</p>
          </button>
        ))}
      </div>

      <div className="rounded-[22px] border border-[#e1e7e8] bg-white p-5 shadow-sm">
        <p className="font-bold text-[#172226]">{currentDetail.title} ({timeframe})</p>
        <p className="mt-1 text-sm text-[#71807a]">{currentDetail.body}</p>
        <ul className="mt-3 space-y-2">
          {currentDetail.items.map((item, idx) => (
            <li key={idx} className="flex items-center gap-2 text-xs font-medium text-[#46545b] bg-[#f7faf8] p-2.5 rounded-xl border border-[#e4eae6]">
              <span className="text-[#287555]">✓</span> {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
