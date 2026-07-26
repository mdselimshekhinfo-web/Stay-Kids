import React, { useEffect, useState } from "react"
import {
  getStayKidsState,
  sendStayKidsAction,
  type StayKidsState,
  type ChildDeviceInfo,
} from "./lib/staykids-api"
import {
  startNativeScreenShare,
  stopNativeScreenShare,
  listenScreenFrame,
  startNativeAudioCapture,
  stopNativeAudioCapture,
  listenAudioChunk,
} from "./lib/native"
import { triggerToast } from "./components/Toast"

import { Auth } from "./components/Auth"
import { Onboarding } from "./components/Onboarding"
import { Home } from "./components/Home"
import { Controls } from "./components/Controls"
import { Activity } from "./components/Activity"
import { Alerts } from "./components/Alerts"
import { Profile } from "./components/Profile"
import { Remote } from "./components/Remote"
import { ChildDevice } from "./components/ChildDevice"

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
  const [isForeground, setIsForeground] = useState(true)

  const fetchLatestState = () => {
    getStayKidsState()
      .then((data) => {
        if (data && data.usage && data.controls) setState(data)
      })
      .catch((_e) => {
        // Keeps optimistic local state if backend is offline
      })
  }

  // 1. Adaptive Polling Interval (Foreground: 3s, Background: 30s unless active live stream)
  useEffect(() => {
    fetchLatestState()

    const handleVisibility = () => {
      setIsForeground(document.visibilityState === "visible")
    }
    document.addEventListener("visibilitychange", handleVisibility)

    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [])

  useEffect(() => {
    const isLiveActive = Boolean(state.remote.mirrorStreamActive || state.remote.audioActive)
    const pollIntervalMs = isForeground || isLiveActive ? 3000 : 30000

    const interval = setInterval(fetchLatestState, pollIntervalMs)
    return () => clearInterval(interval)
  }, [isForeground, state.remote.mirrorStreamActive, state.remote.audioActive])

  // 2. Real-time Child Frame Stream Listener
  useEffect(() => {
    let unsubscribeFrameListener: (() => void) | null = null

    if (role === "child" || state.remote.mirrorStreamActive) {
      unsubscribeFrameListener = listenScreenFrame((frameBase64) => {
        sendStayKidsAction({
          type: "webrtc-signal",
          frame: frameBase64,
          signalState: "live",
        }).catch((_e) => {
          // Frame upload transient network glitch
        })
      })
    }

    return () => {
      if (unsubscribeFrameListener) {
        unsubscribeFrameListener()
      }
    }
  }, [role, state.remote.mirrorStreamActive])

  // 3. Child Device MediaProjection Auto-Start Response
  useEffect(() => {
    if (role === "child" && state.remote.mirrorStreamActive) {
      sendStayKidsAction({ type: "webrtc-signal", signalState: "requesting-consent" }).catch(() => {})
      startNativeScreenShare()
        .then((res) => {
          if (res.success) {
            sendStayKidsAction({ type: "webrtc-signal", signalState: "connecting" }).catch(() => {})
          } else {
            sendStayKidsAction({ type: "webrtc-signal", signalState: "denied" }).catch(() => {})
            triggerToast("Screen Share permission not granted on child device", "warning")
          }
        })
        .catch((_err) => {
          triggerToast("Screen Share service failed to initialize", "error")
        })
    } else if (role === "child" && !state.remote.mirrorStreamActive) {
      stopNativeScreenShare().catch(() => {})
    }
  }, [role, state.remote.mirrorStreamActive])

  // 4. Child Device Ambient Audio Streaming Response
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
          } else {
            triggerToast("Microphone access failed for ambient audio", "warning")
          }
        })
        .catch((_err) => {
          triggerToast("Ambient audio service error", "error")
        })
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
    // Keep snapshot of previous state for rollback if server rejects
    const previousState = state

    // Optimistic local state updates for 100% responsive UI
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

    // Background sync request with user-facing toast on failure
    sendStayKidsAction(data).catch((err) => {
      setState(previousState) // Rollback optimistic change on network failure
      triggerToast(err.message || "Couldn't sync change — check connection", "error")
    })
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

  // 1. First Launch / Onboarding
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

  // 2. Child Device Flow
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

  // 3. Parent Device Flow
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
        activeChildId={state.activeChildId || state.child?.id || "child-1"}
        complete={(nextRole) => {
          setRole(nextRole)
          setReady(true)
        }}
      />
    )
  }

  return (
    <main className="min-h-screen bg-[#dfe8df] font-[#172226] font-sans">
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
