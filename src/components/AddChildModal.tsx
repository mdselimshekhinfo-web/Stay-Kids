import React, { useState } from "react"
import type { ChildDeviceInfo } from "../lib/staykids-api"

export function AddChildModal({
  isOpen,
  onClose,
  onDeviceAdded,
}: {
  isOpen: boolean
  onClose: () => void
  onDeviceAdded: (newChild: ChildDeviceInfo) => void
}) {
  const [name, setName] = useState("")
  const [device, setDevice] = useState("")
  const [school, setSchool] = useState("")
  const [pairingPin] = useState(() => String(Math.floor(100000 + Math.random() * 900000)))

  if (!isOpen) return null

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !device) return
    const newChild: ChildDeviceInfo = {
      id: `child-${Date.now()}`,
      name,
      device,
      school: school.trim() || undefined,
      location: "Home",
      battery: 100,
      online: true,
      protected: true,
    }
    onDeviceAdded(newChild)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl space-y-4 text-[#172226]">
        <div className="flex items-center justify-between border-b pb-3 border-[#e5ece8]">
          <h2 className="text-base font-bold text-[#172226]">➕ Pair New Child Device</h2>
          <button onClick={onClose} className="rounded-full bg-[#edf2ef] p-1.5 text-xs font-bold text-[#5c6e67] hover:bg-[#dce6e1]">
            ✕
          </button>
        </div>

        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label className="text-xs font-bold text-[#586770]">Child Name (সন্তানের নাম)</label>
            <input
              type="text"
              required
              placeholder="e.g. Noah / Emma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#cbe0d3] p-2.5 text-xs focus:ring-2 focus:ring-[#287555] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#586770]">Device Model (ফোনের মডেল)</label>
            <input
              type="text"
              required
              placeholder="e.g. Galaxy A54 / Xiaomi Pad 6"
              value={device}
              onChange={(e) => setDevice(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#cbe0d3] p-2.5 text-xs focus:ring-2 focus:ring-[#287555] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#586770]">School Name (স্কুলের নাম - Optional)</label>
            <input
              type="text"
              placeholder="e.g. Greenfield International School"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#cbe0d3] p-2.5 text-xs focus:ring-2 focus:ring-[#287555] focus:outline-none"
            />
          </div>

          <div className="rounded-2xl border border-dashed border-[#287555] bg-[#f3faee] p-3 text-center">
            <p className="text-[11px] font-bold text-[#287555]">Single-Use Pairing PIN for New Device</p>
            <p className="mt-1 font-mono text-xl font-bold tracking-[.3em] text-[#17352b]">SK-{pairingPin}</p>
            <p className="mt-1 text-[10px] text-[#6a7c75]">Enter this code during setup on the new child phone</p>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-[#287555] py-3 text-xs font-bold text-white hover:bg-[#1f5c43] transition shadow"
          >
            Confirm & Pair Device →
          </button>
        </form>
      </div>
    </div>
  )
}
