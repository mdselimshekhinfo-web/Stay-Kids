import React, { useState } from "react"
import type { StayKidsState } from "../lib/staykids-api"
import { ChildDeviceSwitcherBar } from "./ChildDeviceSwitcherBar"
import { AddChildModal } from "./AddChildModal"
import { FamilyPremiumModal } from "./FamilyPremiumModal"
import { PREMIUM_ENABLED, isPremiumUnlocked } from "../lib/config"

const Icon = ({ name }: { name: string }) => (
  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f0f3f6] text-lg" aria-hidden="true">
    {name}
  </span>
)

export function Home({
  onRemote,
  onProfile,
  state,
  onAction,
}: {
  onRemote: () => void
  onProfile: () => void
  state: StayKidsState
  onAction: (action: Record<string, unknown>) => void
}) {
  const [showAddChildModal, setShowAddChildModal] = useState(false)
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const usage = state.usage
  const child = state.child
  const childrenList = state.children || [child]
  const activeChildId = state.activeChildId || child.id || "child-1"
  const isPaused = state.controls.paused
  const hasPremiumAccess = isPremiumUnlocked(state.isPremium)
  const remainingMins = Math.max(0, usage.limit - usage.minutes)
  const percentUsed = Math.min(100, Math.round((usage.minutes / usage.limit) * 100))

  const handleAddChildClick = () => {
    if (PREMIUM_ENABLED && !hasPremiumAccess && childrenList.length >= 1) {
      setShowPremiumModal(true)
    } else {
      setShowAddChildModal(true)
    }
  }

  return (
    <div className="space-y-5 pb-24">
      <section className="pt-2">
        <p className="text-sm text-[#70808b]">{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-[28px] font-bold tracking-[-.05em]">
            {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}
          </h1>
          <button onClick={onProfile} className="grid h-10 w-10 place-items-center rounded-full bg-[#ffe7c2] text-sm font-bold text-[#8c5b00] shadow-sm hover:scale-105 transition">
            {child.name ? child.name.charAt(0).toUpperCase() : 'P'}
          </button>
        </div>

        {/* Multi-Child Device Selector Bar */}
        <div className="mt-3">
          <ChildDeviceSwitcherBar
            childrenList={childrenList}
            activeChildId={activeChildId}
            onSelectChild={(childId) => onAction({ type: "select-child", childId })}
            onAddChild={handleAddChildClick}
          />
        </div>
      </section>

      <AddChildModal
        isOpen={showAddChildModal}
        onClose={() => setShowAddChildModal(false)}
        onDeviceAdded={(newChild) => onAction({ type: "add-child", newChild })}
      />

      {PREMIUM_ENABLED && (
        <FamilyPremiumModal
          isOpen={showPremiumModal}
          onClose={() => setShowPremiumModal(false)}
          onUpgradeSuccess={() => {
            onAction({ type: "upgrade-premium" })
            setShowAddChildModal(true)
          }}
        />
      )}

      {!child.online && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-[#feebee] p-3 text-xs font-bold text-[#c62828] border border-[#ffcdd2] shadow-sm">
          <span className="text-base animate-pulse">⚠️</span>
          <p>Child Device ({child.device}) is currently offline. Real-time updates & remote controls are paused.</p>
        </div>
      )}

      {(state as any).protectionStatus?.accessibility === false && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-[#feebee] p-3.5 text-xs font-bold text-[#c62828] border border-[#ff8a80] shadow-sm">
          <span className="text-base animate-pulse">⚠️</span>
          <p>Accessibility Service was turned off on {child.name}'s phone. App blocking & remote protection are paused!</p>
        </div>
      )}

      {(state as any).protectionStatus?.admin === false && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-[#fff3e0] p-3.5 text-xs font-bold text-[#e65100] border border-[#ffe082] shadow-sm">
          <span className="text-base animate-pulse">⚡</span>
          <p>Device Admin protection was revoked on {child.name}'s phone. Anti-uninstall protection is inactive.</p>
        </div>
      )}

      <section className={`overflow-hidden rounded-[28px] p-5 text-white transition-colors duration-300 ${isPaused ? "bg-[#8b2318]" : "bg-[#1d5946]"}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-[#cce0d5]">{child.name}'s device</p>
            <h2 className="mt-1 text-xl font-bold">{isPaused ? "Device Paused" : "Everything looks good"}</h2>
            <div className="mt-2 flex items-center gap-2 text-xs text-[#cce0d5]">
              <span className="flex items-center gap-1 font-semibold bg-white/10 px-2 py-0.5 rounded-full">🔋 {child.battery}%</span>
              <span className="flex items-center gap-1 font-semibold bg-white/10 px-2 py-0.5 rounded-full">📶 {child.online ? 'Wi-Fi' : 'Offline'}</span>
              <span className={`flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full ${child.online ? 'bg-[#baf26b]/20 text-[#baf26b]' : 'bg-[#ffcdd2]/20 text-[#ffcdd2]'}`}>● {child.online ? 'Online' : 'Offline'}</span>
            </div>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${isPaused ? "bg-[#ffcdd2] text-[#8b2318]" : "bg-[#baf26b] text-[#17352b]"}`}>
            {isPaused ? "Paused" : "Protected"}
          </span>
        </div>
        <div className="mt-6 flex items-end justify-between">
          <div>
            <p className="text-4xl font-bold tracking-[-.06em]">
              {Math.floor(remainingMins / 60)}h {remainingMins % 60}m
            </p>
            <p className="mt-1 text-sm text-[#cce0d5]">left of {Math.floor(usage.limit / 60)}h daily screen time</p>
          </div>
          <button
            onClick={() => onAction({ type: "toggle-control", key: "paused" })}
            className={`rounded-full px-4 py-2.5 text-sm font-bold transition ${isPaused ? "bg-[#baf26b] text-[#17352b]" : "bg-white/15 text-white hover:bg-white/25"}`}
          >
            {isPaused ? "Resume device" : "Pause device"}
          </button>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Today at a glance</h2>
          <button onClick={onRemote} className="text-sm font-bold text-[#287555]">
            See details
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[22px] border border-[#e1e7e8] bg-white p-4">
            <Icon name="◔" />
            <p className="mt-5 text-2xl font-bold tracking-tight">{percentUsed}%</p>
            <p className="text-sm text-[#72808a]">Screen time used</p>
            <div className="mt-3 h-1.5 rounded-full bg-[#e7edef]">
              <div className="h-full rounded-full bg-[#43a878] transition-all duration-300" style={{ width: `${percentUsed}%` }} />
            </div>
          </div>
          <div className="rounded-[22px] border border-[#e1e7e8] bg-white p-4">
            <Icon name="⌖" />
            <p className="mt-5 text-base font-bold">{child.location || 'Unknown'}</p>
            <p className="text-sm text-[#72808a]">{child.location ? 'Current Location' : ''}</p>
            <button onClick={() => onRemote()} className="mt-3 text-xs font-bold text-[#287555] cursor-pointer">View location →</button>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-[#dbe7d5] bg-[#f3faee] p-4">
        <div className="flex gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#d5f2b0]">✦</div>
          <div>
            <p className="font-bold">Instant Remote Help</p>
            <p className="mt-0.5 text-sm leading-5 text-[#62776b]">One-time setup enabled. Launch mirror, audio or snapshot instantly.</p>
            <button onClick={onRemote} className="mt-3 text-sm font-bold text-[#287555]">
              Open Remote Tools →
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
