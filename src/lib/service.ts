// Business logic: connects the AI (agent.ts), guardrails (plain code), the database and PayPal.
import "server-only";
import crypto from "node:crypto";
import { explainOverdue, money, ownerSummary, parseClientRequest, type InvoiceDraft } from "./agent";
import * as store from "./db";
import { addDays, buildPlan, daysBetween, type Plan, standardPlans, todayISO, validatePlan } from "./guardrails";
import { cancelInvoice, createDraftInvoice, deleteInvoice, getInvoice, sendInvoice } from "./paypal";

export class UserError extends Error {}

const now = () => new Date().toISOString();
const niceDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** In sandbox demos, every PayPal invoice goes to your sandbox Personal account so you can pay it. */
function recipientFor(client: store.Client): string {
  return process.env.PAYPAL_TEST_RECIPIENT_EMAIL || client.email;
}

/** Creates a PayPal invoice, sends it, and returns its PayPal id, number, status and pay link. */
async function createAndSend(
  client: store.Client,
  itemName: string,
  amount: number,
  dueDate: string,
  note: string,
): Promise<{ paypalId: string; paypalNumber: string | null; status: string; payUrl: string | null; warning?: string }> {
  const draft = await createDraftInvoice({
    recipientEmail: recipientFor(client),
    recipientBusinessName: client.name,
    items: [{ name: itemName.slice(0, 200), quantity: 1, unitAmount: amount }],
    dueDate,
    note,
  });
  let warning: string | undefined;
  try {
    await sendInvoice(draft.id);
  } catch (err) {
    warning = `Created in PayPal but not sent: ${err instanceof Error ? err.message : String(err)}`;
  }
  const fresh = await getInvoice(draft.id).catch(() => draft);
  return {
    paypalId: draft.id,
    paypalNumber: fresh.detail?.invoice_number ?? null,
    status: fresh.status ?? (warning ? "DRAFT" : "SENT"),
    payUrl: fresh.detail?.metadata?.recipient_view_url ?? null,
    warning,
  };
}

// ---------- Chat -> invoice ----------

/** Checks AI-extracted invoice fields in plain code before anything reaches PayPal. */
export function checkDraft(d: InvoiceDraft): string[] {
  const problems: string[] = [];
  if (!(d.amount > 0)) problems.push("I could not find an amount. Try e.g. \"$1,200\".");
  if (d.amount > 100_000) problems.push("Amounts above $100,000 are not supported in this demo.");
  if (d.currency !== "USD") problems.push(`Only USD is supported for now (multi-currency is coming next). You asked for ${d.currency}.`);
  if (d.dueInDays < 1 || d.dueInDays > 180) problems.push("Due date must be between 1 and 180 days from today.");
  return problems;
}

export async function createInvoiceFromDraft(d: InvoiceDraft) {
  const problems = checkDraft(d);
  if (problems.length) throw new UserError(problems.join(" "));

  let client = store.findClientByName(d.clientName);
  if (!client) {
    const slug = d.clientName.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20) || "client";
    client = store.createClient(d.clientName, d.clientEmail ?? `billing@${slug}.example.com`);
    store.logActivity("client", `Added new client ${client.name}.`);
  }
  const dueDate = addDays(todayISO(), d.dueInDays);
  const pp = await createAndSend(client, d.description, d.amount, dueDate, `Thank you for your business, ${client.name}.`);
  const invoice = store.insertInvoice({
    clientId: client.id,
    description: d.description,
    amount: d.amount,
    dueDate,
    status: pp.status,
    paypalId: pp.paypalId,
    paypalNumber: pp.paypalNumber,
    payUrl: pp.payUrl,
  });
  store.logActivity("invoice", `Created PayPal invoice #${pp.paypalNumber ?? "?"} for ${client.name}: ${money(d.amount)}, due ${dueDate}.`);
  return { invoice, warning: pp.warning };
}

// ---------- Overdue agent ----------

