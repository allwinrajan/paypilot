// AI tasks for PayPilot. Every function here goes through src/lib/ai.ts.
// The AI only extracts data and writes wording. Amounts, dates and guardrail checks are done in code.
import "server-only";
import { AIError, generateJSON, generateText } from "./ai";
import type { Client, Invoice } from "./db";
import type { Guardrails, Plan, PlanParams } from "./guardrails";
import { round2 } from "./guardrails";

const money = (n: number, c = "USD") => `${c === "USD" ? "$" : c + " "}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const str = (v: unknown, field: string, max = 400): string => {
  if (typeof v !== "string" || !v.trim()) throw new Error(`"${field}" must be a non-empty string`);
  return v.trim().slice(0, max);
};

// ---------- 1. Chat: plain English -> invoice fields ----------

export interface InvoiceDraft {
  clientName: string;
  clientEmail: string | null;
  description: string;
  amount: number;
  currency: string;
  dueInDays: number;
}

export async function parseInvoiceRequest(message: string, knownClients: string[]): Promise<InvoiceDraft> {
  return generateJSON({
    system:
      "You turn a freelancer's plain-English request into invoice fields. Never invent an amount. " +
      "If the due date is not given, use 14 days. If the currency is not given, use USD.",
    prompt:
      `Known clients: ${knownClients.join("; ") || "none"}.\n` +
      `If the request names one of these clients (even partially), use that exact name.\n\n` +
      `Request: """${message.slice(0, 1000)}"""\n\n` +
      `Return {"clientName": string, "clientEmail": string|null, "description": string, ` +
      `"amount": number, "currency": string (3-letter code), "dueInDays": integer}.`,
    validate: (d) => {
      const o = d as Record<string, unknown>;
      const amount = Number(o.amount);
      const dueInDays = Math.round(Number(o.dueInDays ?? 14));
      if (!Number.isFinite(amount)) throw new Error('"amount" must be a number');
      if (!Number.isFinite(dueInDays)) throw new Error('"dueInDays" must be an integer');
      const email = typeof o.clientEmail === "string" && /.+@.+\..+/.test(o.clientEmail) ? o.clientEmail.trim() : null;
      return {
        clientName: str(o.clientName, "clientName", 120),
        clientEmail: email,
        description: str(o.description, "description", 200),
        amount: round2(amount),
        currency: String(o.currency ?? "USD").toUpperCase().slice(0, 3),
        dueInDays,
      };
    },
  });
}

// ---------- 2. Agent: explain why it is acting on an overdue invoice ----------

export interface OverdueExplanation {
  reasoning: string[];
  message: string;
  recommended: string | null;
}

export async function explainOverdue(
  invoice: Invoice,
  client: Client,
  daysOverdue: number,
  options: Plan[],
  g: Guardrails,
  ownerName: string,
): Promise<OverdueExplanation> {
  const history =
    client.onTime + client.late === 0
      ? "new client, no payment history"
      : `${client.onTime} invoices paid on time, ${client.late} paid late (average ${client.avgDaysLate} days late)`;
  const optionText = options
    .map((p) => `${p.id}: ${p.title} - ${p.payments.map((x) => `${money(x.amount)} by ${x.dueDate}`).join(", ")}`)
    .join("\n");

  try {
    return await generateJSON({
      system:
        "You are PayPilot, a calm, polite collections assistant working for a freelancer. " +
        "You explain your reasoning in short plain sentences and never threaten or shame clients.",
      prompt:
        `Freelancer: ${ownerName}\nClient: ${client.name} (${client.country}), history: ${history}.\n` +
        `Invoice: "${invoice.description}", ${money(invoice.amount)}, ${daysOverdue} days overdue.\n` +
        `Freelancer's rules: first payment at least ${g.minUpfrontPct}%, at most ${g.maxInstallments} payments, ` +
        `everything paid within ${g.maxDays} days, discount at most ${g.maxDiscountPct}%.\n` +
        `Payment plans already prepared (do not change the numbers):\n${optionText}\n\n` +
        `Return {"reasoning": [2 to 4 short sentences for the freelancer explaining why you are offering a plan now and ` +
        `which plan suits this client], "message": "a friendly 2-3 sentence note to the client offering these plans", ` +
        `"recommended": one of ${JSON.stringify(options.map((o) => o.id))}}.`,
      validate: (d) => {
        const o = d as Record<string, unknown>;
        if (!Array.isArray(o.reasoning) || o.reasoning.length === 0) throw new Error('"reasoning" must be a non-empty array');
        const reasoning = o.reasoning.slice(0, 4).map((r, i) => str(r, `reasoning[${i}]`, 300));
        const recommended = options.some((p) => p.id === o.recommended) ? String(o.recommended) : null;
        return { reasoning, message: str(o.message, "message", 700), recommended };
      },
    });
  } catch (err) {
    // Fallback: rule-based explanation, so the demo never breaks on bad AI output.
    console.warn("explainOverdue fallback:", err instanceof Error ? err.message : err);
    const flexible = client.late > client.onTime ? options[options.length - 1] : options[0];
    return {
      reasoning: [
        `This invoice is ${daysOverdue} days overdue.`,
        `Payment history: ${history}.`,
        `Offering a plan inside your rules is more likely to get paid than another reminder.`,
      ],
      message: `Hi ${client.name}, the invoice for "${invoice.description}" is now ${daysOverdue} days past due. To make it easier, ${ownerName} has approved a few payment plans below. Pick the one that works best for you.`,
      recommended: flexible?.id ?? null,
    };
  }
}

