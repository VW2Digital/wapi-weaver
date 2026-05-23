CREATE POLICY "cm_insert_own" ON public.campaign_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cm_update_own" ON public.campaign_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cm_delete_own" ON public.campaign_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);