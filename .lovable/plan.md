# Add 4 new majors

- STEM dropdown: add "Nursing" and "Health Sciences".
- Humanities dropdown: add "Languages" and "Social Work".
- Queue professor-library build jobs for the 4 new fields (NJ, NY, PA, CT, DE, MD, same as existing fields) so results fill in automatically.

## Technical details
- `src/components/ReachOut.tsx` CATS: add subs `nursing`, `health-sci`, `languages` (search term "foreign languages / modern languages"), `social-work`.
- Insert pending `library_jobs` rows for each new subfield x state. Until jobs run, students see the existing "still building out this field" message.
