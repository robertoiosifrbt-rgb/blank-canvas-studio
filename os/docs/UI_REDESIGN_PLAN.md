# GYM APP — Visual Target Rebuild Plan

## Source of truth

The 9-screen reference image supplied by Roberto on 12 Aug 2026 is the visual target for the app. Existing working data/storage logic is preserved where possible while presentation and flows are rebuilt screen-by-screen for iPhone.

## Progress

**Verified progress: 7 / 20 tasks complete = 35%.**

Status legend:
- [ ] Not started
- [~] In progress
- [x] Done
- [!] Needs review/fix

## Phase A — Global visual system

- [x] 1. Lock the supplied 9-screen image as the visual target and reset progress honestly.
- [x] 2. Preserve existing data model, storage, Track history safety and working tests during the visual rebuild.
- [~] 3. Rebuild global iPhone shell: white/light background, compact headers, reference typography, card radius/shadows, coral accent, dark navy primary actions, safe areas.
- [x] 4. Rebuild bottom navigation to visually match the reference: Home / Body / Workout / Progress / Settings, compact icons/labels, coral active state.

## Phase B — Home screen

Target: top-left screen in reference.

- [x] 5. Header: greeting, subtitle and notification action.
- [x] 6. Weekly Progress card: circular percentage plus Workouts / Volume / Duration metrics using real workout data.
- [x] 7. Today's Workout card: real current-session state, exercise/time summary and Start/Continue Workout CTA.
- [x] 8. Quick Actions 2x2 cards: Log Workout / Exercises / Body Stats / Progress Photos.
- [~] 9. Recent Workouts compact list with date, real duration/volume and completion state. Implemented; final visual-fidelity pass remains.

## Phase C — Workout

Target: top-middle + middle-left screens.

- [~] 10. Active Workout screen: session lifecycle now records Start-to-Finish elapsed time and Finish session; full target layout (dark navy header, exercise progress, progress bar, current exercise/set table, next-exercise card) is still incomplete.
- [~] 11. Workout Log screen: real month calendar, selected-day state and workout cards are implemented; final target totals/layout fidelity remains.

## Phase D — Exercises

Target: middle-middle + middle-right screens.

- [~] 12. Exercise Library: search, category chips, compact cards and floating add button implemented; filter/detail interaction and final fidelity remain.
- [ ] 13. Exercise Detail: dark hero header, exercise visual area, muscle visual area, metadata cards, Instructions/Muscles tabs and Add to Workout CTA.
- [~] 14. Exercise create/edit: current editable fields and removable Tracks retained; target-style flow/fidelity remains incomplete.

## Phase E — Body

Target: top-right + bottom-left screens.

- [ ] 15. Body Overview: Muscles / Body Parts segmented control, front/back body visual, legend and muscle-focus bars.
- [ ] 16. Body Stats: Measurements / Composition / History tabs, key-measurement rows with icons and deltas, dark Add Measurements CTA.

## Phase F — Progress Photos

Target: bottom-middle screen.

- [ ] 17. Progress Photos: All Photos / Front / Side / Back filters, 3-column photo grid grouped by date, add-photo action.

## Phase G — Settings

Target: bottom-right screen.

- [~] 18. Settings: profile/level card, Preferences, Data and About groups implemented; current Export JSON preserved. Restore/settings interactions and final fidelity remain incomplete.

## Phase H — Fidelity + safety audit

- [ ] 19. Visual fidelity pass on iPhone: spacing, typography, icon sizing, card geometry, nav, sticky actions, overflow, light/dark behaviour and all empty/error states.
- [ ] 20. Regression gate: Track deletion/history safety, existing exercise/workout/body/photo data compatibility, full tests, lint, production build and successful GitHub Pages deploy.

## Verified count

- Done: 1, 2, 4, 5, 6, 7, 8 = **7 tasks**
- In progress: 3, 9, 10, 11, 12, 14, 18 = **7 tasks**
- Not started: 13, 15, 16, 17, 19, 20 = **6 tasks**
- Total: **20 tasks**
- Completion percentage counts only `[x]`: **7 / 20 = 35%**

## Non-negotiable functional rules

1. Existing workout history must remain readable.
2. Removing a Track must remove it from future/current exercise definitions without deleting historical logged values.
3. Exercise add/edit/delete and workout add/edit/delete remain functional.
4. Measurements, progress photos, export/restore and version banner remain functional.
5. No screen is marked complete merely because it uses similar colours; it must match the reference structure and hierarchy.
6. No phase is marked complete until its existing relevant tests pass.

## Implementation order

1. Global shell + bottom nav.
2. Home to high visual fidelity.
3. Active Workout + Workout Log calendar.
4. Exercise Library + Exercise Detail + editor.
5. Body Overview + Body Stats.
6. Progress Photos.
7. Settings.
8. Final fidelity and regression audit.

## Progress rule

Update this file after each completed target task. Percentage is based only on tasks explicitly marked [x]. Items marked [~] remain in progress and do not count as complete.
