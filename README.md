# Jimmy

A personal, mobile-first **gym tracker** for a single user. Build **routines** from reusable
blocks of exercises and a cycle of days, log every set at the gym with one hand, and see
whether each exercise is **progressing, stalled or going down** — in strength and in volume —
plus a **monthly calendar** of the days you trained.

Built on Firebase (Auth, Firestore, Hosting — free Spark plan) with React + TypeScript + Vite.
Installable on the phone as a standalone app and fully usable offline at the gym.

---

## Stack

| Area | Technology |
|---|---|
| Framework | React + TypeScript |
| Build | Vite (web app manifest, installable) |
| Backend | Firebase (Auth, Firestore, Hosting) |
| Styles | CSS Modules + design tokens (dark theme) |
| Charts | Own SVG components |
| Dates | Own helpers (local `YYYY-MM-DD` keys) |
| Validation | Zod |
| Tests | Vitest |

---

## Status

### Done
- Repository created with `.gitignore` (environment files, internal docs and real Firestore rules are excluded)
- Product decisions: app name **Jimmy**, Google sign-in restricted to a single UID (allowlist)
- Project scaffold: Vite + React + TypeScript (strict), Vitest, oxlint, Firebase config, Firestore rules template with UID allowlist
- **Installable on Android/iPhone:** web app manifest (standalone, opens at Inicio) and app icons
- **Data model:** routines and sessions as single documents (embedded blocks, cycle days, exercises and sets, with name copies so past sessions never change) plus a derived per-exercise index (`exerciseLogs`) kept in sync in the same batch; no composite indexes
- **Metrics engine** (tested): Epley 1RM, volume, records (weight, 1RM, volume, reps by weight), live records while logging, per-exercise trend (progressing / stalled / declining / inactive) from the slope of the last sessions, last 4 vs previous 4 comparison, weekly volume, chart downsampling
- **Routines:** reusable blocks with a shared type (Pull, Leg, Push…), targets per exercise, cycle of days combining blocks, reorder with ↑ / ↓, duplicate, archive or delete
- **Exercises:** weight × reps, reps only or time; muscle group, equipment and notes; search and filters; archive when it has history
- **Sessions:** next-day suggestion (never blocking), free sessions, logging date, stopwatch, prefilled weights from last time, ✓ with the suggested reps, ±2.5 kg, add set, live record badges, notes, skip / reorder / remove exercises, finish summary, discard empty sessions, resume an unfinished session
- **History:** monthly calendar with trained days colored by block type, month summary, sessions of the month, edit / change date / delete past sessions
- **Progress:** per-exercise status (progressing / stalled / declining) with sparklines, period summary, weekly volume with moving average, recent records
- **Exercise detail:** time-proportional strength and volume charts with moving average and record markers, filters by type / block / routine, records, reps by weight, paginated history
- **Settings:** block types (name, color), muscle groups, rebuild metrics index, sign out
- Unit tests for metrics, trend, routines and sessions, plus smoke tests that render every screen and modal with sample data (99 tests in total)
- **Getting started guide** ([GETTING_STARTED.md](GETTING_STARTED.md)): Firebase project, `.env`, rules, hosting and phone install, step by step

### Pending
- Create the Firebase project, fill in `.env`, deploy rules and hosting (owner)
- Manual testing of the spec scenarios at the gym, then mobile polish

---

## Setup

Full walkthrough: **[GETTING_STARTED.md](GETTING_STARTED.md)**.

Scripts: `npm run dev`, `npm run build`, `npm test`, `npm run lint`.

---

## Security

- Zero credentials in the repo — everything goes through `.env` (see `.env.example`)
- Firestore rules use a **UID allowlist**, so only the owner can read or write data
