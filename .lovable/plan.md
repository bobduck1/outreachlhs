## What changes

**1. Accounts (Lovable Cloud + email/password auth)**
- Enable Lovable Cloud, add an `/auth` page (sign up / sign in), gate the app so only signed-in users see ReachOut.
- On signup, create a `profiles` row automatically via trigger. Student info (name, school, grade, location, interests) autosaves to `profiles` so it persists across sessions.

**2. Remove categories**
- Delete `research` (Think Tanks) and `nonprofit` (Nonprofit / Civic) from `CATS`. Existing CSV rows in those fields simply won't match any category button.

**3. AI-generated contact search (replaces "Discover from CSV")**
- New "Search" button in the field/category panel — user picks a field, hits Search, we call a server function that uses Lovable AI (Gemini) to return 8–15 professor contacts (research faculty only, no industry professionals).
- **Strict prompt**: model must ONLY return contacts where it is 100% confident of the real institutional email (published on the university's public faculty directory). If it is guessing or pattern-matching (`first.last@school.edu`), it must omit that contact entirely. Response is structured JSON via `Output.object` schema so we can enforce shape and drop anything missing an email.
- Returned contacts get upserted into a shared `contacts` table (deduped on email). Results shown in the Discover tab as before.
- Existing CSV remains as a seed of curated contacts, always available.

**4. Per-user + soft global cooldown**
- New table `contact_activity(contact_email, user_id, sent_at)`.
- When user marks a queue item as sent → insert a row.
- Discover/results filter:
  - Hide if current user has ever sent → "permanently hidden from sender".
  - Otherwise, count distinct other users who sent within last 30 days; if ≥ 2, hide as "recently contacted (cooldown)". After 30 days they reappear.
- Sent-tab behavior stays local per user.

**5. Email templates — research-only, no shadowing**
- Every category (except explicit medical shadowing) rewrites to ask about *assisting with research*, using the exact Togman-style template shape already in place.
- Subject lines: replace all "Seeking Shadowing" with "Seeking Research Assistantship" for professor categories. Pre-med keeps shadowing (that's the whole point of pre-med outreach), but a professor in the pre-med category still gets a research-assist ask.
- All-professor detection: if `contact.title` contains "professor" / "prof.", body always uses the research-assist template regardless of category.

## Technical section

- **Migration**: `profiles`, `contacts`, `contact_activity` tables with RLS + GRANTs. `contact_activity` policies: users can insert their own rows; SELECT restricted to own rows *plus* an aggregated `has_recent_cooldown(email)` security-definer function that returns bool (so no user can enumerate who emailed whom).
- **Server fns** (in `src/lib/*.functions.ts`):
  - `searchContacts({ field, location })` → Lovable AI call, upserts, returns list.
  - `listVisibleContacts({ field })` → joins `contacts` with cooldown/user-history filter.
  - `markSent({ email })` → insert into `contact_activity`.
- **AI model**: `google/gemini-2.5-pro` (higher accuracy for factual lookups), structured output schema requiring `name`, `email`, `institution`, `title`, `field`, `confidence_note`. Prompt explicitly forbids guessed emails.
- **Auth guard**: move `ReachOut` under `_authenticated/`. Auto-load profile on mount; autosave on blur.
- **UI**: minor — add "Search AI" button next to category grid, cooldown badge on Discover cards, sign-out button in header.

## Out of scope
- Google OAuth (email/password only, per your ask).
- Preventing enumeration of exact users behind cooldown (aggregated only).
- Rate limiting AI search (add later if abused).
