## Goal

Get the returned professor emails as close to 100% real as possible, and personalize each draft with a short mention of that professor's actual research.

## On your SMTP/MX question

Real mailbox verification is harder than it sounds:

- **MX check** (does the domain accept mail at all?) — trivial, one DNS lookup per email. But every `.edu` passes it, so it barely filters anything. Low value.
- **SMTP RCPT check** (does this specific mailbox exist?) — the actually useful check, but universities almost universally block it: they either accept every address (catch-all) or refuse the probe from cloud IPs, and doing it from a serverless worker gets our IP blacklisted fast. Also requires outbound port 25, which Cloudflare Workers don't allow. So in this stack it's effectively not doable without a paid third-party verification API (Hunter, NeverBounce, ZeroBounce — ~$0.005/email).

**Most accurate approach available to us without adding a paid service:** upgrade the AI to a stronger model and make it do a two-pass "find, then verify" flow where each address has to be justifiable from the university's public faculty directory. This is what actually moves the needle — the current failure mode is the AI *guessing* `firstname.lastname@school.edu` patterns, not bad domains.

## Plan

### 1. Upgrade the search model
In `src/lib/reachout.functions.ts`, switch `searchContacts` from `google/gemini-2.5-flash` to `openai/gpt-5.5`. Stronger recall of real faculty pages and much better at refusing when uncertain.

### 2. Two-pass verification inside `searchContacts`
Same server function, one extra AI call:

- **Pass 1 — Find:** ask for up to 2× the requested count of candidate professors matching the subfield / location / smaller-school preference. Include name, institution, department, and — critically — a one-sentence description of their actual current research.
- **Pass 2 — Verify:** feed the candidates back to the model with a strict instruction: "For each candidate, return the professor's institutional email ONLY if you can name the specific university faculty directory page it appears on. If you cannot, drop them. Never construct an email from a name+domain pattern." Return `verificationSource` per contact.
- Drop anything without a verification source. Keep dropping until we hit the requested count or run out of candidates (return fewer rather than pad with guesses).
- Keep the existing tier assignment, dedupe, cooldown, and Supabase upsert logic untouched.

### 3. Per-contact research hook for drafts
Store the professor's specific research sentence (already captured in Pass 1) on the contact row returned to the client, and in `src/components/ReachOut.tsx` weave a one-line reference into `buildBody` — e.g. *"I was especially interested in your work on {research_hook}, since ..."* — right before the existing research-assistance ask. Falls back gracefully to the current generic line when a hook isn't available.

### 4. UI transparency
Small text under each result: *"Verified via {verificationSource}"* so the student can sanity-check before sending, and so a wrong source is visible instead of invisible.

### 5. No schema changes
`research_hook` and `verificationSource` are transient — carried on the in-memory `ContactRow` returned from the server function and used by the draft builder. Nothing new to migrate.

## Trade-offs to know

- Two passes + stronger model → each search costs more AI credits and takes a few seconds longer. Worth it for accuracy.
- You will sometimes get fewer than 10 results per search (e.g. 6–8). That's the point — better to return 6 real professors than 10 with 3 guesses.
- If you later want true near-100% deliverability, the next step would be adding NeverBounce/Hunter as a paid verification step. I'd only add that once you've seen how the two-pass flow performs.

## Technical details

- **Files changed:** `src/lib/reachout.functions.ts` (model + two-pass verification + return `research_hook`, `verification_source`), `src/components/ReachOut.tsx` (use `research_hook` in `buildBody`, render `verification_source` in the result cards). Types in `ContactRow` gain two optional string fields.
- **Model:** `openai/gpt-5.5` via existing Lovable AI Gateway call. Keep the strict `json_schema` response format; extend the schema with `research_hook` and `verification_source`.
- **No DB migration, no new secrets, no new packages.**
