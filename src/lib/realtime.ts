import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ewsehvgwzczlshyoyhqf.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

let supabaseClient: any = null

function getClient() {
  if (!supabaseClient && SUPABASE_ANON_KEY) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: { params: { eventsPerSecond: 10 } }
    })
  }
  return supabaseClient
}

export interface RealtimeUpdate {
  table: string
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: any
  old: any
}

export function subscribeToChildUpdates(
  childIds: string[],
  onUpdate: (update: RealtimeUpdate) => void
): (() => void) {
  const client = getClient()
  if (!client || !childIds.length) return () => {}

  const filterStr = childIds.join(',')

  const channel = client
    .channel('staykids-live')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'children', filter: `id=in.(${filterStr})` },
      (payload: any) => onUpdate({ table: 'children', eventType: payload.eventType, new: payload.new, old: payload.old })
    )
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'device_controls', filter: `child_id=in.(${filterStr})` },
      (payload: any) => onUpdate({ table: 'device_controls', eventType: payload.eventType, new: payload.new, old: payload.old })
    )
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'alerts', filter: `child_id=in.(${filterStr})` },
      (payload: any) => onUpdate({ table: 'alerts', eventType: 'INSERT', new: payload.new, old: payload.old })
    )
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'app_usage', filter: `child_id=in.(${filterStr})` },
      (payload: any) => onUpdate({ table: 'app_usage', eventType: payload.eventType, new: payload.new, old: payload.old })
    )
    .subscribe()

  return () => {
    client.removeChannel(channel)
  }
}

export function isRealtimeAvailable(): boolean {
  return !!SUPABASE_ANON_KEY
}

