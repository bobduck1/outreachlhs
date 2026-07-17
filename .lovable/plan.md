## Goal

Let students record how each professor responded after they emailed them: no response yet, responded (no), responded (yes), or responded (other/neutral). Surface those statuses in the Log so the student can see their hit rate.

## Data model

Add one nullable text column to the existing `contact_activity` table: `response_status`, with allowed values `pending` | `no_response` | `declined` | `accepted` | `other`. Default `pending` so every existing "sent" row keeps working with no backfill needed. No new table, no new RLS work — the row is already user-scoped.

## Server functions (`src/lib/reachout.functions.ts`)

- `listMyActivity` — extend the select to include `response_status`.
- New `setResponseStatus({ email, status })` — validates `status`, updates the row for the current user's `(user_id, contact_email)`, returns `{ ok: true }`. Uses `requireSupabaseAuth`. Same error-handling shape as the other mutations.

## UI (`src/components/ReachOut.tsx`)

In the **Log / Sent tab**, next to each sent contact add a compact status control (segmented buttons or a small select) with five options:

- Waiting
- No response
- Said no
- Said yes
- Other

Selecting one calls `setResponseStatus` and optimistically updates local state. Show the current status as a small colored pill on the row (green = yes, red = no, gray = waiting, muted = no response / other).

At the top of the Log tab, show a tiny summary line: `X sent · Y replied · Z said yes`. Nothing fancy, just a quick hit-rate readout.

No changes to the search flow, draft queue, or email template.

## Trade-offs

- Statuses are self-reported; there's no inbox reading. That's fine — matches how the rest of the tool works, and avoids the Gmail-API scope you already decided against.
- Keeping it on `contact_activity` (rather than a new `responses` table) means one status per user per contact, which is the right shape here.

## Technical details

- **Migration:** add `response_status text not null default 'pending'` with a check constraint on the five allowed values.
- **Files changed:** `src/lib/reachout.functions.ts` (extend select, add `setResponseStatus`), `src/components/ReachOut.tsx` (status control + summary in the Log tab, wire up the new server fn, extend the activity type).
- **No new packages, no new secrets.**
