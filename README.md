# PayPilot

AI payment plans for freelancers billing international clients, built on the PayPal Invoicing API.

The freelancer sets guardrails once (minimum upfront %, maximum installments, maximum days, maximum discount). When an invoice goes overdue, an AI agent explains why it is acting, offers the client a payment plan on a short chat page, negotiates within those guardrails, and creates PayPal installment invoices once both sides agree. Anything outside the guardrails goes to the freelancer for approval.

**Design rule:** guardrails are enforced in plain code, never by the AI. The AI writes wording and proposes plans; every proposal is validated before it is shown or accepted.

> Status: early development (PayPal AI Hackathon 2026). Hosted demo link and video: _coming soon_.

## Tech stack

- Next.js (TypeScript, App Router), Tailwind CSS
- PayPal Invoicing API v2 (sandbox)
- Claude API (model set by `CLAUDE_MODEL`)
- SQLite, AG Grid (planned)

## Run locally

Requirements: Node.js 20+, a free PayPal developer account, an Anthropic API key.

```bash
git clone https://github.com/allwinrajan/paypilot.git
cd paypilot
npm install
cp .env.example .env   # then fill in the values (see below)
npm run dev
```

Open http://localhost:3000.

### Environment variables

| Variable | Where to get it |
| --- | --- |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | developer.paypal.com → Apps & Credentials → **Sandbox** → create an app → copy Client ID and Secret |
| `PAYPAL_MODE` | Keep as `sandbox` |
| `PAYPAL_TEST_RECIPIENT_EMAIL` | Optional. developer.paypal.com → Testing Tools → Sandbox Accounts → email of the **Personal** account |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `CLAUDE_MODEL` | Claude model ID, default `claude-opus-5-5` |

### Check the PayPal connection

With the dev server running, open:

- http://localhost:3000/api/paypal/test creates one draft sandbox invoice
- http://localhost:3000/api/paypal/test?send=1 creates one and sends it

A response with `"ok": true` and an invoice `id` means PayPal is connected. The invoice is listed under the sandbox **Business** account at https://www.sandbox.paypal.com.

## Roadmap

- [x] Project scaffold, PayPal sandbox invoice via API
- [ ] Plain-English chat → PayPal invoice
- [ ] Invoice dashboard synced from PayPal
- [ ] Guardrails form + validation
- [ ] Overdue agent + client negotiation page
- [ ] Installment invoices on agreement

Next (out of hackathon scope): real email sending, login, multi-currency.

## License

[MIT](LICENSE)
