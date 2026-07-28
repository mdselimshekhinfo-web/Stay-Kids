ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.children DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.device_controls DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blocked_apps DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_usage DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.device_pairings DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.children (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    device_name TEXT DEFAULT 'Android Device',
    battery_level INTEGER DEFAULT 100,
    is_online BOOLEAN DEFAULT true,
    last_location TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.device_controls (
    child_id UUID PRIMARY KEY REFERENCES public.children(id) ON DELETE CASCADE,
    is_paused BOOLEAN DEFAULT false,
    limits_enabled BOOLEAN DEFAULT true,
    bedtime_enabled BOOLEAN DEFAULT true,
    web_filter_enabled BOOLEAN DEFAULT true,
    daily_limit_minutes INTEGER DEFAULT 120,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.blocked_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    package_name TEXT NOT NULL,
    app_name TEXT,
    is_blocked BOOLEAN DEFAULT true,
    UNIQUE(child_id, package_name)
);

CREATE TABLE IF NOT EXISTS public.app_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    total_minutes INTEGER DEFAULT 0,
    top_apps JSONB DEFAULT '[]'::jsonb,
    UNIQUE(child_id, date)
);

CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    detail TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.device_pairings (
    pin TEXT PRIMARY KEY,
    parent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    child_name TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);
