import React, { useEffect, useState } from "react"

export function LegalModal({
  isOpen,
  onClose,
  initialTab = "terms",
}: {
  isOpen: boolean
  onClose: () => void
  initialTab?: "terms" | "privacy"
}) {
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
