import React, { useState } from "react"
import type { StayKidsState } from "../lib/staykids-api"
import { LegalModal } from "./LegalModal"
import { SubscriptionModal } from "./SubscriptionModal"

export function Profile({
  state,
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
