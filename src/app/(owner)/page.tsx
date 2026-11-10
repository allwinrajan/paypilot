"use client";
// Owner home: greeting, AI invoice box, key numbers, approvals, agent work, activity and invoices.
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Copy,
  FileText,
  Hourglass,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useDashboard } from "@/components/AppShell";
import { CommandBox } from "@/components/CommandBox";
import { InvoiceGrid } from "@/components/InvoiceGrid";
import { api, Avatar, Button, GlassCard, money, niceDate, SectionTitle, Spinner, StatusPill, timeAgo, useToast } from "@/components/ui";
import type { Invoice } from "@/lib/db";
import type { DashboardData } from "@/lib/service";

type Neg = DashboardData["negotiations"][number];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Stat({ icon, label, value, hint, tone = "slate" }: { icon: ReactNode; label: string; value: string; hint: string; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-900/5 text-slate-700",
    rose: "bg-rose-50 text-rose-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-2.5 text-sm text-slate-600">
        <span className={`flex size-8 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</span>
        {label}
      </div>
      <p className="mt-3 text-[28px] leading-none font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{hint}</p>
    </GlassCard>
  );
}

function Schedule({ plan }: { plan: NonNullable<Neg["pendingPlan"]> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {plan.payments.map((p) => (
        <span key={p.n} className="rounded-lg bg-white/70 px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-900/5 tabular-nums">
          {money(p.amount)} · {niceDate(p.dueDate)}
        </span>
      ))}
    </div>
  );
}

function ApprovalItem({ n, onDecide }: { n: Neg; onDecide: (id: number, approve: boolean) => Promise<void> }) {
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);
  const decide = async (approve: boolean) => {
    setBusy(approve ? "yes" : "no");
    await onDecide(n.id, approve);
    setBusy(null);
  };
  return (
    <div className="animate-rise flex flex-col gap-3 border-t border-slate-900/5 px-5 py-4 first:border-t-0">
      <div className="flex items-start gap-3">
        <Avatar name={n.clientName} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">
            {n.clientName} asked for a plan outside your guardrails
          </p>
          <p className="text-xs text-slate-500">
            {n.description} · {money(n.amount)} · {timeAgo(n.updatedAt)}
          </p>
        </div>
      </div>
      <ul className="flex flex-col gap-1 pl-12">
        {n.pendingReasons.map((r) => (
          <li key={r} className="flex items-start gap-1.5 text-sm text-rose-700">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" /> {r}
          </li>
        ))}
      </ul>
      {n.pendingPlan && (
        <div className="pl-12">
          <Schedule plan={n.pendingPlan} />
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => decide(false)} loading={busy === "no"} disabled={busy !== null}>
          Reject
        </Button>
        <Button onClick={() => decide(true)} loading={busy === "yes"} disabled={busy !== null}>
          Approve exception
        </Button>
      </div>
    </div>
  );
}

function AgentCase({ n, notify }: { n: Neg; notify: (t: { kind: "ok" | "error"; text: string }) => void }) {
  const [open, setOpen] = useState(n.status !== "agreed");
  const link = `/pay/${n.token}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${link}`);
      notify({ kind: "ok", text: "Client link copied." });
    } catch {
      notify({ kind: "error", text: "Could not copy. Open the link and copy it from the address bar." });
    }
  };
  return (
    <div className="border-t border-slate-900/5 px-5 py-4 first:border-t-0">
      <div className="flex items-center gap-3">
        <Avatar name={n.clientName} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{n.clientName}</p>
          <p className="truncate text-xs text-slate-500">
            {n.description} · {money(n.amount)}
          </p>
        </div>
        <StatusPill status={n.status} />
        <button onClick={() => setOpen(!open)} aria-label="Toggle details" className="rounded-full p-1 text-slate-400 hover:bg-slate-900/5">
          <ChevronDown className={`size-4 transition ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        <div className="animate-rise mt-3 flex flex-col gap-3 pl-12">
          {n.summary ? (
            <div className="rounded-xl bg-emerald-50/80 p-3 text-sm text-emerald-900 ring-1 ring-emerald-100">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-emerald-700 uppercase">
                <CheckCircle2 className="size-3.5" /> What was agreed
              </p>
              {n.summary}
            </div>
          ) : (
            <div className="rounded-xl bg-white/60 p-3 ring-1 ring-slate-900/5">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-indigo-700 uppercase">
                <Sparkles className="size-3.5" /> Why I&apos;m acting
              </p>
              <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-slate-700">
                {n.reasoning.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-500">
                Offered {n.options.length} plans inside your guardrails
                {n.recommended ? `, recommended plan ${n.recommended}` : ""}.
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Link
              href={link}
              target="_blank"
              className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              Open client page <ArrowUpRight className="size-3.5" />
            </Link>
            <button onClick={copy} className="glass-strong inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white">
              <Copy className="size-3.5" /> Copy link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const ACTIVITY_ICON: Record<string, ReactNode> = {
  agent: <Bot className="size-3.5" />,
  invoice: <FileText className="size-3.5" />,
  agreed: <CheckCircle2 className="size-3.5" />,
  paid: <CircleDollarSign className="size-3.5" />,
  approval: <ShieldAlert className="size-3.5" />,
  demo: <Clock3 className="size-3.5" />,
};
const ACTIVITY_TONE: Record<string, string> = {
  agent: "bg-indigo-50 text-indigo-600",
  invoice: "bg-sky-50 text-sky-600",
  agreed: "bg-emerald-50 text-emerald-600",
  paid: "bg-emerald-50 text-emerald-600",
  approval: "bg-rose-50 text-rose-600",
  demo: "bg-amber-50 text-amber-600",
};

export default function HomePage() {
  const { data, refresh } = useDashboard();
  const toast = useToast();
  const [running, setRunning] = useState(false);
  const [syncing, setSyncing] = useState(false);

  if (!data) return <Spinner label="Loading your workspace" />;
  const { stats, settings, negotiations, activity, invoices } = data;
  const approvals = negotiations.filter((n) => n.status === "pending_approval");
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const notify = toast.show;
  const fail = (err: unknown) => notify({ kind: "error", text: err instanceof Error ? err.message : String(err) });

  async function runAgent() {
    setRunning(true);
    try {
      const r = await api<{ checked: number; created: number }>("/api/agent/run");
      notify({ kind: "ok", text: r.created ? `Agent offered payment plans on ${r.created} overdue invoice${r.created > 1 ? "s" : ""}.` : "Nothing new is overdue." });
      await refresh();
    } catch (err) {
      fail(err);
    } finally {
      setRunning(false);
    }
  }

  async function sync() {
    setSyncing(true);
    try {
      const r = await api<{ checked: number; changed: number }>("/api/invoices/sync");
      notify({ kind: "ok", text: `Synced ${r.checked} PayPal invoice${r.checked === 1 ? "" : "s"}, ${r.changed} updated.` });
      await refresh();
    } catch (err) {
      fail(err);
    } finally {
      setSyncing(false);
    }
  }

  async function decide(id: number, approve: boolean) {
    try {
      await api(`/api/approvals/${id}`, { approve });
      notify({ kind: "ok", text: approve ? "Approved. PayPal installment invoices created." : "Declined. The client was told to pick a standard plan." });
      await refresh();
    } catch (err) {
      fail(err);
    }
  }

  async function markOverdue(inv: Invoice) {
    try {
      await api(`/api/invoices/${inv.id}/overdue`);
      notify({ kind: "ok", text: `${inv.clientName}'s invoice is now overdue (demo). Run the agent next.` });
      await refresh();
    } catch (err) {
      fail(err);
    }
  }

  const subtitle = [
    stats.overdueCount ? `${stats.overdueCount} invoice${stats.overdueCount > 1 ? "s" : ""} overdue` : "Nothing overdue",
    approvals.length ? `${approvals.length} need${approvals.length === 1 ? "s" : ""} your OK` : null,
    `${negotiations.filter((n) => n.status === "open").length} plan offer${negotiations.filter((n) => n.status === "open").length === 1 ? "" : "s"} out`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      {/* Header */}
      <section className="grid items-start gap-5 lg:grid-cols-[1fr_minmax(0,520px)]">
        <div className="pt-1">
          <p className="text-sm text-slate-500">{today}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 sm:text-[34px]">
            {greeting()}, {settings.ownerName}
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">{subtitle}.</p>
        </div>
        <CommandBox onCreated={refresh} notify={notify} />
      </section>

      {/* Key numbers */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={<Wallet className="size-4" />} label="Outstanding" value={money(stats.outstanding)} hint={`${stats.outstandingCount} open invoices`} />
        <Stat icon={<AlertTriangle className="size-4" />} tone="rose" label="Overdue" value={money(stats.overdue)} hint={`${stats.overdueCount} invoice${stats.overdueCount === 1 ? "" : "s"} past due`} />
        <Stat icon={<CheckCircle2 className="size-4" />} tone="emerald" label="Recovered with plans" value={money(stats.recovered)} hint={`${stats.plansAgreed} plan${stats.plansAgreed === 1 ? "" : "s"} agreed`} />
        <Stat icon={<Hourglass className="size-4" />} tone="amber" label="Waiting for you" value={String(stats.waiting)} hint={stats.waiting ? "Exceptions to review" : "All inside your guardrails"} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Approvals */}
          <GlassCard>
            <SectionTitle title="Needs your approval" count={approvals.length} />
            {approvals.length ? (
              approvals.map((n) => <ApprovalItem key={n.id} n={n} onDecide={decide} />)
            ) : (
              <p className="px-5 pb-5 text-sm text-slate-500">Nothing needs your OK. Every offer is inside your guardrails.</p>
            )}
          </GlassCard>

          {/* Agent cases */}
          <GlassCard>
            <SectionTitle
              title="Agent at work"
              count={negotiations.length}
              action={
                <Button variant="secondary" onClick={runAgent} loading={running} className="!px-3 !py-1.5 text-xs">
                  <Bot className="size-3.5" /> Check overdue invoices
                </Button>
              }
            />
            {negotiations.length ? (
              negotiations.map((n) => <AgentCase key={n.id} n={n} notify={notify} />)
            ) : (
              <p className="px-5 pb-5 text-sm text-slate-500">
                No payment plans yet. Click <span className="font-medium">Check overdue invoices</span> and the agent will explain what it does and why.
              </p>
            )}
          </GlassCard>
        </div>

        {/* Activity */}
        <GlassCard className="h-fit">
          <SectionTitle
            title="Activity"
            action={
              <button onClick={sync} disabled={syncing} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-slate-600 hover:bg-slate-900/5">
                <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} /> Sync PayPal
              </button>
            }
          />
          <ol className="flex flex-col px-5 pb-4">
            {activity.map((a) => (
              <li key={a.id} className="flex gap-3 py-2.5">
                <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${ACTIVITY_TONE[a.kind] ?? "bg-slate-100 text-slate-500"}`}>
                  {ACTIVITY_ICON[a.kind] ?? <Sparkles className="size-3.5" />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm leading-snug text-slate-700">{a.text}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{timeAgo(a.ts)}</p>
                </div>
              </li>
            ))}
          </ol>
        </GlassCard>
      </section>

      {/* Invoices */}
      <GlassCard className="overflow-hidden">
        <SectionTitle
          title="Invoices"
          count={invoices.length}
          action={
            <Link href="/invoices" className="text-sm text-blue-700 hover:underline">
              See all
            </Link>
          }
        />
        <div className="px-2 pb-2">
          <InvoiceGrid invoices={invoices.slice(0, 8)} height={380} onMarkOverdue={markOverdue} />
        </div>
      </GlassCard>
      {toast.view}
    </div>
  );
}
