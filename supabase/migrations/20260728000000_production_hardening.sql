-- Production Hardening Migration: Indexes, Foreign Keys & Triggers

-- 1. Add Indexing for Frequent Query Patterns
CREATE INDEX IF NOT EXISTS idx_children_parent_id ON public.children(parent_id);
CREATE INDEX IF NOT EXISTS idx_alerts_child_id ON public.alerts(child_id);
CREATE INDEX IF NOT EXISTS idx_app_usage_child_date ON public.app_usage(child_id, date);
CREATE INDEX IF NOT EXISTS idx_blocked_apps_child ON public.blocked_apps(child_id);
CREATE INDEX IF NOT EXISTS idx_device_pairings_pin ON public.device_pairings(pin);

-- 2. Audit Trail Timestamp Function & Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = timezone('utc', now());
   RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_device_controls_modtime') THEN
        CREATE TRIGGER update_device_controls_modtime
        BEFORE UPDATE ON public.device_controls
        FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END $$;

-- 3. Ensure Table Columns exist with DEFAULT constraints
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now());
ALTER TABLE public.children ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now());
