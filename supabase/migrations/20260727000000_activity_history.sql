CREATE TABLE IF NOT EXISTS public.daily_usage_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    child_id UUID REFERENCES public.children(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    minutes_used INTEGER NOT NULL DEFAULT 0,
    top_apps JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(child_id, date)
);

ALTER TABLE public.daily_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view their children's usage logs"
    ON public.daily_usage_logs
    FOR SELECT
    USING (
        child_id IN (
            SELECT id FROM public.children WHERE parent_id = (SELECT id FROM public.profiles WHERE auth_id = auth.uid())
        )
    );

CREATE POLICY "Parents can insert/update usage logs"
    ON public.daily_usage_logs
    FOR ALL
    USING (
        child_id IN (
            SELECT id FROM public.children WHERE parent_id = (SELECT id FROM public.profiles WHERE auth_id = auth.uid())
        )
    );
