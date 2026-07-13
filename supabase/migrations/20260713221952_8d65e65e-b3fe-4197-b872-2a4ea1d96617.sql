
-- Profiles: one row per user, stores student form fields
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT DEFAULT '',
  school TEXT DEFAULT '',
  grade TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  location TEXT DEFAULT '',
  interests TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read"   ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile write"  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Contacts: shared master list (seeded from CSV + AI search results)
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  title TEXT DEFAULT '',
  institution TEXT DEFAULT '',
  field TEXT DEFAULT '',
  category TEXT DEFAULT '',
  location TEXT DEFAULT '',
  source TEXT NOT NULL DEFAULT 'ai',  -- 'csv' | 'ai'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts readable by all users" ON public.contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "contacts insertable by all users" ON public.contacts FOR INSERT TO authenticated WITH CHECK (true);

-- Contact activity: who sent to whom & when
CREATE TABLE public.contact_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_email TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, contact_email)
);
CREATE INDEX contact_activity_email_idx ON public.contact_activity (contact_email, sent_at DESC);
GRANT SELECT, INSERT, DELETE ON public.contact_activity TO authenticated;
GRANT ALL ON public.contact_activity TO service_role;
ALTER TABLE public.contact_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activity read"   ON public.contact_activity FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own activity insert" ON public.contact_activity FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own activity delete" ON public.contact_activity FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Cooldown check: returns true if 2+ OTHER users have sent to this email in the last 30 days.
-- SECURITY DEFINER so users can query it without seeing raw activity rows for others.
CREATE OR REPLACE FUNCTION public.contact_on_cooldown(_email TEXT, _for_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(DISTINCT user_id) >= 2
  FROM public.contact_activity
  WHERE contact_email = _email
    AND user_id <> _for_user
    AND sent_at > now() - INTERVAL '30 days';
$$;
GRANT EXECUTE ON FUNCTION public.contact_on_cooldown(TEXT, UUID) TO authenticated;
