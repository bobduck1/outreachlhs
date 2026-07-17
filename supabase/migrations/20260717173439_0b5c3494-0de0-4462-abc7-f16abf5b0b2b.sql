ALTER TABLE public.contact_activity
  ADD COLUMN response_status text NOT NULL DEFAULT 'pending'
  CHECK (response_status IN ('pending','no_response','declined','accepted','other'));