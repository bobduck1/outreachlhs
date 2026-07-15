
REVOKE ALL ON FUNCTION public.contact_on_cooldown(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "contacts insertable by all users" ON public.contacts;
CREATE POLICY "contacts insertable by authenticated users"
ON public.contacts FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
