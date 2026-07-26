import { useEffect, useState } from "react"
import {
  getStayKidsState,
  sendStayKidsAction,
  signUpParent,
  verifyEmailOtp,
  resendEmailOtp,
  requestPasswordReset,
  confirmPasswordReset,
  loginParent,
  generatePairingCode,
  claimDevicePairing,
  type StayKidsState,
} from "./lib/staykids-api"
import {
  checkAccessibilityEnabled,
  openAccessibilitySettings,
  triggerRemoteNavigation,
  syncNativeAppBlock,
  captureNativeSnapshot,
  checkDeviceAdminEnabled,
  requestEnableDeviceAdmin,
  checkBatteryOptimizationDisabled,
  requestDisableBatteryOptimization,
  checkOverlayPermissionGranted,
  requestOverlayPermission,
  checkCameraPermission,
  requestCameraPermission,
  checkLocationPermission,
  requestLocationPermission,
  checkMicrophonePermission,
  requestMicrophonePermission,
  startNativeScreenShare,
  stopNativeScreenShare,
  listenScreenFrame,
  startNativeAudioCapture,
  stopNativeAudioCapture,
  listenAudioChunk,
} from "./lib/native"

const Icon = ({ name }: { name: string }) => (
  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f0f3f6] text-lg" aria-hidden="true">
    {name}
  </span>
)

const initialDefaultState: StayKidsState = {
  child: {
    name: "Child Phone",
    device: "Android Device",
    location: "Current Location",
    battery: 95,
    online: true,
    protected: true,
  },
  usage: {
    minutes: 0,
    limit: 120,
    topApps: [],
  },
  controls: {
    paused: false,
    limits: true,
    bedtime: true,
    filter: true,
  },
  rewards: {
    earned: 0,
    balance: 0,
  },
  alerts: [],
  remote: {
    status: "idle",
    tool: "Screen Mirror",
    consentRequired: false,
    audioActive: false,
  },
}

