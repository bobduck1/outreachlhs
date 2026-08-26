## The real constraint

Searches don't spend your build credits — they spend the workspace **AI balance**, which is separate. Your workspace is on the Free plan, which gets **$1 of AI balance per month** and cannot be topped up (top-ups require a paid plan).

Each search today = two Gemini 2.5 Pro calls with big prompts. Realistic cost is roughly **$0.01–0.03 per search**, so $1/month works out to somewhere around **40–90 searches per month total across all users** — i.e. only a couple of searches a day site-wide. That is the number to design around: it's a monthly pool, not a daily one, and one enthusiastic user can drain it in an afternoon.

So the fix is three layers: cut the cost per search, cap how many searches each student can run, and fail gracefully when the pool is gone.

## 1. Cut cost per search (~50–60% cheaper)

- Pass 1 (find candidates) switches to `google/gemini-2.5-flash`. Candidate discovery is a breadth task; Flash handles it fine.
- Pass 2 (verify emails) stays on `google/gemini-2.5-pro` so address accuracy is unchanged.
- Trim pass 1 from `count * 2` candidates down to `count + 5`, which shrinks the pass-2 prompt too.

Effect: roughly 100–200 searches per month instead of 40–90.

## 2. Per-user search quota

New table `search_quota` (`user_id`, `day` date, `count`), user-scoped RLS, GRANTs for authenticated + service_role.

`searchContacts` increments the row for today before calling the AI and refuses past the daily cap. Given the total pool is only a few searches a day site-wide, the cap should be **3 per student per day** — generous relative to the pool, and it stops one user from draining the month.

The UI shows "2 of 3 searches left today" under the search button and disables the button at zero.

## 3. Global monthly kill switch

New table `ai_budget` (single row: `month`, `searches_used`, `monthly_cap`), readable by authenticated users, writable only by service_role. Every search increments it; when `searches_used >= monthly_cap`, searches stop.

Set `monthly_cap` to a conservative 120 to start. You can raise or lower it later with one row update — no redeploy.

## 4. Graceful failure

- If the gateway returns a 402 (credits exhausted) or the monthly cap is hit, `searchContacts` returns a typed `{ blocked: true, reason }` instead of throwing.
- The UI renders a calm banner in place of results: "Search is paused for this month — new professor searches will be available again on the 1st." Search button disabled, everything else (draft queue, sent log, response tracking) keeps working.

## What this doesn't do

It doesn't create more budget. If real students use this daily, $1/month runs out regardless of tuning — a paid plan with AI top-ups is the only way to buy actual headroom. This plan makes the money last as long as possible and makes running out a non-event instead of a broken site.

## Technical details

- **Migration:** `search_quota` and `ai_budget` tables, RLS enabled, explicit GRANTs, plus a seed row for the current month in `ai_budget`.
- **`src/lib/reachout.functions.ts`:** Flash for pass 1, smaller candidate list, quota + budget checks at the top of `searchContacts` (using `supabaseAdmin` inside the handler for the counter writes), 402 mapped to a blocked result, new `getSearchQuota` server fn for the UI.
- **`src/components/ReachOut.tsx`:** quota display under the search button, disabled state, blocked banner.
- No new packages, no new secrets.
