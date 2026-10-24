CREATE TABLE public.error_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  local_id TEXT NOT NULL,
  route TEXT NOT NULL DEFAULT 'unknown',
  message TEXT NOT NULL DEFAULT '',
  stack TEXT,
  user_agent TEXT,
  screen TEXT,
  online BOOLEAN NOT NULL DEFAULT true,
  extra_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  staff_notes TEXT,
  ai_summary TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, local_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.error_reports TO authenticated;
GRANT ALL ON public.error_reports TO service_role;
ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "error_reports_owner_all" ON public.error_reports FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());