import { useState } from "react"
import { PREMIUM_ENABLED } from "../lib/config"

export function SubscriptionModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly")
  const [paymentMethod, setPaymentMethod] = useState<"gplay" | "bkash" | "nagad" | "card">("bkash")
  const [subscribed, setSubscribed] = useState(false)

  if (!PREMIUM_ENABLED || !isOpen) return null

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
            <div className="rounded-2xl border border-[#baf26b] bg-[#f4fbe9] p-3.5 space-y-1.5 shadow-sm">
              <p className="font-bold text-[#1e4d3b] text-xs uppercase tracking-wider">👑 Premium (৳৩৯০/মাস)</p>
              <ul className="space-y-1 text-[11px] text-[#287555] font-medium">
                <li>✓ Everything in Free</li>
                <li>✓ <strong>Live Camera Stream</strong></li>
                <li>✓ <strong>Live Screen Mirroring</strong></li>
                <li>✓ <strong>One-Way Ambient Audio</strong></li>
                <li>✓ <strong>Full Remote Navigation</strong></li>
                <li>✓ Silent Camera Snapshots</li>
              </ul>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2 pt-2 border-t border-[#e5ece8]">
            <p className="font-bold text-xs text-[#172226]">Select Payment Gateway (পেমেন্ট মাধ্যম)</p>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPaymentMethod("bkash")}
                className={`rounded-xl border p-2.5 text-center font-bold transition ${paymentMethod === "bkash" ? "border-[#e2136e] bg-[#fce4ec] text-[#c2185b]" : "border-[#e0e7e3] bg-white text-[#556660]"}`}
              >
                bKash
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("nagad")}
                className={`rounded-xl border p-2.5 text-center font-bold transition ${paymentMethod === "nagad" ? "border-[#f7941d] bg-[#fff3e0] text-[#e65100]" : "border-[#e0e7e3] bg-white text-[#556660]"}`}
              >
                Nagad
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("gplay")}
                className={`rounded-xl border p-2.5 text-center font-bold transition ${paymentMethod === "gplay" ? "border-[#4285f4] bg-[#e8f0fe] text-[#1a73e8]" : "border-[#e0e7e3] bg-white text-[#556660]"}`}
              >
                Google Play
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                className={`rounded-xl border p-2.5 text-center font-bold transition ${paymentMethod === "card" ? "border-[#287555] bg-[#f3faee] text-[#1e4d3b]" : "border-[#e0e7e3] bg-white text-[#556660]"}`}
              >
                Card / VISA
              </button>
            </div>
          </div>

          {/* Plan Duration Cards */}
          <div className="space-y-2">
            <div
              onClick={() => setSelectedPlan("yearly")}
              className={`cursor-pointer rounded-2xl p-3.5 border transition flex justify-between items-center ${
                selectedPlan === "yearly" ? "border-[#287555] bg-[#f3faee]" : "border-[#e0e7e3] bg-white"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-xs text-[#172226]">1 Year Full Premium Plan</p>
                  <span className="rounded-full bg-[#287555] px-2 py-0.5 text-[9px] font-bold text-white">SAVE 50%</span>
                </div>
                <p className="text-[11px] text-[#60736c]">৳২08 / month (Billed ৳২,৪৯০ yearly)</p>
              </div>
              <p className="font-bold text-sm text-[#17352b]">৳২,৪৯০</p>
            </div>

            <div
              onClick={() => setSelectedPlan("monthly")}
              className={`cursor-pointer rounded-2xl p-3.5 border transition flex justify-between items-center ${
                selectedPlan === "monthly" ? "border-[#287555] bg-[#f3faee]" : "border-[#e0e7e3] bg-white"
              }`}
            >
              <div>
                <p className="font-bold text-xs text-[#172226]">1 Month Premium Plan</p>
                <p className="text-[11px] text-[#60736c]">Billed monthly · Cancel anytime</p>
              </div>
              <p className="font-bold text-sm text-[#17352b]">৳৩৯০</p>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#e5ece8] space-y-2">
          {subscribed ? (
            <div className="rounded-xl bg-[#d5f2b0] p-3 text-center text-xs font-bold text-[#17352b]">
              🎉 Thank you! Your Premium Subscription has been activated.
            </div>
          ) : (
            <button
              onClick={() => setSubscribed(true)}
              className="w-full rounded-2xl bg-[#287555] py-3.5 text-sm font-bold text-white hover:bg-[#1f5c43] transition shadow-md"
            >
              Start 7-Day Free Trial (৳০ Today)
            </button>
          )}
          <p className="text-center text-[10px] text-[#83948e]">Secured by SSL Commerz & Google Play Billing. No commitment.</p>
        </div>
      </div>
    </div>
  )
}
