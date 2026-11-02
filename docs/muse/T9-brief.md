# Task T9: make the chatbot look like attma.bio (login + landing), so chat.attma.bio feels like the same site

Context: the chatbot (this repo, `nextjs-frontend/`) will move to **chat.attma.bio**; the main product (`/Users/martindavila/Developer/Attma`, "Attma") will live at **attma.bio**. A visitor going from one to the other must feel they never left the site. Attma already has the good design. Port its **look**, not its code paths. Read `CLAUDE.md`, `PRODUCT.md` and `docs/muse/README.md` first.

The Attma repo is **read-only reference**: read files there, never edit, run, install or commit anything in it.

## Reference files (in /Users/martindavila/Developer/Attma/nextjs-frontend/src)

- Theme tokens: `app/globals.css` (light and dark palettes, radius, sidebar, `@theme` block).
- Fonts: `lib/fonts.ts` (`fontSans`, `fontHeading`), used in `app/layout.tsx`.
- Login/register look: `app/[lang]/auth/login/page.tsx`, `components/auth/auth-form-wrapper.tsx`, `login-form.tsx`, `register-form.tsx`, `reset-password-form.tsx`.
- Landing look: `components/landing/` (`Topbar`, `Hero`, `SectionHeading`, `ProductShot`, `CtaBand`, `Footer`, `AttmaLogo`).

## 1. Shared design base

- Bring Attma's color tokens and fonts into this repo's `app/globals.css` and root layout so both sites use the same palette, type and radius, in light and dark. Map them onto the token names this repo already uses (`--primary`, `--card`, `--sidebar-*`, `text-primary-ink` for mint text) instead of renaming tokens across the app. Keep AA contrast: check mint text and muted text in both themes.
- Keep at most two font families. Use `next/font` like Attma does (no new CDN links).
- Reuse `AttmaLogo` (copy the component, keep it small).

## 2. Login, register, forgot/reset password (`app/(auth)/`)

- Replace the visual layout with Attma's (wrapper, logo, card, spacing, button styles, Google button, footer links). Keep **all behavior** of this repo: Auth.js server actions in `app/(auth)/actions.ts`, Google sign-in, redirects, error messages, the `?callbackUrl` / "keep the question through sign-in" logic, password reset flow. Do not import Attma's auth provider or its API calls.
- No em dashes in UI copy. Auth pages are not localized (English only), as today.

## 3. Landing (`app/[locale]/`)

- Restyle the hero, section headings, cards, CTA band, top bar and footer to match Attma's landing components. Keep this repo's **content and claims** (they are measured and translated in 7 locales): do not copy Attma's marketing claims, pricing or clinical copy. Do not change dictionary text unless a new label is unavoidable; if so, add it to all 7 dictionaries.
- Top bar and footer: add a link to the main product ("Attma platform", `https://attma.bio`) so users can move between the two sites. Keep the chatbot's own CTA pointing to `/chat`.
- Do not reproduce Attma's whole landing; restyle what exists, so the two look like one brand.

## 4. In-app chat

Only inherit the new tokens and fonts. Do not restyle the chat layout, the analysis card or the timeline beyond what the tokens change. Check that the analysis card's amber warnings and `text-primary-ink` still read well.

## Rules and checks

- No new npm dependencies unless a font package is truly required (prefer `next/font/google`). No `any`, comments explain why, no `.env*`, no git commits, no pushes.
- Wrap every command in `timeout`. Do not start the dev server; do not call the Model API.
- Must pass: `timeout 1200 bun --env-file=.env.local run release-gate` from `nextjs-frontend/` (lint, format, tsc, tests, build).
- Finish with: files changed, a before/after description per page (login, register, landing, chat), the contrast values you checked, and anything unsure. The reviewer will screenshot 375 px and 1440 px in light and dark.
