# PayPilot: project memory
## Pitch (CURRENT, may change)
PayPilot: for freelancers billing international clients. The freelancer sets guardrails once. When an invoice goes overdue, an AI agent explains why it is acting, offers the client a payment plan on a short chat page, negotiates within the guardrails, and creates PayPal installment invoices on agreement. Anything outside the guardrails goes to the freelancer for approval.
## Core design rule
Guardrails are enforced in plain code (validation function), never by the AI. The AI only writes wording and proposes plans; every proposal is validated before it is shown or accepted.
## Context change rule
The user may change the idea, audience, features, or stack at any time. When they do: ask at most 2 clarifying questions, update this file, move the old idea to "Previous versions", re-check against the hackathon rules and judging criteria, tell me what code can be reused, and warn me honestly if the change is too big for the remaining time.
## Hackathon rules to respect
- Must use PayPal developer platform (sandbox) + an AI model; PayPal must be central.
- Public GitHub repo with an MIT LICENSE visible in the About section.
- Working demo: hosted URL or complete run instructions in README.
- Demo video under 3 min, public on YouTube, no copyrighted music or third-party logos.
- English only. Never commit API keys (.env in .gitignore, provide .env.example).
- Built during the Submission Period (Oct 1 - Nov 12, 2026).
## Judging (each 20%)
Technology, Design, Potential Impact, Innovation, Presentation (end-to-end demo).
## Stack
Next.js (TypeScript) full-stack, SQLite, PayPal Invoicing API (sandbox), Google Gemini API free tier via official @google/genai SDK (env AI_API_KEY, AI_MODEL; all AI calls go through src/lib/ai.ts so the provider can be swapped), AG Grid for the invoice table, deploy on Render.
## Features (current scope; changes need my approval)
1. Chat box: plain English -> PayPal sandbox invoice
2. Dashboard (AG Grid): draft/sent/paid/overdue, synced from PayPal
3. Guardrails form (min upfront %, max installments, max days, max discount %)
4. Agent: detects overdue invoices, explains reasoning in plain words
5. Client negotiation page (shareable link) with AI chat
6. On agreement: create one PayPal invoice per installment, update dashboard
7. Owner summary of what was agreed and why
8. Seeded demo clients with different payment histories
Fallback if time runs short: client picks from 3 fixed plan options instead of free negotiation.
Skip: real email sending, login, multi-currency (mention as "next").
Negotiation design (decided 2026-11-10): hybrid. Client sees 3 code-built plans + can type own request; AI only converts request to numbers (installments, upfrontPct, spanDays, discountPct); code builds + validates; outside rules -> owner approval queue. AI never computes amounts or dates.
## Design
UI inspired by a modern agent-dashboard layout (sidebar, greeting, stat cards, command box, approvals, activity), own PayPilot branding. Light theme, ~15% glassmorphism (glass / glass-strong utilities in globals.css). Do not copy third-party branding.
## Roadmap
- Day 1 (Nov 8-9): scaffold, one sandbox invoice via API, blank deploy to Render
- Day 2 (Nov 9-10): chat -> invoice, store + status sync, seed data, guardrails form
- Day 3 (Nov 10-11): agent reasoning, negotiation page, installment invoices, AG Grid dashboard
- Day 4 (Nov 11-12): UI polish, run full flow 3x, README, screenshots, video, submit
## Demo flow (video)
Set guardrails -> create invoice -> invoice goes overdue -> agent explains -> client negotiates -> installment invoices appear -> dashboard updates.
## Previous versions
- Stack until 2026-11-10: Claude API (ANTHROPIC_API_KEY, CLAUDE_MODEL). Switched to Gemini free tier; no AI code existed yet, so nothing to migrate.
## Progress log
(Update at the end of every session: done, next, known bugs.)

### 2026-11-10 (Day 1 work, done late)
- Done: CLAUDE.md, MIT LICENSE (already present), .gitignore (.env*, *.db; .env.example allowed), .env.example. Next.js 16 + TS + Tailwind scaffold. Placeholder UI (chat left, sample invoice table right). Server-side PayPal client in src/lib/paypal.ts (OAuth token cache, createDraftInvoice, sendInvoice, getInvoice). Test route /api/paypal/test (?send=1 also sends). README skeleton. npm run build passes.
- Not verified yet: a real sandbox invoice (needs PayPal keys in .env). Render deploy not done.
- Next: fill .env, hit /api/paypal/test, push to GitHub, blank Render deploy; then Day 2 (chat -> invoice, SQLite, seed data, guardrails form).
- Known issues: about 1 day behind roadmap (Day 1 items finishing on Nov 10). Fallback plan (3 fixed plan options) may be needed.

### 2026-11-10 (AI provider swap)
- Done: switched AI provider to Google Gemini. src/lib/ai.ts exposes generateText({system,prompt,json}) and generateJSON({system,prompt,validate}) (strict JSON, strips code fences, validates shape, retries once, clear error). /api/ai-test route (?json=1 tests JSON). Env vars now AI_API_KEY / AI_MODEL.
- Rule: every AI call must go through src/lib/ai.ts. Use generateJSON for invoice parsing and negotiation proposals, then run guardrail checks in plain code on the parsed result.
- Next: fill AI_API_KEY / AI_MODEL in .env, hit /api/ai-test; then Day 2 chat -> invoice.

### 2026-11-10 (connections verified)
- PayPal sandbox: /api/paypal/test creates a real DRAFT invoice (INV2-UTNT-UDJM-WUWE-YPSW, $120). Gemini: /api/ai-test text + JSON both OK (gemini-3.6-flash).
- Gotcha: ticking Invoicing on an existing sandbox app never granted the invoicing scope (403 NOT_AUTHORIZED). Fix: new Merchant app linked to the Business sandbox account, Invoicing ticked. Restart dev server after changing keys (token is cached in memory).
- Next: Day 2 chat -> invoice (generateJSON + plain-code validation -> createDraftInvoice), SQLite store, seed data, guardrails form.

### 2026-11-10 (all 8 features built)
- Done: SQLite (better-sqlite3 pinned 11.10.0: newer versions have no Node 20 Windows prebuild) with seed data; guardrails.ts (buildPlan/validatePlan/standardPlans, pure code); agent.ts (AI prompts with rule-based fallbacks); service.ts (chat->invoice, overdue agent, client request, owner approval, installment invoices + cancel original, PayPal sync); API routes; glass UI: Home dashboard, Invoices (AG Grid v36), Clients, Guardrails (live preview), public /pay/[token] client page (polls every 5s; owner dashboard polls every 8s).
- Verified against real Gemini + PayPal sandbox: chat->invoice (#0005), agent explanations, client choose plan -> 2 installment invoices (#0003, #0004) with pay links, out-of-rules request -> approval queue, EUR request blocked by code. Build + lint clean.
- Next.js 16 note: cacheComponents is on; every DB-reading GET route calls await connection(). Dynamic page params need Suspense.
- Gemini free tier returns 503 'high demand' at times: ai.ts retries 2x (1.5s, 4s); agent.ts falls back to template text.
- Next: set PAYPAL_TEST_RECIPIENT_EMAIL, push to GitHub, deploy to Render, run full flow 3x, screenshots, video, Devpost submission.
- Known: local DB contains test data (use Guardrails > Reset demo data before recording). Render free disk resets on redeploy (DB re-seeds itself).
