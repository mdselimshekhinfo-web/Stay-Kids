-- Migration for FlashGet Kids feature parity

ALTER TABLE IF EXISTS public.child_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_usage_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.call_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sms_logs DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.child_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    package_name TEXT NOT NULL,
    app_name TEXT,
    title TEXT,
    text TEXT,
    post_time BIGINT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.app_usage_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    package_name TEXT NOT NULL,
    app_name TEXT,
    duration_ms BIGINT DEFAULT 0,
    last_used BIGINT,
    UNIQUE(child_id, date, package_name)
);

CREATE TABLE IF NOT EXISTS public.call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    contact_name TEXT,
    phone_number TEXT,
    call_type TEXT,
    duration_sec INTEGER,
    timestamp BIGINT,
    UNIQUE(child_id, timestamp, phone_number)
);

CREATE TABLE IF NOT EXISTS public.sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    contact_name TEXT,
    phone_number TEXT,
    message_body TEXT,
    message_type TEXT,
    timestamp BIGINT,
    UNIQUE(child_id, timestamp, phone_number)
);
