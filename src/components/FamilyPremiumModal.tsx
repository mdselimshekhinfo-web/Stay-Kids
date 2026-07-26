import React, { useState } from "react"
import { PREMIUM_ENABLED } from "../lib/config"

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

  if (!PREMIUM_ENABLED || !isOpen) return null

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

        {/* Plan Cards */}
        <div className="space-y-2.5">
          <div
            onClick={() => setSelectedPlan("yearly")}
            className={`cursor-pointer rounded-2xl p-4 border transition flex justify-between items-center ${
              selectedPlan === "yearly" ? "border-[#287555] bg-[#f3faee] shadow-sm" : "border-[#e0e7e3] bg-white"
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-sm text-[#172226]">Yearly Family Plan</p>
                <span className="rounded-full bg-[#287555] px-2 py-0.5 text-[9px] font-bold text-white">SAVE 50%</span>
              </div>
              <p className="text-xs text-[#60736c] mt-0.5">Up to 5 Child Devices · Unlimited Mirror & Audio</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-[#17352b]">৳২,৪৯০</p>
              <p className="text-[10px] text-[#71827b]">/year</p>
            </div>
          </div>

          <div
            onClick={() => setSelectedPlan("monthly")}
            className={`cursor-pointer rounded-2xl p-4 border transition flex justify-between items-center ${
              selectedPlan === "monthly" ? "border-[#287555] bg-[#f3faee] shadow-sm" : "border-[#e0e7e3] bg-white"
            }`}
          >
            <div>
              <p className="font-bold text-sm text-[#172226]">Monthly Family Plan</p>
              <p className="text-xs text-[#60736c] mt-0.5">Up to 3 Child Devices · Full Features</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-[#17352b]">৳৩৯০</p>
              <p className="text-[10px] text-[#71827b]">/month</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full rounded-2xl bg-[#287555] py-3.5 text-sm font-bold text-white hover:bg-[#1f5c43] transition shadow-lg flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>👑 Unlock Family Multi-Child Mode</>
          )}
        </button>

        {/* VIP Promo Code Drawer */}
        <div className="border-t border-[#edf2ef] pt-3 text-center">
          {!showPromo ? (
            <button
              type="button"
              onClick={() => setShowPromo(true)}
              className="text-xs font-bold text-[#287555] hover:underline"
            >
              Have a VIP Promo Code / Voucher? (এখানে কোড দিন) →
            </button>
          ) : (
            <form onSubmit={handleRedeemPromo} className="space-y-2">
              <p className="text-xs font-bold text-[#172226]">Redeem VIP Access Code</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value)
                    setPromoErr("")
                  }}
                  placeholder="Enter Code (e.g. STAYKIDS_FREE_VIP)"
                  className="flex-1 rounded-xl border border-[#c4d6cc] px-3 py-2 text-xs font-mono font-bold uppercase text-[#172226] focus:outline-none focus:ring-2 focus:ring-[#287555]"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-[#17352b] px-4 py-2 text-xs font-bold text-white hover:bg-[#0f241d]"
                >
                  Apply
                </button>
              </div>
              {promoErr && <p className="text-[11px] text-[#c62828] font-semibold">{promoErr}</p>}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
