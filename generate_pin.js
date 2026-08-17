import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ewsehvgwzczlshyoyhqf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3c2Vodmd3emN6bHNoeW95aHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0NTA0OTcsImV4cCI6MjA1NjAyNjQ5N30...'

async function generatePIN() {
  const email = 'mdselimshekh.info@gmail.com'
  const password = 'Mdselim@121'

  // The login endpoint is POST /auth/login
  const res = await fetch(`${supabaseUrl}/functions/v1/server/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  const data = await res.json()
  if (!data.token) {
    console.error('Login failed', data)
    return
  }
  
  console.log('Logged in!')
  const token = data.token

  // Generate pairing pin
  const res2 = await fetch(`${supabaseUrl}/functions/v1/server/pairing/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ childId: 'child-1' })
  })
  
  const data2 = await res2.json()
  console.log('PIN Data:', data2)
}

generatePIN().catch(console.error)
