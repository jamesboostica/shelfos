CREATE POLICY "error_reports_manager_read" ON public.error_reports FOR SELECT TO authenticated
  USING (public.is_manager(auth.uid()));
CREATE POLICY "error_reports_manager_update" ON public.error_reports FOR UPDATE TO authenticated
  USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));