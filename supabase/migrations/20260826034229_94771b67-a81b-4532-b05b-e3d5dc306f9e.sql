ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS research_hook text DEFAULT '',
  ADD COLUMN IF NOT EXISTS verification_source text DEFAULT '',
  ADD COLUMN IF NOT EXISTS state text DEFAULT '',
  ADD COLUMN IF NOT EXISTS region text DEFAULT '',
  ADD COLUMN IF NOT EXISTS subfield_key text DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS times_served integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS contacts_subfield_key_idx ON public.contacts (subfield_key);
CREATE INDEX IF NOT EXISTS contacts_state_idx ON public.contacts (state);
CREATE INDEX IF NOT EXISTS contacts_tier_idx ON public.contacts (tier);

CREATE TABLE IF NOT EXISTS public.library_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subfield_key text NOT NULL,
  search_term text NOT NULL,
  category text NOT NULL DEFAULT '',
  state text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  professors_added integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  last_error text DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subfield_key, state)
);

GRANT ALL ON public.library_jobs TO service_role;
ALTER TABLE public.library_jobs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.library_lock (
  id integer PRIMARY KEY DEFAULT 1,
  lease_until timestamptz,
  paused boolean NOT NULL DEFAULT false,
  pause_reason text DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT library_lock_single_row CHECK (id = 1)
);

GRANT ALL ON public.library_lock TO service_role;
ALTER TABLE public.library_lock ENABLE ROW LEVEL SECURITY;

INSERT INTO public.library_lock (id) VALUES (1) ON CONFLICT (id) DO NOTHING;