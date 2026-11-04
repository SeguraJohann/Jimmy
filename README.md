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

### Pending
- Project scaffold, Firebase config, Firestore rules template
- Data model and services (exercises, routines, sessions, derived exercise logs)
- Exercises, routines, sessions and set logging
- Monthly history calendar
- Progress analytics (per-exercise trend, strength and volume charts)
- Home, empty states, mobile polish

---

## Setup

Full walkthrough: **[GETTING_STARTED.md](GETTING_STARTED.md)**.

Scripts: `npm run dev`, `npm run build`, `npm test`, `npm run lint`.

---

## Security

- Zero credentials in the repo — everything goes through `.env` (see `.env.example`)
- Firestore rules use a **UID allowlist**, so only the owner can read or write data