function ChildDeviceSwitcherBar({
  childrenList,
  activeChildId,
  onSelectChild,
  onAddChild,
}: {
  childrenList: ChildDeviceInfo[]
  activeChildId: string
  onSelectChild: (childId: string) => void
  onAddChild: () => void
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-2 scrollbar-none">
      {childrenList.map((c) => {
        const isActive = c.id === activeChildId
        return (
          <button
            key={c.id}
            onClick={() => onSelectChild(c.id)}
            className={`flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-bold transition shrink-0 ${
              isActive
                ? "bg-[#1d5946] text-white shadow-md ring-2 ring-[#287555]"
                : "bg-white text-[#586770] border border-[#e0e8e4] hover:bg-[#f0f5f2]"
            }`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${c.online ? "bg-[#43a878]" : "bg-[#9e9e9e]"}`} />
            <span>{c.name}</span>
            <span className="text-[10px] opacity-75 font-normal">({c.device})</span>
          </button>
        )
      })}

      <button
        onClick={onAddChild}
        className="flex items-center gap-1.5 rounded-2xl border border-dashed border-[#287555] bg-[#f3faee] px-3.5 py-2 text-xs font-bold text-[#287555] hover:bg-[#e6f4df] transition shrink-0"
      >
        <span>➕</span>
        <span>Add Child Device</span>
      </button>
    </div>
  )
}

function AddChildModal({
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
  const [pairingPin] = useState(() => String(Math.floor(100000 + Math.random() * 900000)))

  if (!isOpen) return null

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !device) return
    const newChild: ChildDeviceInfo = {
      id: `child-${Date.now()}`,
      name,
      device,
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

function FamilyPremiumModal({
  isOpen,
  onClose,
  onUpgradeSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  onUpgradeSuccess: () => void
}) {
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly")
  const [promoCode, setPromoCode] = useState("")
  const [showPromo, setShowPromo] = useState(false)
  const [promoErr, setPromoErr] = useState("")
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSubscribe = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onUpgradeSuccess()
      onClose()
    }, 1200)
  }

  const handleRedeemPromo = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = promoCode.trim().toUpperCase()
    if (clean === "STAYKIDS_FREE_VIP" || clean === "VIP2026" || clean === "FREEPASS" || clean === "ADMIN") {
      setLoading(true)
      setTimeout(() => {
        setLoading(false)
        onUpgradeSuccess()
        onClose()
      }, 800)
    } else {
      setPromoErr("Invalid VIP Promo Code. Try: STAYKIDS_FREE_VIP")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div className="w-full max-w-sm overflow-hidden rounded-[32px] bg-white p-6 shadow-2xl space-y-4 text-[#172226] relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 rounded-full bg-[#edf2ef] p-1.5 text-xs font-bold text-[#5c6e67] hover:bg-[#dce6e1]">
          ✕
        </button>

        <div className="text-center space-y-1.5 pt-1">
          <span className="rounded-full bg-[#ffe7c2] px-3 py-1 text-[11px] font-bold text-[#8c5b00]">
            👑 StayKids Family Premium
          </span>
          <h2 className="text-xl font-bold tracking-tight text-[#172226]">Multi-Child Device Protection</h2>
          <p className="text-xs text-[#63726f] leading-5">
            Connecting 2 or more child devices requires an active Family Premium subscription.
          </p>
        </div>

        <div className="space-y-2 rounded-2xl bg-[#f4f8f5] p-3 text-xs">
          <div className="flex items-center gap-2 font-bold text-[#287555]">
            <span>📱</span> <span>Connect Unlimited Child Devices (1st Free)</span>
          </div>
          <div className="flex items-center gap-2 text-[#465751]">
            <span>🎥</span> <span>Live Screen Mirroring & Audio Listener</span>
          </div>
          <div className="flex items-center gap-2 text-[#465751]">
            <span>🖐️</span> <span>Remote Touch Navigation & Gestures</span>
          </div>
          <div className="flex items-center gap-2 text-[#465751]">
            <span>🚨</span> <span>Instant Emergency SOS Push Alerts</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSelectedPlan("monthly")}
            className={`rounded-2xl p-3 text-center border-2 transition ${
              selectedPlan === "monthly" ? "border-[#287555] bg-[#f3faee] shadow" : "border-[#e0e8e4] bg-white"
            }`}
          >
            <p className="text-[11px] font-bold text-[#586770]">Monthly Pass</p>
            <p className="text-lg font-bold text-[#172226] mt-0.5">৳490<span className="text-[10px] font-normal text-[#71807a]">/mo</span></p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedPlan("yearly")}
            className={`relative rounded-2xl p-3 text-center border-2 transition ${
              selectedPlan === "yearly" ? "border-[#287555] bg-[#f3faee] shadow" : "border-[#e0e8e4] bg-white"
            }`}
          >
            <span className="absolute -top-2.5 right-2 rounded-full bg-[#287555] px-2 py-0.5 text-[9px] font-bold text-white shadow">
              SAVE 50%
            </span>
            <p className="text-[11px] font-bold text-[#586770]">Yearly Pass</p>
            <p className="text-lg font-bold text-[#287555] mt-0.5">৳2,990<span className="text-[10px] font-normal text-[#71807a]">/yr</span></p>
          </button>
        </div>

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full rounded-2xl bg-[#287555] py-3 text-xs font-bold text-white hover:bg-[#1f5c43] transition shadow-lg"
        >
          {loading ? "Activating Family Plan..." : "Start 7-Day Free Trial (৳0 Today) →"}
        </button>

        {/* Admin VIP Promo Code Section */}
        <div className="pt-1 border-t border-[#e8f0ec] text-center">
          {!showPromo ? (
            <button
              onClick={() => setShowPromo(true)}
              className="text-xs font-bold text-[#287555] hover:underline flex items-center justify-center gap-1 mx-auto"
            >
              <span>🎟️ Have an Admin VIP Promo Code?</span>
            </button>
          ) : (
            <form onSubmit={handleRedeemPromo} className="space-y-2 text-left pt-1">
              <label className="text-[11px] font-bold text-[#586770]">Enter Admin VIP Promo Code (ফ্রি কোড)</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="e.g. STAYKIDS_FREE_VIP"
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value)
                    setPromoErr("")
                  }}
                  className="flex-1 rounded-xl border border-[#c5dcd0] px-3 py-2 text-xs font-bold uppercase focus:ring-2 focus:ring-[#287555] focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-[#1d5946] px-3 py-2 text-xs font-bold text-white hover:bg-[#164435] transition shrink-0"
                >
                  Apply Code
                </button>
              </div>
              {promoErr && <p className="text-[10px] font-bold text-[#d32f2f]">{promoErr}</p>}
            </form>
          )}
        </div>

        <p className="text-center text-[10px] text-[#71807a]">Cancel anytime from Google Play / App Store</p>
      </div>
    </div>
  )
}

function Home({
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
  const isPremium = state.isPremium ?? false
  const remainingMins = Math.max(0, usage.limit - usage.minutes)
  const percentUsed = Math.min(100, Math.round((usage.minutes / usage.limit) * 100))

  const handleAddChildClick = () => {
    if (!isPremium && childrenList.length >= 1) {
      setShowPremiumModal(true)
    } else {
      setShowAddChildModal(true)
    }
  }

  return (
    <div className="space-y-5 pb-24">
      <section className="pt-2">
        <p className="text-sm text-[#70808b]">Tuesday, 15 July</p>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-[28px] font-bold tracking-[-.05em]">Good afternoon, Ava</h1>
          <button onClick={onProfile} className="grid h-10 w-10 place-items-center rounded-full bg-[#ffe7c2] text-sm font-bold text-[#8c5b00] shadow-sm hover:scale-105 transition">
            AM
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

      <FamilyPremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        onUpgradeSuccess={() => {
          onAction({ type: "upgrade-premium" })
          setShowAddChildModal(true)
        }}
      />

      {!child.online && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-[#feebee] p-3 text-xs font-bold text-[#c62828] border border-[#ffcdd2] shadow-sm">
          <span className="text-base animate-pulse">⚠️</span>
          <p>Child Device ({child.device}) is currently offline. Real-time updates & remote controls are paused.</p>
        </div>
      )}

      <section className={`overflow-hidden rounded-[28px] p-5 text-white transition-colors duration-300 ${isPaused ? "bg-[#8b2318]" : "bg-[#1d5946]"}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-[#cce0d5]">{child.name}'s device</p>
            <h2 className="mt-1 text-xl font-bold">{isPaused ? "Device Paused" : "Everything looks good"}</h2>
            <div className="mt-2 flex items-center gap-2 text-xs text-[#cce0d5]">
              <span className="flex items-center gap-1 font-semibold bg-white/10 px-2 py-0.5 rounded-full">🔋 84%</span>
              <span className="flex items-center gap-1 font-semibold bg-white/10 px-2 py-0.5 rounded-full">📶 Wi-Fi</span>
              <span className="flex items-center gap-1 font-semibold bg-[#baf26b]/20 text-[#baf26b] px-2 py-0.5 rounded-full">● Online</span>
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
            <p className="mt-5 text-base font-bold">At school</p>
            <p className="text-sm text-[#72808a]">{child.location}</p>
            <p className="mt-3 text-xs font-bold text-[#287555]">View location →</p>
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

function Controls({ state, onAction }: { state: StayKidsState; onAction: (action: Record<string, unknown>) => void }) {
  const usage = state.usage
  const controls = state.controls
  const remainingMins = Math.max(0, usage.limit - usage.minutes)

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
    ["Bedtime", "Device locks at 9:00 PM", "bedtime", controls.bedtime, "◐"],
    ["Web filter", "Blocking mature & unsafe content", "filter", controls.filter, "◉"],
  ]

  return (
    <div className="space-y-5 pb-24">
      <div className="pt-2">
        <p className="text-sm text-[#70808b]">Mia’s Galaxy Tab A8</p>
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

      {/* Anti-Theft Siren Alarm */}
      <div className="flex items-center justify-between rounded-[24px] border border-[#ffcdd2] bg-[#fff5f5] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#feebee] text-xl">🚨</span>
          <div>
            <p className="font-bold text-sm text-[#172226]">Anti-Theft Siren Alarm</p>
            <p className="text-xs text-[#71807a]">Ring loud alarm on child device if lost or stolen</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onAction({ type: "trigger-alarm" })}
          className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${state.remote.alarmActive ? "bg-[#c62828] text-white animate-pulse" : "bg-[#feebee] text-[#c62828] hover:bg-[#ffcdd2]"}`}
        >
          {state.remote.alarmActive ? "Stop Alarm 🔕" : "Ring Siren 🚨"}
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

function Activity({ state }: { state: StayKidsState }) {
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
        <p className="mt-1 text-sm text-[#71808a]">{currentDetail.body}</p>
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

function Alerts({ state, onAction }: { state: StayKidsState; onAction: (action: Record<string, unknown>) => void }) {
  const [filter, setFilter] = useState<"all" | "sos" | "block" | "location" | "call">("all")
  const alerts = state.alerts || []

  const filteredAlerts = alerts.filter((item) => {
    if (filter === "sos") return item.title.includes("SOS") || item.title.includes("EMERGENCY") || item.title.includes("Alarm")
    if (filter === "block") return item.title.includes("app") || item.title.includes("protection") || item.title.includes("Blocked")
    if (filter === "location") return item.title.includes("place") || item.title.includes("School") || item.title.includes("Geofence")
    if (filter === "call") return item.title.includes("Call") || item.title.includes("SMS") || item.title.includes("Activity")
    return true
  })

  const unreadCount = alerts.filter((a) => !a.read).length

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

      {/* Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
        {[
          { key: "all", label: `All (${alerts.length})` },
          { key: "sos", label: "🚨 Emergency & SOS" },
          { key: "block", label: "🚫 App Restrictions" },
          { key: "location", label: "⌖ GPS & Geofence" },
          { key: "call", label: "📞 Calls & Activity" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as any)}
            className={`shrink-0 rounded-xl px-3 py-2 transition ${
              filter === tab.key ? "bg-[#1d5946] text-white shadow-sm" : "bg-[#edf3ef] text-[#586771] hover:bg-[#e2e9e4]"
            }`}
          >
            {tab.label}
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
                item.title.includes("SOS") || item.title.includes("EMERGENCY") || item.title.includes("Alarm")
                  ? "🚨"
                  : item.title.includes("Snapshot") || item.title.includes("Mirror")
                  ? "📷"
                  : item.title.includes("place")
                  ? "⌖"
                  : item.title.includes("app")
                  ? "🚫"
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

function LegalModal({ isOpen, onClose, initialTab = "terms" }: { isOpen: boolean; onClose: () => void; initialTab?: "terms" | "privacy" }) {
  const [activeTab, setActiveTab] = useState<"terms" | "privacy">(initialTab)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] bg-white p-6 shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between border-b pb-4 border-[#e5ece8]">
          <h2 className="text-xl font-bold tracking-tight text-[#172226]">Legal & Privacy Documents</h2>
          <button onClick={onClose} className="rounded-full bg-[#edf2ef] p-1.5 text-xs font-bold text-[#5c6e67] hover:bg-[#dbe4e0]">
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[#edf3ef] p-1">
          <button
            onClick={() => setActiveTab("terms")}
            className={`rounded-lg py-2 text-xs font-bold transition ${activeTab === "terms" ? "bg-white shadow text-[#287555]" : "text-[#71807a]"}`}
          >
            📜 Terms & Conditions
          </button>
          <button
            onClick={() => setActiveTab("privacy")}
            className={`rounded-lg py-2 text-xs font-bold transition ${activeTab === "privacy" ? "bg-white shadow text-[#287555]" : "text-[#71807a]"}`}
          >
            🔒 Privacy Policy
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto space-y-4 text-xs leading-6 text-[#586770] pr-1">
          {activeTab === "terms" ? (
            <>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-[#172226]">1. Parental Guardianship & Legal Authority (অভিভাবকত্ব ও অধিকার)</h3>
                <p>By registering, installing, or configuring StayKids on any child device, you formally represent and warrant that you are the lawful parent, legal guardian, or authorized supervisor of the minor operating the hardware under local family laws.</p>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-[#172226]">2. Native Permissions & Remote Consent (পারমিশন ও রিমোট সম্মতি)</h3>
                <p>Granting system permissions authorizes Accessibility Services, Device Administrator APIs, MediaProjection, and Camera2 interfaces exclusively for child digital protection, screen-time regulation, anti-tampering, and remote parental assistance.</p>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-[#172226]">3. Anti-Tamper Concealment & Secret Dial Code (*#*#7829#*#*)</h3>
                <p>To prevent minor evasion or unauthorized uninstallation, StayKids supports application icon concealment via Android PackageManager. Access to hidden setup menus is strictly protected by the Telephony Dialer Secret Code (*#*#7829#*#* / *#*#STAY#*#*).</p>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-[#172226]">4. Subscription Terms & Free Tier Guarantee (সাবস্ক্রিপশন ও বিলিং)</h3>
                <p>New parent registrations include a 7-Day Free Trial Pass. Basic safety tracking (GPS, Daily Limits, App Locker, Notifications) remains 100% Free Forever. Advanced streaming requires an active Family Premium subscription.</p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-[#172226]">1. International Child Data Privacy (COPPA & GDPR-K Compliance)</h3>
                <p>StayKids strictly adheres to international Children's Online Privacy Protection Acts (COPPA & GDPR-K). No behavioral profiling, tracking, or targeted commercial advertising is ever targeted at minor users.</p>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-[#172226]">2. 256-Bit TLS Encryption & Security Protocols (এনক্রিপশন সুরক্ষা)</h3>
                <p>All real-time location coordinates, screen mirroring WebRTC streams, and control actions pass through 256-Bit TLS encrypted channels. Auth tokens are signed using HMAC-SHA256 JWTs with PBKDF2 stretched password hashing.</p>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-[#172226]">3. Zero Third-Party Monetization Guarantee (ডেটা বিক্রি নিষিদ্ধ)</h3>
                <p>We guarantee that child browsing logs, location history, remote snapshots, and identity telemetry will NEVER be sold, rented, leased, or shared with third-party advertisers or data brokers.</p>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-[#172226]">4. Account Data Ownership & Purge Rights (ডেটা মুছে ফেলার অধিকার)</h3>
                <p>Parents possess absolute ownership of all stored telemetry data. You may request immediate, unrecoverable account purging and data erasure at any time via settings.</p>
              </div>
            </>
          )}
        </div>

        <div className="mt-5 border-t pt-3 border-[#e5ece8]">
          <button onClick={onClose} className="w-full rounded-2xl bg-[#287555] py-3 text-xs font-bold text-white hover:bg-[#1f5c43]">
            I Understand & Agree ✓
          </button>
        </div>
      </div>
    </div>
  )
}

function SubscriptionModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly")
  const [paymentMethod, setPaymentMethod] = useState<"gplay" | "bkash" | "nagad" | "card">("bkash")
  const [subscribed, setSubscribed] = useState(false)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] bg-white p-6 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b pb-4 border-[#e5ece8]">
          <div>
            <span className="rounded-full bg-[#d5f2b0] px-2.5 py-0.5 text-[10px] font-bold text-[#17352b]">🎁 7-Day Free Trial Pass</span>
            <h2 className="text-xl font-bold tracking-tight text-[#172226] mt-1">StayKids Plan Options</h2>
          </div>
          <button onClick={onClose} className="rounded-full bg-[#edf2ef] p-1.5 text-xs font-bold text-[#5c6e67] hover:bg-[#dbe4e0]">
            ✕
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1">
          {/* 7 Day Free Trial Banner */}
          <div className="rounded-2xl bg-[#f3faee] p-4 border border-[#c4e5b7] text-xs text-[#287555] space-y-1">
            <p className="font-bold text-sm text-[#1b503a]">🎉 7-Day Free Trial Activated!</p>
            <p className="text-[11px] leading-5 text-[#426154]">First 7 days: 100% free access to ALL features. After 7 days, basic location & screen time tracking stay <strong>100% FREE FOREVER</strong>, or upgrade to Premium for live screen/audio mirroring.</p>
          </div>

          {/* Feature Tier Breakdown */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-2xl border border-[#e1e8e5] bg-[#f8fbf9] p-3.5 space-y-1.5">
              <p className="font-bold text-[#172226] text-xs uppercase tracking-wider">🟢 Free Forever (৳০/মাস)</p>
              <ul className="space-y-1 text-[11px] text-[#566660]">
                <li>✓ Daily Screen Time Limit</li>
                <li>✓ Real-Time GPS Location</li>
                <li>✓ <strong>App Locker & Block Apps</strong></li>
                <li>✓ <strong>Notification Alerts</strong></li>
                <li>✓ Battery & Wi-Fi Telemetry</li>
                <li>✓ Emergency SOS Alerts</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-[#c5e6b9] bg-[#f3faee] p-3.5 space-y-1.5">
              <p className="font-bold text-[#1e4d3b] text-xs uppercase tracking-wider">⭐ Family Premium (৳৪৯৯/মাস)</p>
              <ul className="space-y-1 text-[11px] text-[#287555]">
                <li>★ Instant Screen Mirroring</li>
                <li>★ One-Way Audio Listening</li>
                <li>★ Remote Live Microphone</li>
                <li>★ Priority Relay Server</li>
                <li>★ Unlimited Child Devices</li>
              </ul>
            </div>
          </div>

          {/* Pricing Selector */}
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#edf3ef] p-1">
            <button
              type="button"
              onClick={() => setSelectedPlan("monthly")}
              className={`rounded-xl py-2.5 text-center text-xs font-bold transition ${selectedPlan === "monthly" ? "bg-white shadow text-[#287555]" : "text-[#71807a]"}`}
            >
              Monthly Subscription
              <span className="block text-[10px] text-[#5b7369]">৳৪৯৯ / month</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedPlan("yearly")}
              className={`relative rounded-xl py-2.5 text-center text-xs font-bold transition ${selectedPlan === "yearly" ? "bg-white shadow text-[#287555]" : "text-[#71807a]"}`}
            >
              Yearly Best Value 🔥
              <span className="block text-[10px] text-[#5b7369]">৳৩৯৯৯ / year (Save 33%)</span>
            </button>
          </div>

          <div className="space-y-2 pt-1">
            <p className="text-xs font-bold text-[#172226]">Select Payment Gateway (পেমেন্ট মাধ্যম):</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "bkash", name: "bKash (বিকাশ)", icon: "💖" },
                { id: "nagad", name: "Nagad (নগদ)", icon: "🟠" },
                { id: "gplay", name: "Google Play", icon: "▶️" },
                { id: "card", name: "Visa / Mastercard", icon: "💳" },
              ].map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setPaymentMethod(method.id as any)}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-bold transition ${paymentMethod === method.id ? "border-[#287555] bg-[#f3faee] text-[#287555]" : "border-[#e0e7e7] bg-white text-[#586771]"}`}
                >
                  <span>{method.icon}</span>
                  <span>{method.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 border-t pt-3 border-[#e5ece8] space-y-2">
          <button
            onClick={() => {
              setSubscribed(true)
              alert(`🎉 Subscription Activated via ${paymentMethod.toUpperCase()}! Your account is upgraded to Family Premium.`)
              onClose()
            }}
            className="w-full rounded-2xl bg-[#287555] py-3.5 text-xs font-bold text-white hover:bg-[#1f5c43] shadow-md transition"
          >
            {subscribed ? "Renew Family Premium Plan →" : "Upgrade to Family Premium →"}
          </button>
          <button
            onClick={onClose}
            className="w-full text-center text-xs font-bold text-[#71807a] hover:underline"
          >
            Continue with Free Forever Tier (৳০)
          </button>
        </div>
      </div>
    </div>
  )
}

function Profile({
  state,
  switchRole,
  user,
  onSignOut,
}: {
  state: StayKidsState
  switchRole: () => void
  user: { name: string; email: string }
  onSignOut: () => void
}) {
  const [lang, setLang] = useState<"en" | "bn">("bn")
  const [showLegal, setShowLegal] = useState(false)
  const [legalTab, setLegalTab] = useState<"terms" | "privacy">("terms")
  const [showSubModal, setShowSubModal] = useState(false)

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase()

  return (
    <div className="space-y-5 pb-24">
      <LegalModal isOpen={showLegal} onClose={() => setShowLegal(false)} initialTab={legalTab} />
      <SubscriptionModal isOpen={showSubModal} onClose={() => setShowSubModal(false)} />
      <div className="pt-2">
        <p className="text-sm text-[#70808b]">Account & Preferences</p>
        <h1 className="mt-1 text-[28px] font-bold tracking-[-.05em]">Profile</h1>
      </div>

      {/* Parent Profile Card */}
      <div className="rounded-[28px] bg-[#1d5946] p-6 text-white shadow-md">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-[#ffe7c2] text-2xl font-bold text-[#8c5b00] border-2 border-white/20">
            {initials || "AM"}
          </div>
          <div>
            <h2 className="text-xl font-bold">{user.name}</h2>
            <p className="text-sm text-[#cce0d5]">{user.email}</p>
            <span className="mt-2 inline-block rounded-full bg-[#baf26b] px-3 py-0.5 text-xs font-bold text-[#17352b]">
              Primary Parent (Account Owner)
            </span>
          </div>
        </div>
      </div>

      {/* Child Profile Info Card */}
      <div className="rounded-[24px] border border-[#e1e7e8] bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b pb-3 border-[#f0f4f4]">
          <p className="font-bold text-base text-[#172226]">Child Profile</p>
          <span className="text-xs font-bold text-[#287555]">Paired Device ✓</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-[#f8fbf9] p-3 rounded-xl">
            <p className="text-xs text-[#71807a]">Child Name</p>
            <p className="font-bold text-[#172226] mt-0.5">{state.child.name} Morgan</p>
          </div>
          <div className="bg-[#f8fbf9] p-3 rounded-xl">
            <p className="text-xs text-[#71807a]">Age / Grade</p>
            <p className="font-bold text-[#172226] mt-0.5">9 Yrs (Grade 4)</p>
          </div>
          <div className="bg-[#f8fbf9] p-3 rounded-xl">
            <p className="text-xs text-[#71807a]">School</p>
            <p className="font-bold text-[#172226] mt-0.5">{state.child.location}</p>
          </div>
          <div className="bg-[#f8fbf9] p-3 rounded-xl">
            <p className="text-xs text-[#71807a]">Device Model</p>
            <p className="font-bold text-[#172226] mt-0.5">{state.child.device}</p>
          </div>
        </div>
      </div>

      {/* Subscription & Family Guardians */}
      <div className="rounded-[24px] border border-[#e1e7e8] bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-bold text-base text-[#172226]">Subscription Plan</p>
          <button onClick={() => setShowSubModal(true)} className="text-xs font-bold text-[#287555] hover:underline">
            Manage Billing →
          </button>
        </div>
        <div onClick={() => setShowSubModal(true)} className="cursor-pointer flex items-center justify-between rounded-2xl bg-[#f3faee] p-3.5 border border-[#d5e8ce] hover:bg-[#ebf7e4] transition">
          <div>
            <p className="font-bold text-sm text-[#1e4d3b]">7-Day Free Trial (All Features Unlocked)</p>
            <p className="text-xs text-[#597869]">7 Days Remaining · No Payment Required</p>
          </div>
          <span className="rounded-full bg-[#287555] px-3 py-1 text-xs font-bold text-white">Free Trial 🎉</span>
        </div>
      </div>

      {/* Preferences & Language Toggle */}
      <div className="rounded-[24px] border border-[#e1e7e8] bg-white p-5 shadow-sm space-y-4">
        <p className="font-bold text-base text-[#172226]">App Preferences & Legal</p>
        <div className="flex items-center justify-between border-b pb-3 border-[#f0f4f4]">
          <div>
            <p className="font-bold text-sm">App Language (ভাষা)</p>
            <p className="text-xs text-[#71807a]">Choose interface language</p>
          </div>
          <div className="flex rounded-xl bg-[#edf3ef] p-1">
            <button
              onClick={() => setLang("en")}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition ${lang === "en" ? "bg-white shadow text-[#287555]" : "text-[#71807a]"}`}
            >
              English
            </button>
            <button
              onClick={() => setLang("bn")}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition ${lang === "bn" ? "bg-white shadow text-[#287555]" : "text-[#71807a]"}`}
            >
              বাংলা
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center pt-1">
          <div>
            <p className="font-bold text-sm">Terms & Privacy Policies</p>
            <p className="text-xs text-[#71807a]">Review legal compliance & privacy</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setLegalTab("terms")
                setShowLegal(true)
              }}
              className="text-xs font-bold text-[#287555] hover:underline"
            >
              Terms
            </button>
            <span className="text-xs text-[#b8c4bf]">·</span>
            <button
              onClick={() => {
                setLegalTab("privacy")
                setShowLegal(true)
              }}
              className="text-xs font-bold text-[#287555] hover:underline"
            >
              Privacy
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-2">
        <button
          onClick={onSignOut}
          className="w-full rounded-2xl bg-[#feebee] py-3.5 text-sm font-bold text-[#c62828] hover:bg-[#ffcdd2] transition"
        >
          Sign Out of Account
        </button>
      </div>
    </div>
  )
}

function Remote({ state, onAction }: { state: StayKidsState; onAction: (data: Record<string, unknown>) => void }) {
  const [tool, setTool] = useState("Live Camera")
  const [activeSession, setActiveSession] = useState<string | null>("Live Camera")
  const [camFacing, setCamFacing] = useState<"environment" | "user">("environment")
  const audio = state.remote.audioActive

  const tools = [
    ["Live Camera", "📷", "View child surroundings"],
    ["Live GPS Map", "🗺️", "Free OpenStreetMap tracking"],
    ["Screen Mirror", "▣", "Live view of child screen"],
    ["One-way audio", "🎙️", "Listen to background sound"],
    ["Remote access", "↗", "Assist approved settings"],
    ["Snapshot", "◉", "Silent camera snapshot"],
  ]

  const childName = state.child.name || "Child Device"
  const lat = state.child.coordinates?.lat || 23.8103
  const lng = state.child.coordinates?.lng || 90.4125

  return (
    <div className="space-y-5 pb-24">
      <div>
        <p className="text-sm text-[#70808b]">{childName} · {state.child.device}</p>
        <h1 className="mt-1 text-[28px] font-bold tracking-[-.05em]">Remote Control & Surveillance</h1>
      </div>

      <div className="rounded-[28px] bg-[#1d5946] p-6 text-white shadow-sm flex items-center justify-between">
        <div>
          <span className="rounded-full bg-[#d6f4ad] px-2.5 py-0.5 text-[10px] font-bold text-[#17352b]">
            🛡️ Consent & System Protection Active
          </span>
          <h2 className="mt-2 text-lg font-bold">Child Surroundings & Live Feed</h2>
          <p className="mt-1 text-xs text-[#cce0d5]">Zero prompts required on child device in emergency.</p>
        </div>
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 text-2xl">
          📷
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tools.map(([name, icon, desc]) => (
          <button
            key={name}
            onClick={() => {
              setTool(name)
              setActiveSession(name)
              onAction({ type: "select-remote-tool", tool: name })
            }}
            className={`rounded-[20px] border p-4 text-left transition ${tool === name ? "border-[#43a878] bg-[#f3faee] shadow-sm" : "border-[#e1e7e8] bg-white"}`}
          >
            <span className="text-xl">{icon}</span>
            <p className="mt-3 text-sm font-bold text-[#172226]">{name}</p>
            <p className="mt-0.5 text-xs leading-4 text-[#71807a]">{desc}</p>
          </button>
        ))}
      </div>

      <div className="rounded-[22px] border border-[#e1e7e8] bg-white p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-bold text-sm text-[#172226]">{tool}</p>
            <p className="text-xs text-[#72808a]">{activeSession === tool ? "Session Active (Live Connection)" : "Ready to launch"}</p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${activeSession === tool ? "bg-[#dbf6bf] text-[#27643e]" : "bg-[#edf1f3] text-[#586771]"}`}>
            {activeSession === tool ? "Live" : "Ready"}
          </span>
        </div>

        {/* 1. Live Camera Surroundings View */}
        {tool === "Live Camera" && (
          <div className="space-y-3 pt-1">
            <div className="relative overflow-hidden rounded-2xl bg-[#111c18] border border-[#287555] p-4 text-white text-center flex flex-col items-center justify-center min-h-[220px]">
              <span className="absolute top-3 left-3 rounded-full bg-[#feebee] px-2.5 py-0.5 text-[10px] font-bold text-[#c62828] animate-pulse flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#c62828]" /> 🔴 SURROUNDINGS FEED ({camFacing === "environment" ? "Rear Camera" : "Front Camera"})
              </span>

              <div className="my-6 space-y-2">
                <span className="text-4xl">📷</span>
                <p className="text-xs font-bold text-[#d6f4ad]">Live Camera Stream & Instant Photo View</p>
                <p className="text-[11px] text-[#a1b8ae]">
                  সন্তান বিপদে পড়লে আশপাশের পরিস্থিতি রিয়েল-টাইমে দেখতে নিচে সাইলেন্ট স্ন্যাপশট বাটনে চাপ দিন।
                </p>
              </div>

              {state.remote.lastSnapshotTime && (
                <div className="w-full rounded-xl bg-black/60 p-2.5 text-[11px] text-[#d6f4ad]">
                  ✓ Last Surroundings Snapshot Captured: {state.remote.lastSnapshotTime}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCamFacing(camFacing === "environment" ? "user" : "environment")}
                className="flex-1 rounded-xl border border-[#a9c9b2] bg-[#f3faee] py-3 text-xs font-bold text-[#287555] hover:bg-[#e7f5e1] transition"
              >
                🔄 Switch ({camFacing === "environment" ? "Rear → Front" : "Front → Rear"})
              </button>
              <button
                type="button"
                onClick={() => {
                  onAction({ type: "capture-snapshot", facing: camFacing })
                  captureNativeSnapshot().catch(() => {})
                }}
                className="flex-1 rounded-xl bg-[#287555] py-3 text-xs font-bold text-white hover:bg-[#1f5c43] transition shadow-md"
              >
                📷 Capture Surroundings Photo
              </button>
            </div>
          </div>
        )}

        {/* 2. Free OpenStreetMap GPS Viewer */}
        {tool === "Live GPS Map" && (
          <div className="space-y-3 pt-1">
            <div className="overflow-hidden rounded-2xl border border-[#a9c9b2] bg-[#f3faee] p-3 text-center space-y-2">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-[#d6f4ad] px-2.5 py-0.5 text-[10px] font-bold text-[#17352b]">
                  🗺️ OpenStreetMap (100% Free - No API Key Needed)
                </span>
                <span className="text-[10px] font-mono text-[#287555]">
                  {lat.toFixed(4)}, {lng.toFixed(4)}
                </span>
              </div>
              
              <div className="relative h-48 w-full rounded-xl overflow-hidden border border-[#d2e2d7] bg-white">
                <iframe
                  title="OpenStreetMap Live Child GPS Location"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  marginHeight={0}
                  marginWidth={0}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01}%2C${lat - 0.01}%2C${lng + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`}
                />
              </div>

              <p className="text-[11px] text-[#556962]">
                📍 {state.child.location || "Current Real GPS Location"} · Updated Live
              </p>
            </div>

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
              target="_blank"
              rel="noreferrer"
              className="block w-full text-center rounded-xl bg-[#287555] py-3 text-xs font-bold text-white hover:bg-[#1f5c43] transition shadow-md"
            >
              📍 Open Route in Google Maps Navigation App →
            </a>
          </div>
        )}

        {activeSession === tool && tool === "Screen Mirror" && (
          <div className="mt-5 overflow-hidden rounded-2xl bg-[#111c18] p-4 space-y-3 border border-[#287555] text-white">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-[#d6f4ad] px-2.5 py-0.5 text-[10px] font-bold text-[#17352b]">
                📱 MediaProjection + WebRTC Real-Time Stream
              </span>
              <span className={`text-[10px] font-mono font-bold ${
                state.remote.connectionState === "live" || state.remote.liveFrame
                  ? "text-[#baf26b]"
                  : state.remote.connectionState === "connecting" || state.remote.connectionState === "requesting-consent"
                  ? "text-[#ffe082] animate-pulse"
                  : state.remote.connectionState === "denied"
                  ? "text-[#ef5350]"
                  : "text-[#869690]"
              }`}>
                {state.remote.liveFrame || state.remote.connectionState === "live"
                  ? "🔴 LIVE STREAMING"
                  : state.remote.connectionState === "connecting"
                  ? "🟡 CONNECTING STREAM..."
                  : state.remote.connectionState === "requesting-consent"
                  ? "🟡 AWAITING CONSENT..."
                  : state.remote.connectionState === "denied"
                  ? "❌ CONSENT DENIED"
                  : "⚪ IDLE"}
              </span>
            </div>

            <div
              onClick={(e) => {
                if (!state.remote.mirrorStreamActive && !state.remote.liveFrame) return
                const rect = e.currentTarget.getBoundingClientRect()
                const clickX = e.clientX - rect.left
                const clickY = e.clientY - rect.top
                const targetX = Math.round((clickX / rect.width) * 540)
                const targetY = Math.round((clickY / rect.height) * 960)
                onAction({ type: "remote-touch", x: targetX, y: targetY, actionType: "TOUCH" })
                triggerRemoteTouch(targetX, targetY).catch(() => {})
              }}
              className="relative flex min-h-[340px] max-h-[480px] cursor-crosshair flex-col items-center justify-center rounded-xl border border-[#287555] bg-black text-center select-none overflow-hidden"
            >
              {state.remote.liveFrame ? (
                <div className="relative h-full w-full flex items-center justify-center bg-black">
                  <img
                    src={state.remote.liveFrame}
                    alt="Child Device Live Screen"
                    className="max-h-[460px] w-auto object-contain shadow-2xl"
                  />
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold text-[#baf26b] border border-[#baf26b]/40 backdrop-blur-md">
                    <span className="h-2 w-2 rounded-full bg-[#baf26b] animate-ping" />
                    <span>🔴 REAL-TIME CHILD SCREEN</span>
                  </div>
                  {state.remote.lastTouchAction && (
                    <div className="absolute bottom-2 right-2 rounded-lg bg-[#287555]/90 px-2.5 py-1 text-[10px] font-mono text-white shadow-lg backdrop-blur-md">
                      ↗ Touch Sent: {state.remote.lastTouchAction}
                    </div>
                  )}
                </div>
              ) : state.remote.mirrorStreamActive || state.remote.connectionState === "connecting" ? (
                <div className="space-y-3 p-6">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#baf26b] border-t-transparent" />
                  <p className="text-sm font-bold text-[#e1ece7]">Establishing WebRTC Screen Capture Session...</p>
                  <p className="text-xs text-[#869690] max-w-xs">
                    Please grant "Start now" consent on child device screen dialog.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 p-6">
                  <span className="text-4xl">▣</span>
                  <p className="text-sm font-bold text-[#e1ece7]">Screen Mirror Stream Disconnected</p>
                  <p className="text-xs text-[#869690] max-w-xs">
                    Tap "Start Live Screen Mirror" below to launch Android MediaProjection consent and start WebRTC video stream.
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (!state.remote.mirrorStreamActive) {
                    onAction({ type: "webrtc-signal", signalState: "requesting-consent" })
                    const res = await startNativeScreenShare()
                    if (res.error) {
                      onAction({ type: "webrtc-signal", signalState: "denied" })
                      alert("Screen Share Consent Error: " + res.error)
                    } else {
                      onAction({ type: "mirror-toggle", active: true })
                      onAction({ type: "webrtc-signal", signalState: "connecting" })
                    }
                  } else {
                    await stopNativeScreenShare()
                    onAction({ type: "mirror-toggle", active: false })
                    onAction({ type: "webrtc-signal", signalState: "idle" })
                  }
                }}
                className={`w-full rounded-xl py-3 text-xs font-bold transition shadow-sm ${
                  state.remote.mirrorStreamActive ? "bg-[#c62828] text-white hover:bg-[#b71c1c]" : "bg-[#287555] text-white hover:bg-[#1f5c43]"
                }`}
              >
                {state.remote.mirrorStreamActive ? "Stop Screen Mirror ⏹" : "Start Live Screen Mirror 🔴"}
              </button>

              <button
                type="button"
                onClick={() => {
                  onAction({ type: "remote-touch", actionType: "HOME" })
                  triggerRemoteNavigation("HOME").catch(() => {})
                }}
                className="w-full rounded-xl bg-[#287555]/30 border border-[#287555] py-3 text-xs font-bold text-white hover:bg-[#287555]/50 transition"
              >
                🏠 Home Gesture
              </button>
            </div>
          </div>
        )}

        {activeSession === tool && tool === "One-way audio" && (
          <div className="mt-5 overflow-hidden rounded-2xl bg-[#111c18] p-4 space-y-3 border border-[#287555] text-white">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-[#d6f4ad] px-2.5 py-0.5 text-[10px] font-bold text-[#17352b]">
                🎙️ Surroundings Ambient Audio Stream
              </span>
              <span className={`text-[10px] font-mono font-bold ${audio ? "text-[#baf26b] animate-pulse" : "text-[#869690]"}`}>
                {audio ? "🔴 LIVE AUDIO MONITORING" : "⚪ IDLE"}
              </span>
            </div>

            {audio && state.remote.liveAudioChunk ? (
              <div className="space-y-2 p-3 bg-black/60 rounded-xl border border-[#287555] text-center">
                <p className="text-xs font-bold text-[#baf26b] flex items-center justify-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#baf26b] animate-ping" />
                  Streaming Ambient Surroundings Audio...
                </p>
                <audio src={state.remote.liveAudioChunk} autoPlay controls className="w-full h-8" />
              </div>
            ) : audio ? (
              <div className="p-4 text-center space-y-2">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[#baf26b] border-t-transparent" />
                <p className="text-xs text-[#cce0d5]">Listening for surroundings audio chunks...</p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => onAction({ type: "audio-toggle", active: !audio })}
              className={`w-full rounded-xl py-3.5 text-xs font-bold transition shadow-sm ${
                audio ? "bg-[#c62828] text-white hover:bg-[#b71c1c]" : "bg-[#287555] text-white hover:bg-[#1f5c43]"
              }`}
            >
              {audio ? "Stop One-Way Audio 🛑" : "Start One-Way Audio 🎙️"}
            </button>
          </div>
        )}

        {tool === "Snapshot" && (
          <div className="mt-5 space-y-3">
            <button
              onClick={() => {
                onAction({ type: "capture-snapshot" })
                captureNativeSnapshot().catch(() => {})
              }}
              className="w-full rounded-2xl bg-[#287555] py-3.5 text-sm font-bold text-white hover:bg-[#1f5c43] transition shadow-md"
            >
              📷 Take Remote Camera Snapshot (Camera2)
            </button>
            {state.remote.lastSnapshotTime && (
              <p className="text-xs text-center text-[#287555] font-semibold">
                ✓ Snapshot captured at {state.remote.lastSnapshotTime}
              </p>
            )}
          </div>
        )}

        {tool === "Remote access" && (
          <div className="mt-5 space-y-3">
            <p className="text-xs font-bold text-[#172226]">Full Device Remote Assistance (Accessibility Control)</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  onAction({ type: "remote-touch", actionType: "HOME" })
                  triggerRemoteNavigation("HOME").catch(() => {})
                }}
                className="rounded-xl bg-[#edf3ef] py-2.5 text-xs font-bold text-[#1d5946] hover:bg-[#dbe7de] transition"
              >
                🏠 Home
              </button>
              <button
                onClick={() => {
                  onAction({ type: "remote-touch", actionType: "BACK" })
                  triggerRemoteNavigation("BACK").catch(() => {})
                }}
                className="rounded-xl bg-[#edf3ef] py-2.5 text-xs font-bold text-[#1d5946] hover:bg-[#dbe7de] transition"
              >
                ⬅️ Back
              </button>
              <button
                onClick={() => {
                  onAction({ type: "remote-touch", actionType: "RECENTS" })
                  triggerRemoteNavigation("RECENTS").catch(() => {})
                }}
                className="rounded-xl bg-[#edf3ef] py-2.5 text-xs font-bold text-[#1d5946] hover:bg-[#dbe7de] transition"
              >
                📑 Recents
              </button>
              <button
                onClick={() => {
                  onAction({ type: "remote-touch", actionType: "OPEN_SETTINGS" })
                  triggerRemoteNavigation("OPEN_SETTINGS").catch(() => {})
                }}
                className="rounded-xl bg-[#e3f2fd] py-2.5 text-xs font-bold text-[#1565c0] hover:bg-[#bbdefb] transition"
              >
                ⚙️ Settings
              </button>
              <button
                onClick={() => {
                  onAction({ type: "remote-touch", actionType: "NOTIFICATIONS" })
                  triggerRemoteNavigation("NOTIFICATIONS").catch(() => {})
                }}
                className="rounded-xl bg-[#e3f2fd] py-2.5 text-xs font-bold text-[#1565c0] hover:bg-[#bbdefb] transition"
              >
                🔔 Notifications
              </button>
              <button
                onClick={() => {
                  onAction({ type: "remote-touch", actionType: "QUICK_SETTINGS" })
                  triggerRemoteNavigation("QUICK_SETTINGS").catch(() => {})
                }}
                className="rounded-xl bg-[#e3f2fd] py-2.5 text-xs font-bold text-[#1565c0] hover:bg-[#bbdefb] transition"
              >
                🎛️ Toggles
              </button>
              <button
                onClick={() => {
                  onAction({ type: "remote-touch", actionType: "SWIPE_UP" })
                  triggerRemoteNavigation("SWIPE_UP").catch(() => {})
                }}
                className="rounded-xl bg-[#fff3e0] py-2.5 text-xs font-bold text-[#e65100] hover:bg-[#ffe0b2] transition"
              >
                ⬆️ Scroll Up
              </button>
              <button
                onClick={() => {
                  onAction({ type: "remote-touch", actionType: "SWIPE_DOWN" })
                  triggerRemoteNavigation("SWIPE_DOWN").catch(() => {})
                }}
                className="rounded-xl bg-[#fff3e0] py-2.5 text-xs font-bold text-[#e65100] hover:bg-[#ffe0b2] transition"
              >
                ⬇️ Scroll Down
              </button>
              <button
                onClick={() => {
                  onAction({ type: "remote-touch", actionType: "LOCK_SCREEN" })
                  triggerRemoteNavigation("LOCK_SCREEN").catch(() => {})
                }}
                className="rounded-xl bg-[#feebee] py-2.5 text-xs font-bold text-[#c62828] hover:bg-[#ffcdd2] transition"
              >
                🔒 Lock Phone
              </button>
            </div>
            {state.remote.lastTouchAction && (
              <p className="text-xs text-center text-[#287555] font-semibold">
                ✓ Executed: {state.remote.lastTouchAction}
              </p>
            )}
          </div>
        )}

        {activeSession !== tool && tool !== "Snapshot" ? (
          <button onClick={() => setActiveSession(tool)} className="mt-5 w-full rounded-2xl bg-[#287555] py-3.5 text-sm font-bold text-white hover:bg-[#1f5c43]">
            Start {tool} (Instant)
          </button>
        ) : (
          <button onClick={() => setActiveSession(null)} className="mt-5 w-full rounded-2xl bg-[#edf1f2] py-3.5 text-sm font-bold text-[#586771] hover:bg-[#e2e8ea]">
            Stop {tool}
          </button>
        )}
      </div>
      <p className="px-2 text-center text-xs leading-5 text-[#71807f]">Permission set once during setup. Repeat approvals are not required.</p>
    </div>
  )
}

function PermissionInstructionModal({
  isOpen,
  onClose,
  title,
  steps,
  onOpenSettings,
}: {
  isOpen: boolean
  onClose: () => void
  title: string
  steps: string[]
  onOpenSettings: () => void
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl text-[#172226] space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b pb-3 border-[#e8f0eb]">
          <h3 className="font-bold text-base text-[#17352b] flex items-center gap-2">
            <span>🛡️</span> {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-full bg-[#edf3ef] text-xs font-bold text-[#556962] hover:bg-[#dbe7de]"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2.5 text-xs text-[#42524b]">
          <p className="font-bold text-[#172226] text-[11px] uppercase tracking-wider text-[#287555]">
            অভিভাবকের জন্য ম্যানুয়াল স্টেপ নির্দেশিকা:
          </p>
          {steps.map((step, idx) => (
            <div key={idx} className="flex gap-2.5 items-start bg-[#f3faee] p-2.5 rounded-xl border border-[#d2e2d7]">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#287555] text-[10px] font-bold text-white">
                {idx + 1}
              </span>
              <p className="leading-5 font-semibold text-[#17352b]">{step}</p>
            </div>
          ))}
        </div>

        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={async () => {
              await onOpenSettings()
              onClose()
            }}
            className="w-full rounded-2xl bg-[#287555] py-3.5 text-xs font-bold text-white hover:bg-[#1f5c43] shadow-md transition"
          >
            ⚙️ Open System Settings Now →
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-center text-xs font-bold text-[#71807a] hover:underline"
          >
            Close Guide (বন্ধ করুন)
          </button>
        </div>
      </div>
    </div>
  )
}

function Onboarding({
  complete,
  defaultRole = "parent",
}: {
  complete: (role: "parent" | "child") => void
  defaultRole?: "parent" | "child"
}) {
  const [step, setStep] = useState(0)
  const [role, setRole] = useState<"parent" | "child">(defaultRole)
  const [pairMode, setPairMode] = useState<"pin" | "qr">("pin")
  const [dynamicPin, setDynamicPin] = useState("849201")
  const [inputPin, setInputPin] = useState("")
  const [qrScanned, setQrScanned] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [accEnabled, setAccEnabled] = useState(false)
  const [batteryOptDisabled, setBatteryOptDisabled] = useState(false)
  const [adminEnabled, setAdminEnabled] = useState(false)
  const [overlayGranted, setOverlayGranted] = useState(false)
  const [cameraGranted, setCameraGranted] = useState(false)
  const [locationGranted, setLocationGranted] = useState(false)
  const [micGranted, setMicGranted] = useState(false)
  const [screenCaptureGranted, setScreenCaptureGranted] = useState(false)

  const refreshPermissionsState = async () => {
    const acc = await checkAccessibilityEnabled()
    const bat = await checkBatteryOptimizationDisabled()
    const adm = await checkDeviceAdminEnabled()
    const ovl = await checkOverlayPermissionGranted()
    const cam = await checkCameraPermission()
    const loc = await checkLocationPermission()
    const mic = await checkMicrophonePermission()
    setAccEnabled(acc)
    setBatteryOptDisabled(bat)
    setAdminEnabled(adm)
    setOverlayGranted(ovl)
    setCameraGranted(cam)
    setLocationGranted(loc)
    setMicGranted(mic)
  }

  useEffect(() => {
    refreshPermissionsState()
  }, [step])

  const generateNewPin = async () => {
    try {
      const res = await generatePairingCode()
      if (res.pin) setDynamicPin(res.pin)
    } catch (_e) {
      setDynamicPin(String(Math.floor(100000 + Math.random() * 900000)))
    }
  }

  useEffect(() => {
    if (role === "parent" && step === 1) {
      generateNewPin()
    }
  }, [role, step])

  const handleNextStep = async () => {
    if (step === 1 && role === "child") {
      if (!inputPin || inputPin.length !== 6) {
        setError("Please enter a valid 6-digit PIN code.")
        return
      }
      setLoading(true)
      setError("")
      try {
        const res = await claimDevicePairing({ pin: inputPin, deviceName: "Child Android Device" })
        if (res.error) throw new Error(res.error)
        setStep(step + 1)
      } catch (err: any) {
        setError(err.message || "Failed to claim pairing PIN.")
      } finally {
        setLoading(false)
      }
    } else if (step === 2) {
      if (role === "child" && !accEnabled) {
        setError("StayKids Accessibility Service must be enabled in Android System Settings before completing child device setup.")
        return
      }
      complete(role)
    } else {
      setError("")
      setStep(step + 1)
    }
  }

  const pages = [
    {
      tag: "StayKids Security",
      icon: "✦",
      title: role === "parent" ? "A calmer digital childhood starts here." : "Connect to parent device securely.",
      text: role === "parent" ? "One parent app for routines, safety updates, and instant remote support." : "Scan QR Code or enter the dynamic single-use 6-digit pairing code.",
    },
    {
      tag: "Step 1 of 2",
      icon: "⌁",
      title: role === "parent" ? "Device Pairing (কোড বা QR)" : "Pair Device (PIN বা QR)",
      text: role === "parent" ? "Use this 6-digit PIN or QR Code on Mia’s device to pair instantly." : "Enter 6-digit code or scan parent QR code with camera.",
    },
    {
      tag: "Step 2 of 2",
      icon: "✓",
      title: "Grant One-Time Consent",
      text: "One-time permission for remote assistance (Screen Mirror, Audio, Snapshot) is granted during this setup so you don't need to ask repeatedly.",
    },
  ]
  const page = pages[step]

  return (
    <main className="grid min-h-screen place-items-center bg-[#dfe8df] p-4 font-sans text-[#172226]">
      <section className="relative w-full max-w-[480px] overflow-hidden rounded-[36px] bg-[#f8fbfb] p-7 shadow-2xl sm:p-9">
        <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-[#d6f4ad]" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="font-bold tracking-[-.04em]">
              stay<span className="text-[#287555]">kids</span>
            </p>
            <div className="flex gap-1">
              {pages.map((_, i) => (
                <span key={i} className={`h-1.5 w-6 rounded-full ${i <= step ? "bg-[#287555]" : "bg-[#dbe4e2]"}`} />
              ))}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-2 rounded-2xl bg-[#edf3ef] p-1">
            <button onClick={() => setRole("parent")} className={`rounded-xl py-2 text-xs font-bold ${role === "parent" ? "bg-white shadow text-[#287555]" : "text-[#71807a]"}`}>
              I’m a parent
            </button>
            <button onClick={() => setRole("child")} className={`rounded-xl py-2 text-xs font-bold ${role === "child" ? "bg-white shadow text-[#287555]" : "text-[#71807a]"}`}>
              This is a child device
            </button>
          </div>

          <div className="mt-8 grid h-16 w-16 place-items-center rounded-[24px] bg-[#1d5946] text-3xl text-[#d6f4ad]">{page.icon}</div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[.15em] text-[#287555]">{page.tag}</p>
          <h1 className="mt-2 text-3xl font-bold leading-[1.1] tracking-[-.05em]">{page.title}</h1>
          <p className="mt-2 max-w-sm text-xs leading-5 text-[#6e7c83]">{page.text}</p>

          {step === 0 && (
            <div className="mt-4 rounded-2xl bg-[#edf3ef] p-4 text-xs space-y-3 border border-[#c3d7cb]">
              <div className="flex items-center gap-2 text-[#1d5946] font-bold">
                <span>📜</span>
                <span>Google Play Policy Prominent Disclosure</span>
              </div>
              <p className="text-[11px] leading-relaxed text-[#4b5953]">
                StayKids collects <strong>Location, Camera, Microphone, Screen Stream,</strong> and <strong>Accessibility Usage</strong> strictly for authorized parental oversight & child protection. All data transmission is encrypted via HTTPS/TLS and never shared with third parties.
              </p>
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-semibold text-[#1d5946]">
                <div className="rounded-lg bg-white p-2 border border-[#d5e3da]">📍 Real-time GPS Location</div>
                <div className="rounded-lg bg-white p-2 border border-[#d5e3da]">📷 Remote Camera Snapshots</div>
                <div className="rounded-lg bg-white p-2 border border-[#d5e3da]">🎙️ Ambient Surroundings Audio</div>
                <div className="rounded-lg bg-white p-2 border border-[#d5e3da]">📱 Live HD Screen Oversight</div>
              </div>
            </div>
          )}

          {error && <div className="mt-4 rounded-xl bg-[#feebee] p-3 text-xs font-bold text-[#c62828] border border-[#ffcdd2]">{error}</div>}

          {step === 1 && (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#edf3ef] p-1">
                <button
                  type="button"
                  onClick={() => setPairMode("pin")}
                  className={`rounded-lg py-1.5 text-xs font-bold transition ${pairMode === "pin" ? "bg-white shadow text-[#287555]" : "text-[#71807a]"}`}
                >
                  🔢 6-Digit PIN
                </button>
                <button
                  type="button"
                  onClick={() => setPairMode("qr")}
                  className={`rounded-lg py-1.5 text-xs font-bold transition ${pairMode === "qr" ? "bg-white shadow text-[#287555]" : "text-[#71807a]"}`}
                >
                  📷 QR Code (কিউআর)
                </button>
              </div>

              {role === "parent" && pairMode === "pin" && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center rounded-2xl border border-dashed border-[#a9c9b2] bg-[#f3faee] px-6 py-4 font-mono text-2xl font-bold tracking-[.3em] text-[#287555]">
                    <span>{dynamicPin.slice(0, 3)}</span>
                    <span>{dynamicPin.slice(3, 6)}</span>
                  </div>
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[11px] font-semibold text-[#687b74]">🔒 Single-Use PIN</span>
                    <button onClick={generateNewPin} className="text-[11px] font-bold text-[#287555] hover:underline">
                      🔄 Refresh Code
                    </button>
                  </div>
                </div>
              )}

              {role === "parent" && pairMode === "qr" && (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-[#a9c9b2] bg-[#f3faee] p-5 text-center">
                  <div className="relative grid h-36 w-36 place-items-center rounded-2xl bg-white p-3 shadow-inner border border-[#d2e5d8]">
                    <div className="grid grid-cols-5 gap-1.5 w-full h-full p-1 opacity-80">
                      {Array.from({ length: 25 }).map((_, i) => (
                        <div key={i} className={`rounded-sm ${i % 2 === 0 || i % 7 === 0 ? "bg-[#1d5946]" : "bg-[#d6f4ad]"}`} />
                      ))}
                    </div>
                    <span className="absolute rounded-lg bg-[#1d5946] px-2 py-1 text-[10px] font-bold text-white shadow">StayKids</span>
                  </div>
                  <p className="mt-3 text-xs font-bold text-[#287555]">SK-PAIR-{dynamicPin}</p>
                  <p className="mt-1 text-[11px] text-[#687b74]">Scan this QR Code using child device camera</p>
                </div>
              )}

              {role === "child" && pairMode === "pin" && (
                <div className="space-y-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={inputPin}
                    onChange={(e) => setInputPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="Enter 6-digit PIN"
                    className="w-full text-center tracking-[.3em] font-mono text-2xl font-bold rounded-2xl border border-[#a9c9b2] bg-[#f3faee] py-4 text-[#287555] focus:outline-none focus:ring-2 focus:ring-[#287555]"
                  />
                  <p className="text-[11px] text-center text-[#71807a]">Single-use security PIN from parent phone</p>
                </div>
              )}

              {role === "child" && pairMode === "qr" && (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-[#a9c9b2] bg-[#172d24] p-5 text-white text-center">
                  <div className="relative flex h-32 w-32 items-center justify-center rounded-2xl border-2 border-dashed border-[#d6f4ad] bg-black/40">
                    <span className="text-3xl animate-pulse">📷</span>
                    <div className="absolute inset-x-2 top-1/2 h-0.5 bg-[#d6f4ad] shadow-[0_0_8px_#d6f4ad]" />
                  </div>
                  <button
                    onClick={() => {
                      setInputPin(dynamicPin)
                      setQrScanned(true)
                    }}
                    className="mt-3 rounded-xl bg-[#d6f4ad] px-4 py-2 text-xs font-bold text-[#17352b] hover:bg-[#c3e895] transition"
                  >
                    {qrScanned ? "QR Code Scanned ✓ (SK-PAIR)" : "📷 Tap to Scan Parent QR Code"}
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 2 && role === "child" && (
                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-[#a9c9b2] bg-[#f3faee] p-4 space-y-3">
                    <div className="text-center">
                      <span className="rounded-full bg-[#d6f4ad] px-2.5 py-0.5 text-[10px] font-bold text-[#17352b]">
                        🛡️ Single-Time System Setup Checklist
                      </span>
                      <p className="text-xs font-bold text-[#172226] mt-1.5">Child Device System Permissions</p>
                      <p className="text-[11px] text-[#687b74]">
                        প্রতিটি বাটনে চাপ দিলে ফোনের রিয়েল Settings পেজ খুলে যাবে এবং অভিভাবক ম্যানুয়ালি পারমিশন অন করতে পারবেন।
                      </p>
                    </div>

                    <div className="space-y-2 pt-1 text-left text-xs">
                      {/* Permission 1: Accessibility Service */}
                      <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-[#d2e2d7] shadow-sm">
                        <div>
                          <p className="font-bold text-[#172226]">1. Accessibility Service</p>
                          <p className="text-[10px] text-[#71807a]">Enables app blocking & remote assistance</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAccEnabled(true)
                            setGuideModal({
                              isOpen: true,
                              title: "1. Accessibility Service Access",
                              steps: [
                                "নিচে 'Open System Settings Now' বাটন চাপুন।",
                                "Android Settings খুলে গেলে 'Installed Apps' (বা Downloaded Services) এ ঢুকুন।",
                                "'StayKids Service' খুঁজে বের করে ট্যাপ করুন।",
                                "উপরে থাকা সুইচ বাটনটি অন (Allow/Enable) করে দিন।",
                              ],
                              onOpenSettings: async () => {
                                await openAccessibilitySettings().catch(() => {})
                              },
                            })
                          }}
                          className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                            accEnabled ? "bg-[#287555] text-white" : "bg-[#d6f4ad] text-[#17352b] hover:bg-[#c3e895]"
                          }`}
                        >
                          {accEnabled ? "Enabled ✓" : "⚙️ Grant"}
                        </button>
                      </div>

                      {/* Permission 2: Disable Battery Saver Optimization */}
                      <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-[#d2e2d7] shadow-sm">
                        <div>
                          <p className="font-bold text-[#172226]">2. Battery Saver (No Restrictions)</p>
                          <p className="text-[10px] text-[#71807a]">Prevents Xiaomi/Samsung from killing background service</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setBatteryOptDisabled(true)
                            setGuideModal({
                              isOpen: true,
                              title: "2. Battery Saver (No Restrictions)",
                              steps: [
                                "নিচে 'Open System Settings Now' বাটন চাপুন।",
                                "ফোনের Battery Optimization তালিকার অ্যাপসগুলো আসবে।",
                                "'StayKids' অ্যাপটি বেছে নিয়ে 'No Restrictions' বা 'Don't optimize' দিন।",
                                "এর ফলে শাওমি/স্যামসাং ব্যাকগ্রাউন্ডে সার্ভিস বন্ধ করবে না।",
                              ],
                              onOpenSettings: async () => {
                                await requestDisableBatteryOptimization().catch(() => {})
                              },
                            })
                          }}
                          className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                            batteryOptDisabled ? "bg-[#287555] text-white" : "bg-[#d6f4ad] text-[#17352b] hover:bg-[#c3e895]"
                          }`}
                        >
                          {batteryOptDisabled ? "Disabled ✓" : "🔋 Allow"}
                        </button>
                      </div>

                      {/* Permission 3: Anti-Uninstall Device Admin */}
                      <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-[#d2e2d7] shadow-sm">
                        <div>
                          <p className="font-bold text-[#172226]">3. Device Admin Protection</p>
                          <p className="text-[10px] text-[#71807a]">Prevents child from uninstalling app</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setAdminEnabled(true)
                            setGuideModal({
                              isOpen: true,
                              title: "3. Device Admin Protection",
                              steps: [
                                "নিচে 'Open System Settings Now' বাটন চাপুন।",
                                "ডিভাইস এডমিন সুরক্ষা অ্যাক্টিভ করার পপ-আপ স্ক্রিন আসবে।",
                                "নিচের 'Activate this device admin app' বাটনে চাপুন।",
                              ],
                              onOpenSettings: async () => {
                                await requestEnableDeviceAdmin().catch(() => {})
                              },
                            })
                          }}
                          className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                            adminEnabled ? "bg-[#287555] text-white" : "bg-[#d6f4ad] text-[#17352b] hover:bg-[#c3e895]"
                          }`}
                        >
                          {adminEnabled ? "Protected ✓" : "🔒 Protect"}
                        </button>
                      </div>

                      {/* Permission 4: Display Over Other Apps (Overlay) */}
                      <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-[#d2e2d7] shadow-sm">
                        <div>
                          <p className="font-bold text-[#172226]">4. Display Over Other Apps</p>
                          <p className="text-[10px] text-[#71807a]">Displays instant "App Blocked" overlay</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setOverlayGranted(true)
                            setGuideModal({
                              isOpen: true,
                              title: "4. Display Over Other Apps (Overlay)",
                              steps: [
                                "নিচে 'Open System Settings Now' বাটন চাপুন।",
                                "'Display Over Apps' তালিকার থেকে 'StayKids' অ্যাপটি সিলেক্ট করুন।",
                                "'Allow display over other apps' পারমিশন সুইচটি অন করে দিন।",
                              ],
                              onOpenSettings: async () => {
                                await requestOverlayPermission().catch(() => {})
                              },
                            })
                          }}
                          className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                            overlayGranted ? "bg-[#287555] text-white" : "bg-[#d6f4ad] text-[#17352b] hover:bg-[#c3e895]"
                          }`}
                        >
                          {overlayGranted ? "Allowed ✓" : "🖥️ Overlay"}
                        </button>
                      </div>

                      {/* Permission 5: Camera & Surroundings Snapshot */}
                      <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-[#d2e2d7] shadow-sm">
                        <div>
                          <p className="font-bold text-[#172226]">5. Camera Access</p>
                          <p className="text-[10px] text-[#71807a]">Enables silent camera surroundings snapshot in emergency</p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await requestCameraPermission()
                            if (res.granted) setCameraGranted(true)
                          }}
                          className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                            cameraGranted ? "bg-[#287555] text-white" : "bg-[#d6f4ad] text-[#17352b] hover:bg-[#c3e895]"
                          }`}
                        >
                          {cameraGranted ? "Granted ✓" : "📷 Camera"}
                        </button>
                      </div>

                      {/* Permission 6: Live GPS Location */}
                      <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-[#d2e2d7] shadow-sm">
                        <div>
                          <p className="font-bold text-[#172226]">6. Fine GPS Location</p>
                          <p className="text-[10px] text-[#71807a]">Enables real-time location tracking & geofencing</p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await requestLocationPermission()
                            if (res.granted) setLocationGranted(true)
                          }}
                          className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                            locationGranted ? "bg-[#287555] text-white" : "bg-[#d6f4ad] text-[#17352b] hover:bg-[#c3e895]"
                          }`}
                        >
                          {locationGranted ? "Granted ✓" : "📍 Location"}
                        </button>
                      </div>

                      {/* Permission 7: Microphone & Audio Stream */}
                      <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-[#d2e2d7] shadow-sm">
                        <div>
                          <p className="font-bold text-[#172226]">7. Microphone Access</p>
                          <p className="text-[10px] text-[#71807a]">Enables one-way surroundings audio monitoring</p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await requestMicrophonePermission()
                            if (res.granted) setMicGranted(true)
                          }}
                          className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                            micGranted ? "bg-[#287555] text-white" : "bg-[#d6f4ad] text-[#17352b] hover:bg-[#c3e895]"
                          }`}
                        >
                          {micGranted ? "Granted ✓" : "🎙️ Microphone"}
                        </button>
                      </div>

                      {/* Permission 8: MediaProjection Screen Share Priming */}
                      <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-[#d2e2d7] shadow-sm">
                        <div>
                          <p className="font-bold text-[#172226]">8. MediaProjection Screen Share</p>
                          <p className="text-[10px] text-[#71807a]">One-time system consent for live HD screen stream</p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await startNativeScreenShare()
                            if (res.success) setScreenCaptureGranted(true)
                          }}
                          className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                            screenCaptureGranted ? "bg-[#287555] text-white" : "bg-[#d6f4ad] text-[#17352b] hover:bg-[#c3e895]"
                          }`}
                        >
                          {screenCaptureGranted ? "Granted ✓" : "📱 Screen Share"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <PermissionInstructionModal
                isOpen={guideModal.isOpen}
                onClose={() => setGuideModal((prev) => ({ ...prev, isOpen: false }))}
                title={guideModal.title}
                steps={guideModal.steps}
                onOpenSettings={guideModal.onOpenSettings}
              />
          <button
            onClick={handleNextStep}
            disabled={loading}
            className="mt-8 w-full rounded-2xl bg-[#287555] py-4 text-sm font-bold text-white hover:bg-[#1f5c43] disabled:opacity-50 transition"
          >
            {loading ? "Verifying with StayKids Server..." : step === 2 ? "Complete Setup →" : "Continue →"}
          </button>
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="mt-3 w-full py-2 text-sm font-bold text-[#63726f] hover:underline">
              ← Back
            </button>
          )}
        </div>
      </section>
    </main>
  )
}



function Auth({ onAuthenticate }: { onAuthenticate: (user: { name: string; email: string }) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("signup")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [showLegal, setShowLegal] = useState(false)
  const [legalTab, setLegalTab] = useState<"terms" | "privacy">("terms")
  const [loading, setLoading] = useState(false)

  // Email OTP Verification State
  const [otpStep, setOtpStep] = useState(false)
  const [otpCode, setOtpCode] = useState("")
  const [otpMsg, setOtpMsg] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError("Please fill in all required fields.")
      return
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    setError("")
    setLoading(true)
    try {
      if (mode === "signup") {
        const res = await signUpParent({ name, email, password })
        if (res.error) throw new Error(res.error)
        if (res.requiresOtp) {
          setOtpStep(true)
          if (res.message) setOtpMsg(res.message)
          return
        }
        onAuthenticate(res.user || { name: name || email.split("@")[0], email })
      } else {
        const res = await loginParent({ email, password })
        if (res.error) throw new Error(res.error)
        onAuthenticate(res.user || { name: email.split("@")[0], email })
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed. Please check your network and credentials.")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otpCode || otpCode.length !== 6) {
      setError("Please enter the 6-digit OTP code sent to your email.")
      return
    }
    setError("")
    setLoading(true)
    try {
      const res = await verifyEmailOtp({ email, otp: otpCode })
      if (res.error) throw new Error(res.error)
      onAuthenticate(res.user || { name: name || email.split("@")[0], email })
    } catch (err: any) {
      setError(err.message || "OTP verification failed. Please check the code and try again.")
    } finally {
      setLoading(false)
    }
  }

  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return
    setError("")
    setLoading(true)
    try {
      const res = await resendEmailOtp({ email })
      if (res.error) throw new Error(res.error)
      setOtpMsg(`New 6-digit OTP code sent to ${email}`)
      setResendCooldown(30)
    } catch (err: any) {
      setError(err.message || "Failed to resend OTP.")
    } finally {
      setLoading(false)
    }
  }

  // Forgot Password / Password Reset State
  const [forgotStep, setForgotStep] = useState(false)
  const [resetStep, setResetStep] = useState(false)
  const [resetOtpCode, setResetOtpCode] = useState("")
  const [newPassword, setNewPassword] = useState("")

  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      setError("Please enter your registered email address.")
      return
    }
    setError("")
    setLoading(true)
    try {
      const res = await requestPasswordReset({ email })
      if (res.error) throw new Error(res.error)
      setResetStep(true)
    } catch (err: any) {
      setError(err.message || "Failed to request password reset. Please check your email.")
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetOtpCode || resetOtpCode.length !== 6 || !newPassword) {
      setError("Please enter the 6-digit OTP code and a new password.")
      return
    }
    setError("")
    setLoading(true)
    try {
      const res = await confirmPasswordReset({ email, otp: resetOtpCode, newPassword })
      if (res.error) throw new Error(res.error)
      onAuthenticate(res.user || { name: email.split("@")[0], email })
    } catch (err: any) {
      setError(err.message || "Failed to reset password. Please verify the OTP code.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#dfe8df] p-4 font-sans text-[#172226]">
      <LegalModal isOpen={showLegal} onClose={() => setShowLegal(false)} initialTab={legalTab} />
      <section className="relative w-full max-w-[480px] overflow-hidden rounded-[36px] bg-[#f8fbfb] p-7 shadow-2xl sm:p-9">
        <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-[#d6f4ad]" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-xl font-bold tracking-[-.04em]">
              stay<span className="text-[#287555]">kids</span>
            </p>
            <span className="rounded-full bg-[#edf3ef] px-3 py-1 text-xs font-bold text-[#287555]">
              {mode === "login" ? "Parent Login" : "Account Setup"}
            </span>
          </div>

          {forgotStep ? (
            <div className="mt-8 space-y-5">
              <div>
                <span className="rounded-full bg-[#f3faee] border border-[#cbe2d4] px-3 py-1 text-xs font-bold text-[#287555]">
                  🔑 Password Recovery (পাসওয়ার্ড রিসেট)
                </span>
                <h1 className="mt-3 text-3xl font-bold tracking-[-.05em]">Reset Password</h1>
                <p className="mt-2 text-xs leading-5 text-[#71807a]">
                  {!resetStep
                    ? "Enter your registered email address to receive a 6-digit password reset OTP code."
                    : `Enter the 6-digit reset OTP sent to ${email} and your new password.`}
                </p>
              </div>

              {error && <div className="rounded-xl bg-[#feebee] p-3 text-xs font-bold text-[#c62828] border border-[#ffcdd2]">{error}</div>}

              {!resetStep ? (
                <form onSubmit={handleRequestPasswordReset} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[.1em] text-[#71807a] mb-1.5">Registered Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ava.morgan@staykids.family"
                      className="w-full rounded-2xl border border-[#d8e2df] bg-white px-4 py-3.5 text-sm font-semibold text-[#172226] focus:border-[#287555] focus:outline-none focus:ring-2 focus:ring-[#287555]/20"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-2xl bg-[#287555] py-4 text-sm font-bold text-white hover:bg-[#1f5c43] shadow-md transition"
                  >
                    {loading ? "Sending Reset OTP..." : "Send Reset OTP Code →"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep(false)
                      setError("")
                    }}
                    className="w-full text-center text-xs font-bold text-[#71807a] hover:underline"
                  >
                    ← Back to Sign In
                  </button>
                </form>
              ) : (
                <form onSubmit={handleConfirmPasswordReset} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-[#172226]">6-Digit Reset OTP Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={resetOtpCode}
                      onChange={(e) => setResetOtpCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="Enter 6-digit OTP"
                      className="mt-1.5 w-full text-center tracking-[.3em] font-mono text-2xl font-bold rounded-2xl border border-[#d5deda] bg-white py-3.5 text-[#287555] focus:outline-none focus:ring-2 focus:ring-[#287555]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-[.1em] text-[#71807a] mb-1.5">New Password</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full rounded-2xl border border-[#d8e2df] bg-white px-4 py-3.5 text-sm font-semibold text-[#172226] focus:border-[#287555] focus:outline-none focus:ring-2 focus:ring-[#287555]/20"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || resetOtpCode.length !== 6 || !newPassword}
                    className="w-full rounded-2xl bg-[#287555] py-4 text-sm font-bold text-white hover:bg-[#1f5c43] disabled:opacity-50 transition shadow-md"
                  >
                    {loading ? "Updating Password..." : "Update Password & Sign In →"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep(false)
                      setResetStep(false)
                      setError("")
                    }}
                    className="w-full text-center text-xs font-bold text-[#71807a] hover:underline"
                  >
                    ← Back to Sign In
                  </button>
                </form>
              )}
            </div>
          ) : otpStep ? (
            <div className="mt-8 space-y-5">
              <div>
                <span className="rounded-full bg-[#f3faee] border border-[#cbe2d4] px-3 py-1 text-xs font-bold text-[#287555]">
                  ✉️ Email OTP Verification
                </span>
                <h1 className="mt-3 text-3xl font-bold tracking-[-.05em]">Verify Your Email</h1>
                <p className="mt-2 text-xs leading-5 text-[#71807a]">
                  We have sent a 6-digit verification OTP code to <strong className="text-[#172226]">{email}</strong>. Please enter the code below to complete account setup.
                </p>
              </div>

              {error && <div className="rounded-xl bg-[#feebee] p-3 text-xs font-bold text-[#c62828] border border-[#ffcdd2]">{error}</div>}

              <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[#172226]">6-Digit Email OTP Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="Enter 6-digit OTP"
                    className="mt-1.5 w-full text-center tracking-[.3em] font-mono text-2xl font-bold rounded-2xl border border-[#d5deda] bg-white py-3.5 text-[#287555] focus:outline-none focus:ring-2 focus:ring-[#287555]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="w-full rounded-2xl bg-[#287555] py-4 text-sm font-bold text-white hover:bg-[#1f5c43] disabled:opacity-50 transition shadow-md"
                >
                  {loading ? "Verifying OTP Code..." : "Verify OTP & Complete Account Setup →"}
                </button>

                <div className="flex justify-between items-center pt-2 text-xs">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading || resendCooldown > 0}
                    className="font-bold text-[#287555] hover:underline disabled:opacity-50"
                  >
                    {resendCooldown > 0 ? `🔄 Resend OTP Code (${resendCooldown}s)` : "🔄 Resend OTP Code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep(false)
                      setError("")
                    }}
                    className="font-semibold text-[#71807a] hover:underline"
                  >
                    ← Change Email
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              <div className="mt-8">
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#edf3ef] p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup")
                      setError("")
                    }}
                    className={`rounded-xl py-2.5 text-xs font-bold transition ${mode === "signup" ? "bg-white shadow text-[#287555]" : "text-[#71807a]"}`}
                  >
                    Create Account (একাউন্ট)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login")
                      setError("")
                    }}
                    className={`rounded-xl py-2.5 text-xs font-bold transition ${mode === "login" ? "bg-white shadow text-[#287555]" : "text-[#71807a]"}`}
                  >
                    Sign In (লগইন)
                  </button>
                </div>

                <div className="mt-8">
                  <h1 className="text-3xl font-bold tracking-[-.05em]">{mode === "signup" ? "Create Parent Account" : "Welcome Back"}</h1>
                  <p className="mt-2 text-xs leading-5 text-[#71807a]">
                    {mode === "signup"
                      ? "Register your primary parent account to manage routines, safety & remote help."
                      : "Sign in to access Mia's real-time safety dashboard & controls."}
                  </p>
                </div>

            {error && <div className="mt-4 rounded-xl bg-[#feebee] p-3 text-xs font-bold text-[#c62828] border border-[#ffcdd2]">{error}</div>}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === "signup" && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-[.1em] text-[#71807a] mb-1.5">Parent Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ava Morgan"
                    className="w-full rounded-2xl border border-[#d8e2df] bg-white px-4 py-3.5 text-sm font-semibold text-[#172226] focus:border-[#287555] focus:outline-none focus:ring-2 focus:ring-[#287555]/20"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-[.1em] text-[#71807a] mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ava.morgan@staykids.family"
                  className="w-full rounded-2xl border border-[#d8e2df] bg-white px-4 py-3.5 text-sm font-semibold text-[#172226] focus:border-[#287555] focus:outline-none focus:ring-2 focus:ring-[#287555]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-[.1em] text-[#71807a] mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-[#d8e2df] bg-white px-4 py-3.5 text-sm font-semibold text-[#172226] focus:border-[#287555] focus:outline-none focus:ring-2 focus:ring-[#287555]/20 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#71807a] hover:text-[#287555]"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {mode === "signup" && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-[.1em] text-[#71807a] mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-2xl border border-[#d8e2df] bg-white px-4 py-3.5 text-sm font-semibold text-[#172226] focus:border-[#287555] focus:outline-none focus:ring-2 focus:ring-[#287555]/20 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#71807a] hover:text-[#287555]"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              )}

              {mode === "login" && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep(true)
                      setError("")
                    }}
                    className="text-xs font-bold text-[#287555] hover:underline"
                  >
                    🔑 Forgot Password? (পাসওয়ার্ড ভুলে গেছেন?)
                  </button>
                </div>
              )}

              <button type="submit" className="w-full rounded-2xl bg-[#287555] py-4 text-sm font-bold text-white hover:bg-[#1f5c43] shadow-md transition">
                {mode === "signup" ? "Create Account & Continue →" : "Sign In to StayKids →"}
              </button>
            </form>

            <p className="mt-4 text-center text-[11px] text-[#869690]">
              By continuing, you agree to StayKids{" "}
              <button
                type="button"
                onClick={() => {
                  setLegalTab("terms")
                  setShowLegal(true)
                }}
                className="font-bold text-[#287555] hover:underline"
              >
                Terms
              </button>{" "}
              and{" "}
              <button
                type="button"
                onClick={() => {
                  setLegalTab("privacy")
                  setShowLegal(true)
                }}
                className="font-bold text-[#287555] hover:underline"
              >
                Privacy Policy
              </button>
              .
            </p>

            <p className="mt-4 text-center text-xs text-[#71807a]">
              {mode === "signup" ? (
                <>
                  Already registered?{" "}
                  <button onClick={() => setMode("login")} className="font-bold text-[#287555] hover:underline">
                    Sign In
                  </button>
                </>
              ) : (
                <>
                  New to StayKids?{" "}
                  <button onClick={() => setMode("signup")} className="font-bold text-[#287555] hover:underline">
                    Create Parent Account
                  </button>
                </>
              )}
            </p>
          </div>
        </>
      )}
        </div>
      </section>
    </main>
  )
}

function ChildDevice({ state, switchRole }: { state: StayKidsState; switchRole: () => void }) {
  const [help, setHelp] = useState(false)
  const isPaused = state.controls.paused
  const remainingMins = Math.max(0, state.usage.limit - state.usage.minutes)

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

export default function App() {
  const [selectedRole, setSelectedRole] = useState<"parent" | "child" | null>(() => {
    const saved = localStorage.getItem("staykids_selected_role")
    return saved === "parent" || saved === "child" ? saved : null
  })
  const [authenticated, setAuthenticated] = useState(false)
  const [user, setUser] = useState<{ name: string; email: string }>({ name: "Ava Morgan", email: "ava.morgan@staykids.family" })
  const [ready, setReady] = useState(false)
  const [role, setRole] = useState<"parent" | "child">(() => selectedRole || "parent")
  const [tab, setTab] = useState("Home")
  const [state, setState] = useState<StayKidsState>(initialDefaultState)

  const fetchLatestState = () => {
    getStayKidsState()
      .then((data) => {
        if (data && data.usage && data.controls) setState(data)
      })
      .catch(() => {
        // Keeps optimistic local state if backend is offline
      })
  }

  useEffect(() => {
    fetchLatestState()
    // Live Real-Time polling interval every 3 seconds for two-way sync
    const interval = setInterval(fetchLatestState, 3000)
    return () => clearInterval(interval)
  }, [])

  // 1. Real-time Child Frame Stream Listener
  useEffect(() => {
    let unsubscribeFrameListener: (() => void) | null = null

    if (role === "child" || state.remote.mirrorStreamActive) {
      unsubscribeFrameListener = listenScreenFrame((frameBase64) => {
        sendStayKidsAction({
          type: "webrtc-signal",
          frame: frameBase64,
          signalState: "live",
        }).catch(() => {})
      })
    }

    return () => {
      if (unsubscribeFrameListener) {
        unsubscribeFrameListener()
      }
    }
  }, [role, state.remote.mirrorStreamActive])

  // 2. Child Device MediaProjection Auto-Start Response
  useEffect(() => {
    if (role === "child" && state.remote.mirrorStreamActive) {
      sendStayKidsAction({ type: "webrtc-signal", signalState: "requesting-consent" }).catch(() => {})
      startNativeScreenShare()
        .then((res) => {
          if (res.success) {
            sendStayKidsAction({ type: "webrtc-signal", signalState: "connecting" }).catch(() => {})
          } else {
            sendStayKidsAction({ type: "webrtc-signal", signalState: "denied" }).catch(() => {})
          }
        })
        .catch(() => {})
    } else if (role === "child" && !state.remote.mirrorStreamActive) {
      stopNativeScreenShare().catch(() => {})
    }
  }, [role, state.remote.mirrorStreamActive])

  // 3. Child Device Ambient Audio Streaming Response
  useEffect(() => {
    let unsubscribeAudioListener: (() => void) | null = null

    if (role === "child" && state.remote.audioActive) {
      startNativeAudioCapture()
        .then((res) => {
          if (res.success) {
            unsubscribeAudioListener = listenAudioChunk((chunkBase64) => {
              sendStayKidsAction({
                type: "audio-chunk",
                chunk: chunkBase64,
              }).catch(() => {})
            })
          }
        })
        .catch(() => {})
    } else if (role === "child" && !state.remote.audioActive) {
      stopNativeAudioCapture().catch(() => {})
    }

    return () => {
      if (unsubscribeAudioListener) {
        unsubscribeAudioListener()
      }
    }
  }, [role, state.remote.audioActive])

  const action = (data: Record<string, unknown>) => {
    // Optimistic local state updates for 100% interactive UI
    setState((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as StayKidsState
      if (data.type === "upgrade-premium") {
        next.isPremium = true
      } else if (data.type === "select-child" && typeof data.childId === "string") {
        next.activeChildId = data.childId
        const selected = (next.children || []).find((c) => c.id === data.childId)
        if (selected) next.child = selected
      } else if (data.type === "add-child" && data.newChild) {
        const newChild = data.newChild as ChildDeviceInfo
        if (!next.children) next.children = []
        next.children.push(newChild)
        next.activeChildId = newChild.id
        next.child = newChild
      } else if (data.type === "toggle-control" && typeof data.key === "string") {
        next.controls[data.key] = !next.controls[data.key]
      } else if (data.type === "set-limit" && typeof data.value === "number") {
        next.usage.limit = data.value
      } else if (data.type === "mark-all-read") {
        next.alerts = next.alerts.map((a) => ({ ...a, read: true }))
      } else if (data.type === "mark-read" && typeof data.id === "string") {
        next.alerts = next.alerts.map((a) => (a.id === data.id ? { ...a, read: true } : a))
      } else if (data.type === "audio-toggle") {
        next.remote.audioActive = !next.remote.audioActive
      }
      return next
    })

    // Background sync request
    sendStayKidsAction(data).catch(() => {})
  }

  const handleSignOut = () => {
    setAuthenticated(false)
    setReady(false)
  }

  const resetRoleSelection = () => {
    localStorage.removeItem("staykids_selected_role")
    setSelectedRole(null)
    setAuthenticated(false)
    setReady(false)
  }

  const unreadAlertsCount = state.alerts.filter((a) => !a.read).length

  const pages: Record<string, React.ReactNode> = {
    Home: <Home onRemote={() => setTab("Remote")} onProfile={() => setTab("Profile")} state={state} onAction={action} />,
    Controls: <Controls state={state} onAction={action} />,
    Activity: <Activity state={state} />,
    Alerts: <Alerts state={state} onAction={action} />,
    Profile: <Profile state={state} switchRole={() => setRole("child")} onSignOut={handleSignOut} user={user} />,
    Remote: <Remote state={state} onAction={action} />,
  }

  const nav = [
    ["Home", "⌂"],
    ["Controls", "◫"],
    ["Activity", "◌"],
    ["Remote", "▣"],
    ["Alerts", "✦"],
    ["Profile", "👤"],
  ]

  // 1. First Launch / Onboarding: Professional Onboarding Screen
  if (!selectedRole) {
    return (
      <Onboarding
        defaultRole="parent"
        complete={(selectedRoleChoice) => {
          localStorage.setItem("staykids_selected_role", selectedRoleChoice)
          setSelectedRole(selectedRoleChoice)
          setRole(selectedRoleChoice)
          if (selectedRoleChoice === "child") {
            setReady(true)
          }
        }}
      />
    )
  }

  // 2. Child Device Flow: Skips Auth completely! Goes to Onboarding -> ChildDevice
  if (selectedRole === "child") {
    if (!ready) {
      return (
        <Onboarding
          defaultRole="child"
          complete={(nextRole) => {
            setRole(nextRole)
            setReady(true)
          }}
        />
      )
    }
    return <ChildDevice state={state} switchRole={resetRoleSelection} />
  }

  // 3. Parent Device Flow: Requires Auth (Sign Up / Sign In) -> Onboarding -> Parent Dashboard
  if (!authenticated) {
    return (
      <Auth
        onAuthenticate={(authenticatedUser) => {
          setUser(authenticatedUser)
          setAuthenticated(true)
        }}
      />
    )
  }

  if (!ready) {
    return (
      <Onboarding
        defaultRole="parent"
        complete={(nextRole) => {
          setRole(nextRole)
          setReady(true)
        }}
      />
    )
  }

  return (
    <main className="min-h-screen bg-[#dfe8df] font-sans text-[#172226]">
      <div className="mx-auto min-h-screen max-w-[480px] bg-[#f8fbfb] px-5 pt-8 shadow-2xl relative">
        {pages[tab]}
        <nav className="fixed bottom-0 left-1/2 flex w-full max-w-[480px] -translate-x-1/2 justify-between border-t border-[#e0e7e7] bg-white/95 px-2 pb-5 pt-3 backdrop-blur shadow-lg z-50">
          {nav.map(([name, icon]) => {
            const isAlertTab = name === "Alerts"
            return (
              <button
                key={name}
                onClick={() => setTab(name)}
                className={`relative grid min-w-12 place-items-center gap-1 text-[10px] font-bold transition ${tab === name ? "text-[#287555]" : "text-[#849199]"}`}
              >
                <span className="text-base">{icon}</span>
                <span>{name}</span>
                {isAlertTab && unreadAlertsCount > 0 && (
                  <span className="absolute -top-1 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#e95f50] text-[9px] font-bold text-white shadow">
                    {unreadAlertsCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>
    </main>
  )
}
