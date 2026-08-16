-- Enable Row Level Security on newly added FlashGet Kids feature tables
-- This ensures default-deny for direct client access, relying on the secure Edge Functions
-- which operate with the service_role key to bypass RLS safely.

ALTER TABLE IF EXISTS public.child_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sms_logs ENABLE ROW LEVEL SECURITY;

-- If you later decide to migrate from Custom JWTs to GoTrue for direct Postgres Realtime, 
-- you can add policies like this:
-- CREATE POLICY "Users can view their own child notifications" 
-- ON public.child_notifications FOR SELECT 
-- USING (auth.uid() IN (SELECT parent_id FROM public.children WHERE id = child_notifications.child_id));
