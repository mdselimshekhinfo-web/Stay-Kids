-- 1.7: Enable Row Level Security on all Postgres tables with default-deny
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.children ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.device_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blocked_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.device_pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_usage_logs ENABLE ROW LEVEL SECURITY;

-- Note: Service-role key used by Edge Functions bypasses RLS safely.
