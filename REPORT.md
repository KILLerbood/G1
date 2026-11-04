# G1 — Focus (Magmafy CRM, UI and daily-experience edition)

## Identity: "Paper & Vermilion"
Warm newsprint paper, near-black ink, ONE accent (vermilion). Hairline rules instead of shadows, near-square corners,
big editorial Arabic display type, numbered "index" navigation, a masthead with issue number per day. Light by default,
optional "Night paper" dark theme. No WebGL, no gradients, no purple. Tokens: `src/styles/tokens.css`; design system: `src/styles/focus.css`
(restyles every shared class so all legacy pages read as native).

## What was built
- **يومي / Focus** (`src/features/focus`, home `/`): masthead + day progress bar; one-key call queue (Space opens next lead, 1-5 outcome
  answered / no answer / meeting / won / lost, 1-4 follow-up date, Enter saves + auto-advances, S skip, W WhatsApp, C call, O profile, Esc stop);
  saving logs a call activity, moves stage forward, sets `nextFollowUp` and creates a task; progress persists per day on the device.
- **Next-best actions** (pure, tested, `logic.ts`): overdue follow-ups, hot leads with no contact, meetings without outcome, quotes awaiting reply, renewals soon.
- **WhatsApp** (`WhatsAppSheet.tsx`, `whatsapp.ts`): 7 Arabic templates + sheet templates, auto-filled, wa.me link with encoded text, logs via `api.logWhatsApp`.
- **Quick add** from anywhere: top-bar "إضافة" menu, mobile dock "+", key **N** (one line "name phone"); Shift+N = full form.
- **Ctrl+K palette** (also `/`): clients, pages, actions; ranked + Arabic-folded; Shift+Enter on a client opens WhatsApp.
- **Shell**: nameplate + slim top bar + numbered left/right index rail (desktop); bottom dock with centre "+" (mobile). `G` then 1-9 jumps to pages.
- **Login**: editorial front-page split layout; `/welcome` redirects to `/login`. Three.js removed (dependency left in package.json but unused; no chunk).
- **«كيف يعمل؟»** corner button -> side panel (flow lead -> follow-up -> deal -> client -> billing, where data lives, top-5 shortcuts) + spotlight step tour (6 steps, first-run once per user).
- All other pages (clients, pipeline, tasks, schedule, companies, reports, templates, activity, inbox, announcements, settings, profile, billing, lead drawer) kept and restyled. Old workspace is at `/overview`.

## How to use
`npx vite --mode mock` (or `npx vite build --mode mock --base ./` -> `dist/`). Login: any email (nour@magmafy.com / abdallah@magmafy.com), code `123456`.

## Verification
- `npx tsc -b` clean, `npx eslint src` clean, `npx vitest run`: 127 tests passing (incl. 15+5+4+4+2 new in focus, whatsapp, guide, palette, nav).
- `npx vite build --mode mock --base ./` OK.
- Playwright (desktop 1440 + mobile 390): login, queue flow (progress 0/3 -> 1/3), WhatsApp sheet, palette, quick add, guide, step tour, all 15 routes
  render non-empty, G+3 chord navigates, no console errors, no horizontal overflow on mobile. Screenshots in `shots/`.

## Known gaps
- Demo mode has no quotes, so the "quote awaiting reply" action only appears with the real backend.
- Some deep legacy components (reports charts, billing editor) keep their old internal layout, only recolored by tokens.
- On phones the help button shrinks to "؟" to avoid covering content.
- `three` remains listed in package.json (cannot edit deps); it is not bundled.
