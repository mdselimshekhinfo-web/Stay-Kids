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
  handleNativeWebRTCSignal,
  listenWebRTCSignal,
  fetchAppRoleNative,
} from "./lib/native"
import { triggerToast } from "./components/Toast"
import { subscribeToChildUpdates, isRealtimeAvailable, type RealtimeUpdate } from './lib/realtime'

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
  isPremium: false,
  activeChildId: "child-1",
  child: {
    id: "child-1",
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
    mirrorStreamActive: false,
    liveFrame: null,
    connectionState: "idle",
    lastTouchAction: null,
    lastSnapshotTime: null,
    liveAudioChunk: null,
  } as any,
  blockedApps: {},
}

export default function App() {
  const [selectedRole, setSelectedRole] = useState<"parent" | "child" | null>(() => {
    const saved = localStorage.getItem("staykids_selected_role")
    return saved === "parent" || saved === "child" ? saved : null
  })
  const [authenticated, setAuthenticated] = useState<boolean>(false)
  const [user, setUser] = useState<{ name: string; email: string }>(() => {
    const savedName = localStorage.getItem("staykids_user_name") || ""
    const savedEmail = localStorage.getItem("staykids_user_email") || ""
    return { name: savedName, email: savedEmail }
  })
  const [ready, setReady] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(true)
  const [role, setRole] = useState<"parent" | "child">(() => selectedRole || "parent")
  const [tab, setTab] = useState("Home")
  const [state, setState] = useState<StayKidsState>(initialDefaultState)
  const [isForeground, setIsForeground] = useState(true)

  useEffect(() => {
    fetchAppRoleNative().then((nativeRole) => {
      if (nativeRole === "parent" || nativeRole === "child") {
        setSelectedRole(nativeRole as "parent" | "child")
        setRole(nativeRole as "parent" | "child")
        localStorage.setItem("staykids_selected_role", nativeRole)
      }
      
      import('./lib/staykids-api').then(({ loadAuthToken }) => {
        loadAuthToken().then((token) => {
          const currentRole = nativeRole || selectedRole
          if (currentRole === "child") {
            if (token) {
              setAuthenticated(true)
              setReady(true)
            } else {
              setAuthenticated(false)
              setReady(false)
            }
          } else {
            if (token) {
              setAuthenticated(true)
              setReady(true)
            }
          }
          setIsLoading(false)
        })
      })
    })

  }, [selectedRole])

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

  // Hybrid: Realtime subscriptions + fallback polling
  useEffect(() => {
    if (!authenticated || !ready) return

    const childIds = (state.children || [state.child]).map((c: any) => c?.id).filter(Boolean)
    let unsubscribeRealtime: (() => void) | null = null

    if (isRealtimeAvailable() && childIds.length > 0) {
      // Primary: Supabase Realtime WebSocket
      unsubscribeRealtime = subscribeToChildUpdates(childIds, (update: RealtimeUpdate) => {
        setState(prev => {
          const next = JSON.parse(JSON.stringify(prev)) as StayKidsState
          if (update.table === 'children' && update.new) {
            const row = update.new
            next.children = (next.children || []).map(c =>
              c.id === row.id ? { ...c, name: row.name, device: row.device_name, location: row.last_location, battery: row.battery_level, online: row.is_online, coordinates: { lat: row.latitude, lng: row.longitude } } : c
            )
            if (next.activeChildId === row.id) {
              next.child = { ...next.child, name: row.name, device: row.device_name, location: row.last_location, battery: row.battery_level, online: row.is_online, coordinates: { lat: row.latitude, lng: row.longitude } }
            }
          }
          if (update.table === 'alerts' && update.eventType === 'INSERT' && update.new) {
            const row = update.new
            const newAlert = { id: row.id, category: row.category || 'activity', title: row.title, detail: row.description || '', time: 'Just now', read: false }
            if (!next.alerts.some(a => a.id === row.id)) {
              next.alerts = [newAlert, ...next.alerts]
            }
          }
          if (update.table === 'device_controls' && update.new) {
            const row = update.new
            if (row.child_id === next.activeChildId) {
              next.controls = { ...next.controls, paused: row.is_paused, limits: row.limits_enabled, bedtime: row.bedtime_enabled, filter: row.web_filter_enabled }
              next.usage = { ...next.usage, limit: row.daily_limit_minutes || 120 }
            }
          }
          return next
        })
      })
    }

    // Fallback: Reduced polling (every 30s as safety net, or 3s if no realtime)
    const isLiveActive = Boolean(state.remote?.mirrorStreamActive || state.remote?.audioActive)
    const realtimeActive = isRealtimeAvailable() && childIds.length > 0
    const pollIntervalMs = realtimeActive
      ? (isLiveActive ? 5000 : 30000)  // With realtime: slow fallback only
      : (isForeground || isLiveActive ? 3000 : 30000)  // Without realtime: original polling

    const interval = setInterval(fetchLatestState, pollIntervalMs)

    return () => {
      clearInterval(interval)
      if (unsubscribeRealtime) unsubscribeRealtime()
    }
  }, [isForeground, authenticated, ready, state.children?.length, state.remote?.mirrorStreamActive, state.remote?.audioActive])

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

  // Fix 2: Child Device WebRTC Signal Bridge & Native Forwarding
  const forwardedOfferRef = React.useRef<string | null>(null)
  const forwardedCandidatesCountRef = React.useRef<number>(0)

  useEffect(() => {
    let unsubscribeWebRTCSignalListener: (() => void) | null = null

    if (role === "child") {
      // Forward native WebRTC signal events (answers & candidates) to backend
      unsubscribeWebRTCSignalListener = listenWebRTCSignal((signal) => {
        sendStayKidsAction({
          type: "webrtc-signal",
          ...signal,
        }).catch(() => {})
      })
    }

    return () => {
      if (unsubscribeWebRTCSignalListener) {
        unsubscribeWebRTCSignalListener()
      }
    }
  }, [role])

  // Part A: Native Geofence Alert Event Listener for Child Device
  useEffect(() => {
    let isMounted = true
    let unsubscribeGeofenceListener: (() => void) | null = null

    if (role === "child") {
      import("./lib/native").then(({ listenGeofenceAlert }) => {
        if (!isMounted) return
        unsubscribeGeofenceListener = listenGeofenceAlert((data) => {
          if (data) {
            sendStayKidsAction({
              type: "geofence-alert",
              transition: data.transition || "ENTER",
              geofenceId: data.geofenceId || "safe_zone_1",
            }).catch(() => {})
          }
        })
      })
    }

    return () => {
      isMounted = false
      if (unsubscribeGeofenceListener) {
        unsubscribeGeofenceListener()
      }
    }
  }, [role])

  // Priorities 2, 3, 4: Child Device Telemetry Sync (Installed Apps, Call/SMS Metadata, Web Visits)
  useEffect(() => {
    let isMounted = true
    let unsubscribeWebVisitListener: (() => void) | null = null

    if (role === "child") {
      import("./lib/native").then(({ fetchNativeInstalledApps, getCallSmsLogsNative, listenWebVisitAlert }) => {
        if (!isMounted) return
        // Sync Installed Apps
        fetchNativeInstalledApps().then((apps) => {
          if (isMounted && apps && apps.length > 0) {
            sendStayKidsAction({ type: "installed-apps-telemetry", apps }).catch(() => {})
          }
        }).catch(() => {})

        // Sync Call & SMS Metadata
        getCallSmsLogsNative().then((logs) => {
          if (isMounted && logs && logs.length > 0) {
            sendStayKidsAction({ type: "sync-call-sms-logs", logs }).catch(() => {})
          }
        }).catch(() => {})

        // Listen for Web Visit Events
        unsubscribeWebVisitListener = listenWebVisitAlert((data) => {
          if (data && data.url) {
            sendStayKidsAction({ type: "web-visit-telemetry", url: data.url }).catch(() => {})
          }
        })
      })
    }

    return () => {
      isMounted = false
      if (unsubscribeWebVisitListener) {
        unsubscribeWebVisitListener()
      }
    }
  }, [role])

  // Fix 1: Parent Role FCM Token Registration
  const lastFcmTokenRef = React.useRef<string | null>(null)
  useEffect(() => {
    if (role === "parent") {
      import("./lib/native").then(({ getFcmTokenNative }) => {
        getFcmTokenNative().then((token) => {
          if (token && token !== lastFcmTokenRef.current) {
            lastFcmTokenRef.current = token
            sendStayKidsAction({ type: "register-fcm-token", token }).catch(() => {})
          }
        }).catch(() => {})
      })
    }
  }, [role])

  useEffect(() => {
    if (role !== "child") return

    // Forward SDP Offer from backend state to native WebRTC manager
    if (state.remote.webrtcOffer && JSON.stringify(state.remote.webrtcOffer) !== forwardedOfferRef.current) {
      forwardedOfferRef.current = JSON.stringify(state.remote.webrtcOffer)
      handleNativeWebRTCSignal({ offer: state.remote.webrtcOffer }).catch(() => {})
    }

    // Forward ICE Candidates from backend state to native WebRTC manager
    if (state.remote.webrtcCandidates && Array.isArray(state.remote.webrtcCandidates)) {
      const candidates = state.remote.webrtcCandidates
      if (candidates.length > forwardedCandidatesCountRef.current) {
        const newCandidates = candidates.slice(forwardedCandidatesCountRef.current)
        forwardedCandidatesCountRef.current = candidates.length
        handleNativeWebRTCSignal({ candidates: newCandidates }).catch(() => {})
      }
    }

    if (!state.remote.mirrorStreamActive) {
      forwardedOfferRef.current = null
      forwardedCandidatesCountRef.current = 0
    }
  }, [role, state.remote.webrtcOffer, state.remote.webrtcCandidates, state.remote.mirrorStreamActive])

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
    let isMounted = true
    let unsubscribeAudioListener: (() => void) | null = null

    if (role === "child" && state.remote.audioActive) {
      startNativeAudioCapture()
        .then((res) => {
          if (!isMounted) return
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
      isMounted = false
      if (unsubscribeAudioListener) {
        unsubscribeAudioListener()
      }
    }
  }, [role, state.remote.audioActive])

  // 5. Child Device Anti-Theft Siren Response
  useEffect(() => {
    if (role === "child" && state.remote.alarmActive) {
      import("./lib/native").then(({ triggerSirenNative }) => {
        triggerSirenNative().catch(() => {})
      })
    } else if (role === "child" && !state.remote.alarmActive) {
      import("./lib/native").then(({ stopSirenNative }) => {
        if (stopSirenNative) stopSirenNative().catch(() => {})
      })
    }
  }, [role, state.remote.alarmActive])

  // 6. Child Device Bedtime Enforcement Response (Fix 1: Pass wakeTime to native scheduler)
  useEffect(() => {
    if (role === "child" && state.controls.bedtime && state.controls.bedtimeSchedule) {
      import("./lib/native").then(({ setBedtimeNative }) => {
        setBedtimeNative(state.controls.bedtimeSchedule!, state.controls.wakeTime || "07:00").catch(() => {})
      })
    }
  }, [role, state.controls.bedtime, state.controls.bedtimeSchedule, state.controls.wakeTime])

  // 7. Child Device Geofence Response
  useEffect(() => {
    if (role === "child" && state.controls.geofence) {
      if (state.child.coordinates) {
        import("./lib/native").then(({ addGeofenceNative }) => {
          addGeofenceNative(state.child.coordinates!.lat, state.child.coordinates!.lng, 500).catch(() => {})
        })
      }
    }
  }, [role, state.controls.geofence, state.child.coordinates])

  // 8. Child Device Web Filter Response
  useEffect(() => {
    if (role === "child") {
      import("./lib/native").then(({ syncWebFilter }) => {
        syncWebFilter(!!state.controls.filter).catch(() => {})
      })
    }
  }, [role, state.controls.filter])

  // 9. Child Device Daily Limit Response
  useEffect(() => {
    if (role === "child") {
      import("./lib/native").then(({ syncDailyLimit }) => {
        syncDailyLimit(state.usage.limit).catch(() => {})
      })
    }
  }, [role, state.usage.limit])

  // 10. Child Device Screen Resolution Telemetry Response
  useEffect(() => {
    if (role === "child") {
      import("./lib/native").then(({ getScreenResolutionNative }) => {
        getScreenResolutionNative().then((res) => {
          sendStayKidsAction({
            type: "device-telemetry",
            screenWidth: res.screenWidth,
            screenHeight: res.screenHeight,
          }).catch(() => {})
        })
      })
    }
  }, [role])

  const action = (data: Record<string, unknown>) => {
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
      } else if (data.type === "toggle-geofence") {
        next.controls.geofence = !next.controls.geofence
      } else if (data.type === "set-limit" && typeof data.value === "number") {
        next.usage.limit = data.value
      } else if (data.type === "set-app-limit" && typeof data.appName === "string" && typeof data.limit === "number") {
        if (!next.controls.appLimits) next.controls.appLimits = {}
        next.controls.appLimits[data.appName] = data.limit
      } else if (data.type === "set-bedtime" && typeof data.bedtime === "string") {
        next.controls.bedtimeSchedule = data.bedtime
        if (typeof data.wakeTime === "string") next.controls.wakeTime = data.wakeTime
      } else if (data.type === "mark-all-read") {
        next.alerts = next.alerts.map((a) => ({ ...a, read: true }))
      } else if (data.type === "mark-read" && typeof data.id === "string") {
        next.alerts = next.alerts.map((a) => (a.id === data.id ? { ...a, read: true } : a))
      } else if (data.type === "audio-toggle") {
        next.remote.audioActive = !next.remote.audioActive
      } else if (data.type === "toggle-app-lock") {
        const app = (data.appName || data.app) as string
        if (app) next.blockedApps = { ...(next.blockedApps || {}), [app]: !(next.blockedApps || {})[app] };
      } else if (data.type === "mirror-toggle") {
        next.remote = { ...next.remote, mirrorStreamActive: !!data.active, connectionState: data.active ? "connecting" : "idle" } as any;
      } else if (data.type === "capture-snapshot") {
        next.remote = { ...next.remote, lastSnapshotTime: Date.now() as any };
      } else if (data.type === "remote-touch") {
        next.remote = { ...next.remote, lastTouchAction: `${data.x},${data.y}` };
      } else if (data.type === "webrtc-signal") {
        if (data.frame) next.remote = { ...next.remote, liveFrame: data.frame as any };
      } else if (data.type === "trigger-alarm") {
        next.remote.alarmActive = !next.remote.alarmActive;
      } else if (data.type === "unpair-device" && typeof data.childId === "string") {
        next.children = (next.children || []).filter(c => c.id !== data.childId);
        if (next.activeChildId === data.childId && (next.children || []).length > 0) {
          next.child = next.children![0];
          next.activeChildId = next.children![0].id;
        }
      } else if (data.type === "update-school" && typeof data.school === "string") {
        next.child.school = data.school as string;
        if (next.children) {
          next.children = next.children.map((c) => c.id === next.activeChildId ? { ...c, school: data.school as string } : c);
        }
      } else if (data.type === "update-notification-prefs" && data.prefs) {
        (next as any).notificationPrefs = { ...((next as any).notificationPrefs || {}), ...(data.prefs as any) };
      } else if (data.type === "add-reward-points" && typeof data.points === "number") {
        next.rewards = next.rewards || { earned: 0, balance: 0 };
        next.rewards.earned += data.points;
        next.rewards.balance += data.points;
      } else if (data.type === "redeem-reward-points" && typeof data.cost === "number" && typeof data.mins === "number") {
        next.rewards = next.rewards || { earned: 0, balance: 0 };
        if (next.rewards.balance >= data.cost) {
          next.rewards.balance -= data.cost;
          next.usage.limit += data.mins; // Add the redeemed time to the daily limit
        }
      }
      return next
    })

    // Fix 2: Re-fetch latest server state on failure to avoid stale snapshot rollbacks
    sendStayKidsAction(data).catch((err) => {
      fetchLatestState()
      triggerToast(err.message || "Couldn't sync change — check connection", "error")
    })
  }

  const handleSignOut = async () => {
    localStorage.removeItem("staykids_user_name")
    localStorage.removeItem("staykids_user_email")
    const { setAuthToken } = await import("./lib/staykids-api")
    await setAuthToken(null)
    setUser({ name: "", email: "" })
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
    Profile: <Profile state={state} switchRole={() => setRole("child")} onSignOut={handleSignOut} user={user} onAction={action} />,
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

  // Show loading while async storage resolves
  if (isLoading) {
    return <div className="h-screen w-full bg-[#0a0e10] text-[#71807a] flex items-center justify-center">Loading...</div>
  }

  // 1. First Launch / Onboarding
  if (!selectedRole) {
    return (
      <Onboarding
        defaultRole="parent"
        complete={(selectedRoleChoice) => {
          localStorage.setItem("staykids_selected_role", selectedRoleChoice)
          setSelectedRole(selectedRoleChoice)
          setRole(selectedRoleChoice)
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
          localStorage.setItem("staykids_user_name", authenticatedUser.name)
          localStorage.setItem("staykids_user_email", authenticatedUser.email)
          setAuthenticated(true)
          setReady(true)
          setRole("parent")
        }}
      />
    )
  }

  // Parent is authenticated — go straight to main app (no second onboarding gate)

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