// ---------- 3. Client's own request -> plan parameters ----------

export async function parseClientRequest(text: string, amount: number): Promise<Partial<PlanParams> & { unclear: boolean }> {
  return generateJSON({
    system:
      "You read a client's message about how they want to pay an invoice and extract the payment plan they ask for. " +
      "Use null for anything they did not mention. Months are 30 days, weeks are 7 days.",
    prompt:
      `Invoice total: ${money(amount)}.\nClient message: """${text.slice(0, 800)}"""\n\n` +
      `Return {"installments": integer|null (total number of payments), "upfrontPct": number|null ` +
      `(percent of the total paid first; convert an amount to a percent), "spanDays": integer|null ` +
      `(days until the final payment), "discountPct": number|null (discount they ask for, in percent), ` +
      `"unclear": boolean (true if the message is not about a payment plan)}.`,
    validate: (d) => {
      const o = d as Record<string, unknown>;
      const n = (k: string) => (o[k] == null || o[k] === "" ? undefined : Number(o[k]));
      const out = { installments: n("installments"), upfrontPct: n("upfrontPct"), spanDays: n("spanDays"), discountPct: n("discountPct") };
      for (const [k, v] of Object.entries(out)) if (v !== undefined && !Number.isFinite(v)) throw new Error(`"${k}" must be a number or null`);
      return { ...out, unclear: o.unclear === true };
    },
  });
}

// ---------- 4. Owner summary after agreement ----------

export async function ownerSummary(client: Client, invoice: Invoice, plan: Plan, howAgreed: string): Promise<string> {
  const schedule = plan.payments.map((p) => `${money(p.amount)} due ${p.dueDate}`).join("; ");
  try {
    return (
      await generateText({
        system: "You write short, factual updates for a freelancer. No greetings, no markdown.",
        prompt:
          `Write 2-3 sentences summarising what was agreed and why it is a good outcome.\n` +
          `Client: ${client.name}. Original invoice: "${invoice.description}" ${money(invoice.amount)}.\n` +
          `Agreed plan: ${plan.title}, total ${money(plan.total)}${plan.params.discountPct ? ` (${plan.params.discountPct}% discount)` : ""}. ` +
          `Schedule: ${schedule}. How it was agreed: ${howAgreed}.`,
      })
    ).trim();
  } catch (err) {
    if (!(err instanceof AIError)) throw err;
    return `${client.name} agreed to "${plan.title}" for ${money(plan.total)}: ${schedule}. ${howAgreed}. PayPal invoices were created for each payment.`;
  }
}

export { money };
