// Guardrails: the freelancer's rules, enforced in PLAIN CODE (never by the AI).
// The AI may suggest plan *parameters*; this file computes exact amounts/dates and checks every rule.

export interface Guardrails {
  minUpfrontPct: number; // first payment must be at least this % of the total
  maxInstallments: number;
  maxDays: number; // last payment no later than this many days from today
  maxDiscountPct: number;
}

export interface PlanParams {
  installments: number;
  upfrontPct: number; // ignored when installments = 1 (pay in full)
  spanDays: number; // days from today to the last payment
  discountPct: number;
}

export interface Payment {
  n: number;
  amount: number;
  dueDate: string; // YYYY-MM-DD
}

export interface Plan {
  id: string; // "A" | "B" | "C" | "custom"
  title: string;
  params: PlanParams;
  originalAmount: number;
  total: number; // after discount
  payments: Payment[];
}

/** Days the first payment of a plan is due in (the "upfront" payment). */
export const UPFRONT_DUE_DAYS = 3;

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`)) / 86_400_000);
}

/** Turns plan parameters into an exact payment schedule. Pure arithmetic, no AI. */
export function buildPlan(
  id: string,
  title: string,
  originalAmount: number,
  params: PlanParams,
  today = todayISO(),
): Plan {
  const installments = Math.max(1, Math.round(params.installments));
  const spanDays = Math.max(1, Math.round(params.spanDays));
  const total = round2(originalAmount * (1 - params.discountPct / 100));
  const payments: Payment[] = [];

  if (installments === 1) {
    payments.push({ n: 1, amount: total, dueDate: addDays(today, spanDays) });
  } else {
    const upfront = round2((total * params.upfrontPct) / 100);
    payments.push({ n: 1, amount: upfront, dueDate: addDays(today, Math.min(UPFRONT_DUE_DAYS, spanDays)) });
    const rest = installments - 1;
    const each = round2((total - upfront) / rest);
    for (let i = 1; i <= rest; i++) {
      const isLast = i === rest;
      const paidSoFar = payments.reduce((s, p) => s + p.amount, 0);
      payments.push({
        n: i + 1,
        amount: isLast ? round2(total - paidSoFar) : each, // last one absorbs rounding cents
        dueDate: addDays(today, Math.round((spanDays * i) / rest)),
      });
    }
  }
  return { id, title, params: { ...params, installments, spanDays }, originalAmount, total, payments };
}

/** Checks a plan against the guardrails. Returns plain-English reasons for every broken rule. */
export function validatePlan(plan: Plan, g: Guardrails, today = todayISO()): string[] {
  const v: string[] = [];
  const { payments, total } = plan;
  const count = payments.length;

  if (count < 1) v.push("The plan has no payments.");
  if (count > g.maxInstallments) v.push(`${count} payments is more than the limit of ${g.maxInstallments}.`);
  if (plan.params.discountPct < 0) v.push("Discount cannot be negative.");
  if (plan.params.discountPct > g.maxDiscountPct)
    v.push(`A ${plan.params.discountPct}% discount is more than the ${g.maxDiscountPct}% limit.`);

  const expectedTotal = round2(plan.originalAmount * (1 - plan.params.discountPct / 100));
  const sum = round2(payments.reduce((s, p) => s + p.amount, 0));
  if (Math.abs(sum - total) > 0.01 || Math.abs(total - expectedTotal) > 0.01)
    v.push("Payment amounts do not add up to the agreed total.");
  if (payments.some((p) => !(p.amount > 0))) v.push("Every payment must be more than zero.");

  if (count > 1 && total > 0) {
    const upfrontPct = (payments[0].amount / total) * 100;
    if (upfrontPct + 1e-9 < g.minUpfrontPct)
      v.push(`The first payment is ${Math.round(upfrontPct)}%, below the ${g.minUpfrontPct}% minimum upfront.`);
  }

  const last = payments[count - 1];
  if (last && daysBetween(today, last.dueDate) > g.maxDays)
    v.push(`The last payment is ${daysBetween(today, last.dueDate)} days away; the limit is ${g.maxDays} days.`);
  for (let i = 0; i < count; i++) {
    if (payments[i].dueDate < today) v.push(`Payment ${i + 1} is due in the past.`);
    if (i > 0 && payments[i].dueDate < payments[i - 1].dueDate) v.push("Payment dates must be in order.");
  }
  return v;
}

/** The three standard offers, generated from the guardrails. Only plans that pass validation are returned. */
export function standardPlans(amount: number, g: Guardrails, today = todayISO()): Plan[] {
  const candidates: Plan[] = [
    buildPlan("A", "Settle this week", amount, {
      installments: 1,
      upfrontPct: 100,
      spanDays: Math.min(7, g.maxDays),
      discountPct: Math.min(2, g.maxDiscountPct),
    }, today),
    buildPlan("B", "Two payments", amount, {
      installments: 2,
      upfrontPct: Math.max(g.minUpfrontPct, 50),
      spanDays: Math.min(30, g.maxDays),
      discountPct: 0,
    }, today),
    buildPlan("C", "Most flexible", amount, {
      installments: g.maxInstallments,
      upfrontPct: g.minUpfrontPct,
      spanDays: g.maxDays,
      discountPct: 0,
    }, today),
  ];
  const seen = new Set<string>();
  return candidates.filter((p) => {
    const key = JSON.stringify(p.payments.map((x) => [x.amount, x.dueDate]));
    if (seen.has(key) || validatePlan(p, g, today).length > 0) return false;
    seen.add(key);
    return true;
  });
}

export function validateGuardrails(input: unknown): Guardrails {
  const o = (input ?? {}) as Record<string, unknown>;
  const num = (k: string, min: number, max: number) => {
    const n = Number(o[k]);
    if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${k} must be a number between ${min} and ${max}`);
    return n;
  };
  return {
    minUpfrontPct: num("minUpfrontPct", 0, 100),
    maxInstallments: Math.round(num("maxInstallments", 1, 12)),
    maxDays: Math.round(num("maxDays", 1, 365)),
    maxDiscountPct: num("maxDiscountPct", 0, 50),
  };
}
