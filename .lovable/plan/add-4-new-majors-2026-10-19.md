# Add 4 new majors

- STEM dropdown: add "Nursing" and "Health Sciences".
- Humanities dropdown: add "Languages" and "Social Work".
- No automatic professor search for these fields — you will upload your own NJ CSV with contacts for them.

## Technical details
- `src/components/ReachOut.tsx` CATS: add subs `nursing`, `health-sci`, `languages` (search term "foreign languages / modern languages"), `social-work`.
- Until your CSV is imported, students see the existing "still building out this field" message.
