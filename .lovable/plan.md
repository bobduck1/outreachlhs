## The bug

Reproduced in the preview: after signing in, ReachOut immediately crashes with

```
TypeError: Cannot read properties of undefined (reading 'name')
  at ReachOut (src/components/ReachOut.tsx line 614)
```

That crash bubbles up to the route error boundary, which renders "Something went wrong / An unexpected error occurred. Please try again." — the message you're seeing.

## Root cause

`cat` (line 269) holds a **subfield** key (e.g. `"polisci"`), but line 614 does `CATS[cat].name`, and `CATS` only contains **main-category** keys (`stem`, `business`, `humanities`). `CATS["polisci"]` is `undefined`, so `.name` throws.

The same file already has the correct lookup pattern elsewhere: `SUB_LOOKUP[cat]?.sub.name`.

## Fix

One-line change in `src/components/ReachOut.tsx` at line 614:

```text
- 🔍 Find ${CATS[cat].name} Contacts
+ 🔍 Find ${SUB_LOOKUP[cat]?.sub.name || "matching"} Contacts
```

Then re-run the Playwright sign-in flow to confirm the app renders instead of the error screen.

No other files change. No schema, auth, or server-function changes are needed — sign-in itself is working (auth logs confirm successful signups/logins); it's the post-login render that crashes.