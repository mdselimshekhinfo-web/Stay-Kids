import React, { useState } from "react"

export function FamilyPremiumModal({
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
