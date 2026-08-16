import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

import AppParent from '../AppParent'
import AppChild from '../AppChild'
import { authManager } from '../lib/auth-manager'
import * as api from '../lib/staykids-api'

// Mock the API layer so we can simulate successful auth and data fetching
vi.mock('../lib/staykids-api', async () => {
  const actual = await vi.importActual('../lib/staykids-api')
  return {
    ...actual,
    getStayKidsState: vi.fn().mockResolvedValue({
      parentAppEnabled: true,
      children: [{ id: 'child-1', name: 'Kid Device', online: true, battery: 80, location: 'Home' }],
      child: { id: 'child-1', name: 'Kid Device', online: true, battery: 80, location: 'Home' },
      blockedApps: [],
      screenTimeLimit: 120,
      usage: { minutes: 30, limit: 120, topApps: [] },
      controls: { paused: false, limits: true, bedtime: false, filter: false },
      remote: { mirrorStreamActive: false, audioActive: false, connectionState: 'idle' },
      alerts: [],
    }),
    sendStayKidsAction: vi.fn().mockResolvedValue({}),
    signUpParent: vi.fn().mockResolvedValue({ success: true, token: 'fake-token' }),
    verifyEmailOtp: vi.fn().mockResolvedValue({ success: true, token: 'fake-token', user: { name: 'Parent', email: 'parent@example.com' } }),
    loadAuthToken: vi.fn().mockResolvedValue(null),
  }
})

// Mock Capacitor plugins to avoid native errors in JSDOM
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
  registerPlugin: (name: string) => ({
    web: {}
  })
}))

// Ignore Leaflet map errors since JSDOM doesn't support canvas/WebGL fully
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div />,
  Marker: () => <div />,
  Popup: () => <div />,
}))

// Mock chart.js so it doesn't crash on JSDOM canvas
vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="chart-line" />,
  Bar: () => <div data-testid="chart-bar" />,
  Doughnut: () => <div data-testid="chart-doughnut" />
}))

describe('Parent App UI Options', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear() // clear simulated auth
  })

  it('renders onboarding and allows navigation to login', async () => {
    render(<AppParent />)
    
    // We should see the prominent disclosure onboarding
    const parentRoleBtn = await screen.findByText(/I’m a parent/i)
    fireEvent.click(parentRoleBtn)
    
    // Click Continue
    const continueBtn = await screen.findByText(/Continue/i)
    fireEvent.click(continueBtn)
    
    // Auth component should show Welcome Back / Log In
    expect(await screen.findByText(/Create Parent Account/i)).toBeInTheDocument()
  })

  it('renders Dashboard after successful authentication and tests all options', async () => {
    // Override loadAuthToken for this test
    vi.mocked(api.loadAuthToken).mockResolvedValue('fake-token')
    
    // Simulate already logged in and onboarding completed
    window.localStorage.setItem('staykids_selected_role', 'parent')
    window.localStorage.setItem('staykids_user_name', 'Test Parent')
    window.localStorage.setItem('staykids_user_email', 'test@example.com')
    await authManager.setSession({ name: 'Test Parent', email: 'test@example.com' }, 'fake-token', 'parent')
    
    render(<AppParent />)
    
    // Might show onboarding if not marked complete, so bypass it if it appears
    const continueBtn = await screen.queryByText(/Continue/i)
    if (continueBtn) fireEvent.click(continueBtn)
    
    // The Dashboard should render and fetch state
    expect(await screen.findByText(/Today at a glance/i)).toBeInTheDocument()
    expect(api.getStayKidsState).toHaveBeenCalled()

    // Test clicking on Dashboard Options
    
    // 1. Controls option
    const controlsBtn = await screen.findByText(/^Controls$/i)
    fireEvent.click(controlsBtn)
    expect((await screen.findAllByText(/Daily Screen Time Limit/i)).length).toBeGreaterThan(0)
    
    // 2. Activity option
    const activityBtn = await screen.findByText(/^Activity$/i)
    fireEvent.click(activityBtn)
    expect((await screen.findAllByText(/Activity & Logs/i)).length).toBeGreaterThan(0)

    // 3. Alerts option
    const alertsBtn = await screen.findByText(/^Alerts$/i)
    fireEvent.click(alertsBtn)
    expect((await screen.findAllByText(/Notification Logs/i)).length).toBeGreaterThan(0)

    // 4. Profile option
    const profileBtn = await screen.findByText(/^Profile$/i)
    fireEvent.click(profileBtn)
    expect((await screen.findAllByText(/Test Parent/i)).length).toBeGreaterThan(0)
  })
})

describe('Child App UI Options', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('renders Pairing screen initially and checks PIN input', async () => {
    render(<AppChild />)
    
    // Select Child Role in Onboarding
    const childRoleBtn = await screen.findByText(/This is a child device/i)
    fireEvent.click(childRoleBtn)
    
    // Click Continue to confirm role
    let continueBtn = await screen.findByText(/Continue/i)
    fireEvent.click(continueBtn)
    
    // Now it renders Onboarding for the Child device (step 0 again)
    // We click Continue again to pass prominent disclosure
    continueBtn = await screen.findByText(/Continue/i)
    fireEvent.click(continueBtn)
    
    // Now we should be on Permissions screen (step 1). Click Continue.
    continueBtn = await screen.findByText(/Continue/i)
    fireEvent.click(continueBtn)
    
    // Should see pairing title
    expect(await screen.findByText(/Pair/i)).toBeInTheDocument()
    
    // Should have 6-digit PIN inputs
    const inputs = screen.getAllByRole('textbox')
    expect(inputs.length).toBeGreaterThanOrEqual(1)
    
    // We can simulate entering a PIN
    fireEvent.change(inputs[0], { target: { value: '1' } })
    expect(inputs[0]).toHaveValue('1')
  })
})
