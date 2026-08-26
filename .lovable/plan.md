## Goal

Stop paying for AI on every student search. Instead, build a large pre-generated library of professors in the database and serve student searches from it. AI runs on a schedule (monthly, in the background) to grow and refresh the library — not while a student is waiting.

This is the single biggest thing you can do for credits: searches go from ~2 expensive AI calls each to a plain database query costing nothing.

## How it works

```text
BEFORE:  student clicks Search -> 2 AI calls -> 10 professors
AFTER:   monthly job -> AI fills library (thousands of professors)
         student clicks Search -> database query -> 10 professors, instant, free
```

## 1. Expand the contacts table into a real library

The `contacts` table already exists but only stores what a live search happened to produce. Add the fields the library needs:

- `tier` (high / medium / low)
- `research_hook`
- `verification_source`
- `state` and `region` (so results can be matched to a student's location without asking AI)
- `subfield_key` (matches the subcategory keys already in the UI, e.g. `polisci`, `accounting`)
- `last_verified_at`, `times_served`

Indexes on `subfield_key`, `state`, and `tier` so lookups stay instant as the table grows.

## 2. Background library builder

A `library_jobs` table holds one row per (subfield, state) combination to fill, with a status. A server route at `/api/public/build-library` processes a small bounded batch per call:

- takes a single-flight lock so two runs never overlap
- pulls up to 3 pending job rows per invocation
- runs the existing find-then-verify AI passes for that subfield + state
- upserts verified professors into `contacts` on email
- marks the row done and records how many were added
- stops immediately and pauses the whole job if the AI gateway reports no credits

`pg_cron` calls it every 10 minutes on the 1st–3rd of each month, then stops. That spreads the cost over hours instead of hammering the gateway, and refreshes the library monthly without you doing anything.

## 3. Student search reads the library

`searchContacts` changes to a database query:

1. Filter `contacts` by the chosen subfield.
2. Rank by state match to the student's location first, then nearby states, then anywhere.
3. Exclude anyone the student already emailed, and anyone under the 30-day global cooldown (one other student in the last 30 days).
4. Mix the tiers — aim for roughly 5 high / 3 medium / 2 low so the "chances" grouping still has content.
5. Return 10.

No AI call, no waiting. The "searches take 1–2 minutes" warning gets removed; results are instant.

**If the library has fewer than 10 matches for that subfield + area**, the UI says so plainly ("we're still building out this field — check back soon") and offers what it does have. There's no silent AI fallback, because that would reintroduce the cost you're trying to avoid.

## 4. Seeding the first batch

The initial library is populated by queueing job rows for every subfield across your target states and letting the same background route drain the queue. Given the AI budget, this happens gradually — expect the library to fill in over hours, not seconds. You can watch the count grow.

## Honest trade-offs

- **Freshness:** a professor's email could go stale between monthly refreshes. `last_verified_at` is stored so you can re-verify the oldest entries first.
- **Coverage is uneven at first:** popular subfields fill in before niche ones. The UI needs to handle a thin library gracefully, which is why point 3 includes the empty state.
- **Cost moves, it doesn't vanish:** building the library still spends AI budget. The win is that it's *your* controlled monthly spend instead of unbounded per-student spend, and each professor is paid for once but served to many students over time.
- **The $1/month free AI balance is still the ceiling.** This plan makes that dollar go much further, but a big library gets built faster on a paid plan with AI top-ups.

## Technical details

- **Migration:** new columns + indexes on `public.contacts`; new `library_jobs` and `library_lock` tables with RLS and explicit GRANTs (authenticated: read-only where needed; service_role: full).
- **`src/routes/api/public/build-library.ts`:** new server route, `apikey`-header auth, bounded batch of 3, single-flight lease, idempotent per-job-row progress, halt on 402/403.
- **`src/lib/reachout.functions.ts`:** `searchContacts` rewritten as a library query (keeps the existing exclusion + cooldown logic, drops the AI calls); the find/verify prompt code moves to a server-only helper used by the background route.
- **`src/components/ReachOut.tsx`:** remove the 1–2 minute warning, add the thin-library empty state.
- **pg_cron:** monthly schedule calling the build route.
- No new packages, no new secrets.