export async function runAgent() {
  const settings = store.getSettings();
  const today = todayISO();
  const overdue = store.listInvoices().filter((i) => i.displayStatus === "OVERDUE" && !store.getNegotiationForInvoice(i.id));
  const created: store.Negotiation[] = [];

  for (const inv of overdue) {
    const client = store.getClient(inv.clientId)!;
    const daysOverdue = daysBetween(inv.dueDate, today);
    const options = standardPlans(inv.amount, settings, today);
    if (!options.length) {
      store.logActivity("agent", `Skipped ${client.name}: no plan fits your guardrails. Please review them.`);
      continue;
    }
    const exp = await explainOverdue(inv, client, daysOverdue, options, settings, settings.ownerName);
    const neg = store.insertNegotiation({
      token: crypto.randomBytes(9).toString("base64url"),
      invoiceId: inv.id,
      reasoning: exp.reasoning,
      message: exp.message,
      options,
      recommended: exp.recommended,
      messages: [{ from: "agent", text: exp.message, ts: now() }],
    });
    created.push(neg);
    store.logActivity("agent", `Offered ${client.name} ${options.length} payment plans for ${money(inv.amount)} (${daysOverdue} days overdue).`);
  }
  if (!overdue.length) store.logActivity("agent", "Checked invoices: nothing new is overdue.");
  return { checked: overdue.length, created: created.length };
}

/** Demo helper: moves an invoice's due date into the past so the agent has something to act on. */
export function markOverdueForDemo(invoiceId: number) {
  const inv = store.getInvoiceRow(invoiceId);
  if (!inv) throw new UserError("Invoice not found.");
  if (inv.status !== "SENT" && inv.status !== "UNPAID") throw new UserError("Only sent, unpaid invoices can go overdue.");
  store.updateInvoice(invoiceId, { dueDate: addDays(todayISO(), -10) });
  store.logActivity("demo", `Demo: marked ${inv.clientName}'s invoice as 10 days overdue.`);
}

// ---------- Agreement: create installment invoices in PayPal ----------

