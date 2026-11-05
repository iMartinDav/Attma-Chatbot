# Attma: status, decisions and plan

Written November 5, 2026, after the Meta Global AI Developer Hackathon submission. It covers the work from November 2 to 5 across both repositories, why each decision was made, what is still open, and where the product goes next. [HANDOFF.md](HANDOFF.md) holds the earlier history (October 26 to November 2).

## 1. Where things stand

| Piece                                          | Where                                            | State                                             |
| ---------------------------------------------- | ------------------------------------------------ | ------------------------------------------------- |
| Research agent (this repo, public, Apache-2.0) | https://chat.attma.bio                           | Live. The hackathon submission.                   |
| Attma platform (private `Attma` repo)          | https://app.attma.bio, API on Render's free plan | Live. Sign-in now runs in the web app.            |
| attma.bio                                      | Redirects (307) to app.attma.bio                 | Interim, see the domain plan in section 5.        |
| Submission                                     | Repo, 170 s video, written answers               | Submitted. The answers are kept outside the repo. |

**Models.** The Meta Model API answers every call with 402 `billing_not_configured`. Each call is retried on OpenAI: `gpt-4o` stands in for Muse Wonder and `gpt-4o-mini` for Muse Spark (`lib/ai/providers.ts`). The submission discloses this, and the biosecurity badge names the model that actually answered. When Meta billing works, every call goes back to Muse without a code change.

## 2. What we built (November 2 to 5)

**This repo (chat.attma.bio)**

- Opened the repository: removed live credentials from the whole git history (after rotating the database password and the Blob token), removed AI co-author trailers, and added README, LICENSE, NOTICE, SECURITY, CONTRIBUTING and `.env.example`.
- Moved the app to chat.attma.bio. attma.bio redirects to the main app (`proxy.ts`, `no-store`, `Vary: Host`), and a path like `//evil.com` stays on Attma.
- Made the sign-in page match attma.bio (helix animation, logo).
- The banner rotates, and the Muse announcement comes first, in all 7 locales.
- Removed every sparkle icon and added a custom glass helix mark (`components/helix-mark.tsx`).
- Rebuilt the landing composer in the style of the large chat apps: an auto-growing box, Enter sends (but not while confirming an IME character), an honest Attach button, and icon suggestions.
- Added the OpenAI fallback. It only triggers on billing, auth, rate-limit and outage errors.
- **Biosecurity policy v3.** On the fallback model, v1 asked for a research purpose on 8 of 8 ordinary prompts ("hello" included), so the chat could not answer anything. v3 accepts greetings, questions about Attma and ordinary research (8/8), and keeps `needs_context` for unexplained dual-use work at every checkpoint, code included.

**Attma repo (app.attma.bio)**

- **The API boots again.** In the production image, `/app` belonged to root, so the ClinVar service could not create its cache folder at import time. Every Render deploy had failed since October 26. Fixed in the Dockerfile and verified by booting the image.
- **Sign-in moved to the web app.**
  - Auth.js handles Google, GitHub and email + password, against the API's own `users` table, so there is still one user store.
  - The browser gets 15-minute API tokens minted on Vercel.
  - The API accepts them only with their own secret, issuer and audience.
  - `POST /auth/session/bootstrap` creates a new user's default organization and workspace.
  - Tested with the API stopped: sign-in still lands in the app, a notice says the analysis service is starting, and the page fills in by itself once the API wakes.
- Landing: a "Research agent" button that links to chat.attma.bio, and the Muse announcement first in the banner.

**Video and submission.** A 170 s demo with generated narration and captions, built from real UI screens recorded locally on the OpenAI fallback. The written answers quote the held-out benchmark (top-1 50.5%, top-5 63%) and disclose the fallback.

## 3. Decisions and why

