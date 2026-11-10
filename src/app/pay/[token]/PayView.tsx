"use client";
import { ArrowUp, BadgeCheck, CalendarClock, CheckCircle2, ExternalLink, Hourglass, Lock, Sparkles, Star } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/AppShell";
import { api, Avatar, Button, GlassCard, money, niceDate, Spinner, StatusPill, useData, useToast } from "@/components/ui";
import type { Plan } from "@/lib/guardrails";
import type { PublicNegotiation } from "@/lib/service";

function PlanCard({
  plan,
  recommended,
  onChoose,
  disabled,
}: {
  plan: Plan;
  recommended: boolean;
  onChoose: (p: Plan) => Promise<void>;
  disabled: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const custom = plan.id === "custom";
  return (
    <div
      className={`glass relative flex flex-col gap-4 rounded-2xl p-5 transition ${
        recommended ? "ring-2 ring-blue-500/50" : custom ? "ring-2 ring-emerald-500/40" : ""
      }`}
    >
      {(recommended || custom) && (
        <span
          className={`absolute -top-2.5 left-5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white shadow ${
            custom ? "bg-emerald-600" : "bg-blue-600"
          }`}
        >
          {custom ? <BadgeCheck className="size-3" /> : <Star className="size-3" />} {custom ? "Your plan" : "Recommended"}
        </span>
      )}
      <div>
        <p className="text-sm font-medium text-slate-600">{plan.title}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{money(plan.total)}</p>
        <p className="text-xs text-slate-500">
          {plan.payments.length === 1 ? "One payment" : `${plan.payments.length} payments`}
          {plan.params.discountPct > 0 && (
            <span className="ml-1.5 rounded-full bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">
              save {money(plan.originalAmount - plan.total)}
            </span>
          )}
        </p>
      </div>
      <ol className="flex flex-1 flex-col gap-2">
        {plan.payments.map((p) => (
          <li key={p.n} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-slate-600">
              <CalendarClock className="size-3.5 text-slate-400" /> {niceDate(p.dueDate)}
            </span>
            <span className="font-medium text-slate-900 tabular-nums">{money(p.amount)}</span>
          </li>
        ))}
      </ol>
      {confirming ? (
        <div className="flex flex-col gap-2">
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onChoose(plan);
              setBusy(false);
              setConfirming(false);
            }}
          >
            Confirm plan
          </Button>
          <button onClick={() => setConfirming(false)} disabled={busy} className="text-xs text-slate-500 hover:underline">
            Cancel
          </button>
        </div>
      ) : (
        <Button variant={recommended || custom ? "primary" : "secondary"} onClick={() => setConfirming(true)} disabled={disabled}>
          Choose this plan
        </Button>
      )}
    </div>
  );
}