async function acceptPlan(neg: store.Negotiation, plan: Plan, howAgreed: string, ownerApproved: boolean) {
  if (neg.status === "agreed") throw new UserError("A plan was already agreed for this invoice.");
  const settings = store.getSettings();
  // Guardrails are re-checked in code right before money moves (owner-approved exceptions skip this).
  if (!ownerApproved) {
    const violations = validatePlan(plan, settings);
    if (violations.length) throw new UserError(`This plan breaks the rules: ${violations.join(" ")}`);
  }
  const original = store.getInvoiceRow(neg.invoiceId)!;
  const client = store.getClient(original.clientId)!;
  const count = plan.payments.length;
  const warnings: string[] = [];

  for (const p of plan.payments) {
    const label = count === 1 ? `${original.description} (settlement)` : `${original.description}, payment ${p.n} of ${count}`;
    const pp = await createAndSend(client, label, p.amount, p.dueDate, `Payment plan agreed with ${settings.ownerName}: ${plan.title}.`);
    if (pp.warning) warnings.push(pp.warning);
    store.insertInvoice({
      clientId: client.id,
      description: label,
      amount: p.amount,
      dueDate: p.dueDate,
      status: pp.status,
      paypalId: pp.paypalId,
      paypalNumber: pp.paypalNumber,
      payUrl: pp.payUrl,
      parentId: original.id,
      installmentNo: p.n,
      installmentCount: count,
    });
  }

  // Replace the original invoice so the client is not billed twice.
  if (original.paypalId) {
    try {
      if (original.status === "DRAFT") await deleteInvoice(original.paypalId);
      else await cancelInvoice(original.paypalId, "Replaced by an agreed payment plan.");
    } catch (err) {
      warnings.push(`Could not cancel the original PayPal invoice: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  store.updateInvoice(original.id, { status: "REPLACED" });

  const summary = await ownerSummary(client, original, plan, howAgreed);
  const messages = [...neg.messages, { from: "system" as const, text: `Plan agreed: ${plan.title}. ${count} PayPal invoice${count > 1 ? "s" : ""} created.`, ts: now() }];
  store.updateNegotiation(neg.id, { status: "agreed", chosenPlan: plan, pendingPlan: null, pendingReasons: [], summary, messages });
  store.logActivity("agreed", `${client.name} agreed to "${plan.title}" (${money(plan.total)}). ${count} PayPal invoice${count > 1 ? "s" : ""} created.`);
  return { summary, warnings };
}

export async function clientChoosePlan(token: string, planId: string) {
  const neg = store.getNegotiationByToken(token);
  if (!neg) throw new UserError("This payment link is not valid.");
  const plan = neg.options.find((p) => p.id === planId);
  if (!plan) throw new UserError("That plan is no longer available.");
  return acceptPlan(neg, plan, "The client chose this plan on the payment page", false);
}

export async function clientRequestPlan(token: string, text: string) {
  const neg = store.getNegotiationByToken(token);
  if (!neg) throw new UserError("This payment link is not valid.");
  if (neg.status !== "open") throw new UserError("This request is already being handled.");
  const original = store.getInvoiceRow(neg.invoiceId)!;
  const settings = store.getSettings();
  const messages: store.ChatMessage[] = [...neg.messages, { from: "client", text: text.slice(0, 800), ts: now() }];

  const asked = await parseClientRequest(text, original.amount);
  if (asked.unclear) {
    messages.push({ from: "agent", text: "Sorry, I didn't catch a payment plan there. You could say, for example: \"4 payments over 3 months, starting with $300\".", ts: now() });
    store.updateNegotiation(neg.id, { messages });
    return { outcome: "unclear" as const };
  }

  // Fill anything the client did not mention from the most flexible standard plan.
  const base = neg.options.find((o) => o.id === "C")?.params ?? neg.options[neg.options.length - 1].params;
  const plan = buildPlan("custom", "Your requested plan", original.amount, {
    installments: asked.installments ?? base.installments,
    upfrontPct: asked.upfrontPct ?? base.upfrontPct,
    spanDays: asked.spanDays ?? base.spanDays,
    discountPct: asked.discountPct ?? 0,
  });
  const violations = validatePlan(plan, settings); // plain-code guardrail check
  const schedule = plan.payments.map((p) => `${money(p.amount)} by ${niceDate(p.dueDate)}`).join(", ");

  if (!violations.length) {
    const options = [...neg.options.filter((o) => o.id !== "custom"), plan];
    messages.push({ from: "agent", text: `Good news: that fits. Your plan is ${schedule}. You can accept it below.`, ts: now() });
    store.updateNegotiation(neg.id, { options, messages });
    store.logActivity("agent", `${original.clientName} proposed their own plan; it fits your guardrails.`);
    return { outcome: "fits" as const };
  }

  messages.push({
    from: "agent",
    text: `That plan (${schedule}) is outside what I can agree to on my own, so I've sent it to ${settings.ownerName} for approval. You'll see the answer here. Meanwhile, any of the plans above can be accepted right away.`,
    ts: now(),
  });
  store.updateNegotiation(neg.id, { status: "pending_approval", pendingPlan: plan, pendingReasons: violations, messages });
  store.logActivity("approval", `${original.clientName} asked for a plan outside your guardrails. It needs your OK.`);
  return { outcome: "needs_approval" as const, violations };
}

export async function ownerDecision(negotiationId: number, approve: boolean) {
  const neg = store.getNegotiation(negotiationId);
  if (!neg || neg.status !== "pending_approval" || !neg.pendingPlan) throw new UserError("Nothing is waiting for approval here.");
  const settings = store.getSettings();
  if (approve) {
    const messages = [...neg.messages, { from: "owner" as const, text: `${settings.ownerName} approved your requested plan.`, ts: now() }];
    store.updateNegotiation(neg.id, { messages });
    return acceptPlan({ ...neg, messages }, neg.pendingPlan, `${settings.ownerName} approved the client's request as an exception`, true);
  }
  const messages = [
    ...neg.messages,
    { from: "owner" as const, text: `${settings.ownerName} couldn't approve that plan. Please choose one of the plans above.`, ts: now() },
  ];
  store.updateNegotiation(neg.id, { status: "open", pendingPlan: null, pendingReasons: [], messages });
  store.logActivity("approval", `You declined a request from ${store.getInvoiceRow(neg.invoiceId)?.clientName}.`);
  return { summary: null, warnings: [] };
}

// ---------- Status sync from PayPal ----------

const FINAL = new Set(["PAID", "MARKED_AS_PAID", "CANCELLED", "REFUNDED", "REPLACED"]);

export async function syncFromPayPal() {
  const targets = store.listInvoices().filter((i) => i.paypalId && !FINAL.has(i.status));
  let changed = 0;
  for (const inv of targets) {
    try {
      const pp = await getInvoice(inv.paypalId!);
      const status = pp.status === "MARKED_AS_PAID" ? "PAID" : pp.status;
      if (status !== inv.status) {
        store.updateInvoice(inv.id, { status });
        changed++;
        if (status === "PAID") store.logActivity("paid", `${inv.clientName} paid ${money(inv.amount)} on PayPal.`);
      }
      const url = pp.detail?.metadata?.recipient_view_url;
      if (url && url !== inv.payUrl) store.updateInvoice(inv.id, { payUrl: url });
    } catch (err) {
      console.warn("sync failed for", inv.paypalId, err instanceof Error ? err.message : err);
    }
  }
  return { checked: targets.length, changed };
}

// ---------- Dashboard data ----------

export function dashboardData() {
  const invoices = store.listInvoices();
  const negotiations = store.listNegotiations().map((n) => {
    const inv = invoices.find((i) => i.id === n.invoiceId);
    return { ...n, clientName: inv?.clientName ?? "", amount: inv?.amount ?? 0, description: inv?.description ?? "" };
  });
  const open = invoices.filter((i) => ["SENT", "UNPAID", "OVERDUE"].includes(i.displayStatus));
  const overdue = invoices.filter((i) => i.displayStatus === "OVERDUE");
  const recovered = negotiations.filter((n) => n.chosenPlan).reduce((s, n) => s + (n.chosenPlan?.total ?? 0), 0);
  return {
    today: todayISO(),
    settings: store.getSettings(),
    stats: {
      outstanding: open.reduce((s, i) => s + i.amount, 0),
      outstandingCount: open.length,
      overdue: overdue.reduce((s, i) => s + i.amount, 0),
      overdueCount: overdue.length,
      recovered,
      plansAgreed: negotiations.filter((n) => n.status === "agreed").length,
      waiting: negotiations.filter((n) => n.status === "pending_approval").length,
    },
    invoices,
    negotiations,
    clients: store.listClients(),
    activity: store.listActivity(),
  };
}

export type DashboardData = ReturnType<typeof dashboardData>;

/** What the client sees on the payment page (no internal reasoning). */
export function publicNegotiation(token: string) {
  const neg = store.getNegotiationByToken(token);
  if (!neg) return null;
  const invoice = store.getInvoiceRow(neg.invoiceId)!;
  const installments = store
    .listInvoices()
    .filter((i) => i.parentId === invoice.id)
    .sort((a, b) => (a.installmentNo ?? 0) - (b.installmentNo ?? 0));
  return {
    ownerName: store.getSettings().ownerName,
    status: neg.status,
    invoice: {
      description: invoice.description,
      amount: invoice.amount,
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      number: invoice.paypalNumber,
      clientName: invoice.clientName,
      daysOverdue: Math.max(0, daysBetween(invoice.dueDate, todayISO())),
    },
    options: neg.options,
    recommended: neg.recommended,
    messages: neg.messages,
    pendingPlan: neg.pendingPlan,
    chosenPlan: neg.chosenPlan,
    installments: installments.map((i) => ({
      n: i.installmentNo,
      amount: i.amount,
      dueDate: i.dueDate,
      status: i.displayStatus,
      number: i.paypalNumber,
      payUrl: i.payUrl,
    })),
  };
}
export type PublicNegotiation = NonNullable<ReturnType<typeof publicNegotiation>>;
