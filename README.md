# PayPilot

AI payment plans for freelancers billing international clients, built on the PayPal Invoicing API.

The freelancer sets guardrails once (minimum upfront %, maximum installments, maximum days, maximum discount). When an invoice goes overdue, an AI agent explains why it is acting, offers the client payment plans on a short page, negotiates within those guardrails, and creates one PayPal invoice per installment once the client agrees. Anything outside the guardrails goes to the freelancer for approval.

**Design rule:** guardrails are enforced in plain code, never by the AI. The AI extracts data and writes wording; code calculates every amount and date and validates each plan before it is shown and again before PayPal invoices are created.

> Built for the PayPal AI Hackathon 2026. Hosted demo link and video: _coming soon_.

## Features

- **Plain English → PayPal invoice.** Type "Bill Maple & Finch $1,500 for website copy, due in 14 days". The AI reads it, code checks it, you confirm, and the invoice is created and sent through PayPal.
- **Dashboard.** Outstanding, overdue and recovered totals, an AG Grid invoice table with live PayPal status, and an activity feed.
- **Guardrails.** A form for your rules with a live preview of the plans they allow.
- **Overdue agent.** Finds overdue invoices, explains its reasoning in plain words (using the client's payment history), and prepares three plans inside your rules.
- **Client payment page.** A shareable link where the client picks a plan, or describes their own. Requests that fit are offered right away; requests that break a rule go to your **Needs your approval** list.
- **Installment invoices.** On agreement, one PayPal invoice per payment is created and sent, and the original invoice is cancelled so the client is never billed twice.
- **Owner summary.** A short AI summary of what was agreed and why.
- **Demo data.** Five fictional international clients with different payment histories.

## How it works

```
Chat text ──► AI extracts fields ──► code checks them ──► you confirm ──► PayPal invoice
Overdue invoice ──► code builds 3 plans from your guardrails ──► AI explains + writes the message
Client request ──► AI turns it into numbers ──► code builds + validates the plan
      ├─ fits the rules ──► offered to the client
      └─ breaks a rule  ──► sent to you for approval
Agreement ──► code re-checks ──► one PayPal invoice per installment ──► original cancelled
```

| File | Role |
| --- | --- |
| `src/lib/guardrails.ts` | Plan building and validation (pure code, no AI) |
| `src/lib/ai.ts` | The only file that talks to the AI provider (Gemini). Strict JSON, retries, clear errors |
| `src/lib/agent.ts` | AI prompts, each with a rule-based fallback |
| `src/lib/paypal.ts` | PayPal Invoicing API v2 client (OAuth, create, send, cancel, get) |
| `src/lib/service.ts` | Business logic tying the above together |
| `src/lib/db.ts` | SQLite storage and demo seed data |

## Tech stack

- Next.js 16 (TypeScript, App Router), Tailwind CSS, lucide icons
- PayPal Invoicing API v2 (sandbox)
- Google Gemini API, free tier, through the official `@google/genai` SDK
- SQLite (`better-sqlite3`), AG Grid Community

## Run locally

Requirements: Node.js 20+, a free PayPal developer account, a free Google Gemini API key.

```bash
git clone https://github.com/allwinrajan/paypilot.git
cd paypilot
npm install
cp .env.example .env   # then fill in the values (see below)
npm run dev
```

Open http://localhost:3000. The SQLite database is created and seeded automatically in `./data`.

### Environment variables

| Variable | Where to get it |
| --- | --- |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | developer.paypal.com → Apps & Credentials → **Sandbox** → **Create App** (type Merchant, linked to your sandbox **Business** account). Make sure **Invoicing** is ticked under Features. |
| `PAYPAL_MODE` | Keep as `sandbox` |
| `PAYPAL_TEST_RECIPIENT_EMAIL` | Recommended. developer.paypal.com → Testing Tools → Sandbox Accounts → email of the **Personal** account. All demo invoices go to it, so you can log in and pay them. |
| `AI_API_KEY` | aistudio.google.com → **Get API key** → Create API key |
| `AI_MODEL` | A Gemini model ID from AI Studio, e.g. `gemini-3.6-flash` |
| `DATABASE_PATH` | Optional. Defaults to `./data/paypilot.db` |

Restart `npm run dev` after changing `.env`.

### Check the connections

- http://localhost:3000/api/paypal/test creates one draft sandbox invoice (`?send=1` also sends it)
- http://localhost:3000/api/ai-test sends one short prompt (`?json=1` tests structured JSON)

Both should return `"ok": true`.

## Try the full flow

1. **Guardrails:** check or change your rules.
2. **Home:** type an invoice in plain English, check the preview, then click **Create & send with PayPal**.
3. In the invoice table, click **Make overdue** on that invoice (demo shortcut; real invoices go overdue on their own).
4. Click **Check overdue invoices**. Read the agent's "Why I'm acting".
5. Click **Open client page**. As the client, either choose a plan, or type a request such as "6 monthly payments please".
6. A request outside your rules appears under **Needs your approval** on Home (it updates by itself). Approve or reject it.
7. When a plan is agreed, the installment invoices appear in the table and in your PayPal sandbox. Log in to https://www.sandbox.paypal.com as the Personal account to pay one, then click **Sync PayPal**.

Use **Guardrails → Reset demo data** to start over (PayPal sandbox invoices are kept).

## Next (outside hackathon scope)

Real email delivery, login and multiple freelancers, multi-currency, scheduled agent runs, PayPal webhooks instead of manual sync.

## License

[MIT](LICENSE)