| Decision                                                                                                     | Why                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Rewrite history and keep the repository, rather than start a fresh one                                       | It keeps the build record (the Muse Code briefs in `docs/muse/`) while removing the leaked values.                                              |
| The OpenAI fallback only covers billing, auth, rate limits and outages                                       | The product stays usable while Meta billing is blocked, but real errors are not hidden. It is disclosed, and the badges name the actual model.  |
| Sign-in in the web app, not the API                                                                          | A free Render instance sleeps. Sign-in must never wait for it.                                                                                  |
| One `users` table, read by both the web app and the API                                                      | Two user stores would drift. The web app follows the API's rules (username slugs, verified-email linking, bcrypt hashes the API also verifies). |
| A separate token secret, issuer and audience for web-minted tokens                                           | They can be rotated independently, and they are never refresh tokens.                                                                           |
| The API still owns domain setup (organizations, the welcome notification) and password-reset emails          | The domain logic and mail templates live there. These steps run once the API is awake.                                                          |
| Passkeys removed from the login form                                                                         | They are disabled on the API, so the button only returned an error.                                                                             |
| Sign-in rate limit kept in memory, per instance                                                              | Accepted for now. bcrypt cost 12 is the main brake, and Redis would make the limit exact.                                                       |
| The biosecurity reviewer judges intent, never keywords. It fails closed, and its badge names the real model. | The trust UI must never claim a check that a different model ran, or that nobody ran.                                                           |
| Research framing, never diagnosis                                                                            | Meta's skip list excludes AI medical advice, and it is the honest description of the product.                                                   |
| Attma's ~400 uncommitted local files were never committed; pushes go from a clean clone                      | That work is half-finished (an AI SDK 7 migration, the agent inside Attma) and is backed up outside the repo.                                   |

## 4. Open items

Owner actions:

- [ ] Fix Meta Model API billing, then check one real chat on Muse.
- [ ] Suspend or delete the stray Render service "Attma" (a Node service with no settings). It fails on every push and sends the "deploy failed" emails.
- [ ] Confirm the GitHub OAuth callback is `https://app.attma.bio/api/auth/callback/github` and sign in once with GitHub.
- [ ] Replace the stale `OPENAI_API_KEY` in this repo's local `.env.local`. Production already has a working key.
- [ ] Fix GitHub Actions billing so CI runs.

Code:

- [ ] Rename the "Rank diagnoses from symptoms" suggestion (all 7 locales), because it uses diagnosis language.
- [ ] The trust card and the empty state say "Muse Spark screens every request". That is the design, but it is not what runs while the fallback is active. Make the copy follow the actual model.
- [ ] Attma: `tests/test_auth.py` imports a function that no longer exists. This was broken on main before this work.
- [ ] Attma: move the sign-in rate limit to Redis.
- [ ] Attma: users created by the web app have no `UserRegistered` event in the event store. Emit one from session bootstrap.
- [ ] Attma: remove the API's OAuth start and callback endpoints once the web sign-in has run for a release.
- [ ] Older chats here, from before October 27, still show raw tool JSON.

## 5. Where the app goes

**Domains (agreed target).**

| Host           | Serves                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------- |
| attma.bio      | The main Attma app: landing at `/`, the product behind sign-in. One domain, one login cookie. |
| app.attma.bio  | A permanent redirect to attma.bio.                                                            |
| chat.attma.bio | This open-source research agent, linked from the Attma navbar.                                |

The switch happens in one step, once the Attma app passes a browser check on its own Vercel URL. Today's redirect from attma.bio to app.attma.bio is the interim.

**Phase 1, stabilize (this week)**

1. Meta billing, then turn the fallback disclosure back into "runs on Muse".
2. The owner actions and code items above.
3. A paid Render instance or a keep-alive, so the API stops sleeping. Sign-in no longer depends on it, but every data page does.

**Phase 2, the agent inside Attma**

- Finish the `feat/agent` work: AI SDK 7, the agent core, Data → Sources ("bring your own data", copied into Attma's storage so the sandbox allow-list stays tight), the trust gate and the biosecurity reviewer.
- The rule stays: the agent never assigns ACMG classes; that is the job of Attma's reviewed clinical engine.
- One identity across attma.bio and chat.attma.bio. Today the chatbot has its own users; it should sign in against the same accounts.

**Phase 3, platform**

- Workflows: saved, re-runnable analyses built from the steps a chat already shows.
- Resumable streams for long runs.
- Credential injection, so API keys (for example AlphaGenome) never enter the sandbox.
- A full biosecurity evaluation (BioSecBench), alongside the existing guard that real research prompts are never blocked.

**Research track**

- Benchmark notebooks: the rare-disease benchmark with confidence intervals, published as a dataset on Hugging Face. They are written by us, not copied from unlicensed examples.
- A small fine-tuned workflow router (Muse Glimmer through Fireworks), with a base-versus-tuned evaluation. It needs a Fireworks key and a few hours of training.
- An AlphaGenome key, to unlock the non-coding variant workflow.