export function PayView({ token }: { token: string }) {
  const { data, error, refresh } = useData<PublicNegotiation>(`/api/negotiations/${token}`, 5000);
  const toast = useToast();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  if (error && !data)
    return (
      <div className="mx-auto mt-24 max-w-md px-4">
        <GlassCard className="p-6 text-center text-sm text-slate-600">{error}</GlassCard>
      </div>
    );
  if (!data) return <Spinner label="Loading your payment options" />;

  const { invoice, ownerName } = data;
  const agreed = data.status === "agreed";
  const pending = data.status === "pending_approval";
  const firstMessage = data.messages[0];
  const thread = data.messages.slice(1);

  async function choose(plan: Plan) {
    try {
      await api(`/api/negotiations/${token}/choose`, { planId: plan.id });
      await refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast.show({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    }
  }

  async function ask() {
    if (!text.trim()) return;
    setSending(true);
    try {
      await api(`/api/negotiations/${token}/request`, { message: text });
      setText("");
      await refresh();
    } catch (err) {
      toast.show({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:py-12">
      <header className="flex items-center justify-between">
        <Logo />
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <Lock className="size-3.5" /> Payments handled by PayPal
        </span>
      </header>

      {/* Invoice summary */}
      <GlassCard className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="text-sm text-slate-500">
            Invoice{invoice.number ? ` #${invoice.number}` : ""} from <span className="font-medium text-slate-700">{ownerName}</span> to{" "}
            {invoice.clientName}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{invoice.description}</h1>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{money(invoice.amount)}</p>
          {agreed ? (
            <StatusPill status="agreed" />
          ) : (
            <span className="text-sm font-medium text-rose-600">{invoice.daysOverdue} days overdue</span>
          )}
        </div>
      </GlassCard>

      {agreed && data.chosenPlan ? (
        <GlassCard className="animate-rise flex flex-col gap-5 p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Your plan is confirmed. Thank you!</h2>
              <p className="text-sm text-slate-600">
                {data.chosenPlan.title}: {money(data.chosenPlan.total)} in {data.chosenPlan.payments.length} payment
                {data.chosenPlan.payments.length > 1 ? "s" : ""}. Each one is a separate PayPal invoice.
              </p>
            </div>
          </div>
          <ol className="flex flex-col divide-y divide-slate-900/5 rounded-2xl bg-white/60 ring-1 ring-slate-900/5">
            {data.installments.map((i) => (
              <li key={i.n} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-slate-900/5 text-xs font-semibold text-slate-700">{i.n}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 tabular-nums">{money(i.amount)}</p>
                  <p className="text-xs text-slate-500">
                    Due {niceDate(i.dueDate)}
                    {i.number ? ` · Invoice #${i.number}` : ""}
                  </p>
                </div>
                <StatusPill status={i.status} />
                {i.payUrl && i.status !== "PAID" && (
                  <a
                    href={i.payUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                  >
                    Pay with PayPal <ExternalLink className="size-3" />
                  </a>
                )}
              </li>
            ))}
          </ol>
        </GlassCard>
      ) : (
        <>
          {/* Agent message */}
          {firstMessage && (
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow">
                <Sparkles className="size-4" />
              </span>
              <GlassCard className="rounded-tl-md p-4 text-[15px] leading-relaxed text-slate-700">{firstMessage.text}</GlassCard>
            </div>
          )}

          {pending && (
            <div className="glass animate-rise flex items-center gap-3 rounded-2xl p-4 text-sm text-amber-800">
              <Hourglass className="size-4 shrink-0" />
              Your request is with {ownerName} for review. This page updates by itself. You can still choose a plan below at any time.
            </div>
          )}

          {/* Plans */}
          <section className="grid gap-5 pt-2 md:grid-cols-3">
            {data.options.map((p) => (
              <PlanCard key={p.id} plan={p} recommended={p.id === data.recommended} onChoose={choose} disabled={false} />
            ))}
          </section>

          {/* Conversation */}
          <GlassCard className="flex flex-col gap-4 p-5">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">Need something different?</h2>
              <p className="text-sm text-slate-500">Describe the plan that works for you. If it is outside what I can agree to, I&apos;ll ask {ownerName}.</p>
            </div>
            {thread.length > 0 && (
              <div className="flex flex-col gap-3">
                {thread.map((m, idx) => (
                  <div key={idx} className={`flex items-end gap-2 ${m.from === "client" ? "justify-end" : ""}`}>
                    {m.from !== "client" && (
                      m.from === "owner" ? (
                        <Avatar name={ownerName} size="sm" />
                      ) : (
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 text-white">
                          <Sparkles className="size-3.5" />
                        </span>
                      )
                    )}
                    <p
                      className={`animate-rise max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                        m.from === "client"
                          ? "rounded-br-md bg-blue-600 text-white"
                          : m.from === "owner"
                            ? "rounded-bl-md bg-amber-50 text-amber-900 ring-1 ring-amber-100"
                            : "rounded-bl-md bg-white/80 text-slate-700 ring-1 ring-slate-900/5"
                      }`}
                    >
                      {m.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="glass-strong flex items-end gap-2 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-blue-500/30">
              <textarea
                rows={1}
                value={text}
                disabled={pending}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void ask();
                  }
                }}
                placeholder={pending ? "Waiting for a reply…" : 'e.g. "Can I pay in 3 parts, starting with $300 this week?"'}
                className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm focus:outline-none disabled:opacity-60"
              />
              <button
                onClick={ask}
                disabled={sending || pending || !text.trim()}
                aria-label="Send"
                className="flex size-8 items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-40"
              >
                {sending ? <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <ArrowUp className="size-4" />}
              </button>
            </div>
          </GlassCard>
        </>
      )}

      <p className="text-center text-xs text-slate-400">
        PayPilot is an assistant for {ownerName}. Plans are checked against {ownerName}&apos;s rules before they are offered.
      </p>
      {toast.view}
    </div>
  );
}
