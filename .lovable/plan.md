# Getting the library past 1,000 professors

Short answer to your question: yes — uploading files is the better route. AI generation costs money per professor, is slow, and drops most candidates because it refuses to guess emails. A file you supply is free, instant, and more accurate.

Right now the library holds 67 professors, all biology, because the background AI builder has only completed 3 of its 186 queued jobs.

## The plan

### 1. A creator-only import page

A new page at `/admin` that only you can reach (a passcode you set, stored as a backend secret — not in the code).

On it you can:
- Drop in a CSV (or several)
- See a preview of the first rows and how many will be added
- Import — new professors are added, existing ones are updated by email, nothing is duplicated

A running count shows the library total after each import.

### 2. The CSV format

One header row, these columns:

```text
name,email,title,institution,field,state,subfield_key,tier,research_hook
```

- `email` — required, must be an institutional address; this is the dedupe key
- `name` — required
- `subfield_key` — must match a field in the app (e.g. `biology`, `polisci`, `accounting`). The importer lists valid keys on the page and flags rows that don't match instead of silently accepting them.
- `state` — two letters (`NJ`). Region fills in automatically.
- `tier` — `high` / `medium` / `low`, controls which "chance" group the student sees. Defaults to `medium` if blank.
- `research_hook` — one sentence about their current research; this is what the email draft references. Optional, but drafts are noticeably better with it.
- `title`, `institution`, `field` — optional but recommended.

Rows with a bad or missing email are skipped and listed back to you so you can fix them.

Since you said NJ only for now, a single NJ file with 1,000+ rows gets you there in one import. You can add other states later with more files and nothing else has to change.

### 3. The AI builder stays, but quiet

The monthly background builder keeps running for fields your files don't cover, so thin subfields still fill in slowly. It stays bounded and pauses itself if AI credit runs out. Uploaded professors are never overwritten by AI-generated ones.

### 4. What students see

Nothing about the import is visible to them — search still reads the same library instantly, ranked by proximity, with the 30-day one-student-per-professor cooldown intact.

## If you'd rather not build the page

If you just attach the NJ file here, I can import it directly for you this turn and skip the admin page entirely. The page is only worth it if you expect to upload repeatedly on your own.

## Technical details

- New route `src/routes/admin.tsx` — passcode check against a backend secret via a server function; no client-side secret.
- New `src/lib/library-import.functions.ts` — parses CSV server-side, validates rows with Zod, normalizes email/state, upserts into `public.contacts` on `email` with `source: 'upload'`, returns counts plus rejected rows.
- Upsert never downgrades an `upload` row to `ai`/`library`; `last_verified_at` set at import time.
- No schema change needed — `contacts` already has `tier`, `state`, `region`, `subfield_key`, `research_hook`, `verification_source`.
- No new packages (CSV parsed with a small server-side splitter handling quoted fields).
