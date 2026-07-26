import React, { useState } from "react"

export function SubscriptionModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
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
