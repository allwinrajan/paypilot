"use client";
import { Globe } from "lucide-react";
import { useDashboard } from "@/components/AppShell";
import { Avatar, GlassCard, money, Spinner } from "@/components/ui";
import type { Client } from "@/lib/db";

function reliability(c: Client): [string, string] {
  if (c.onTime + c.late === 0) return ["New client", "bg-slate-100 text-slate-600 ring-slate-200"];
  if (c.late === 0) return ["Always on time", "bg-emerald-50 text-emerald-700 ring-emerald-200"];
  if (c.late > c.onTime) return ["Often late", "bg-rose-50 text-rose-700 ring-rose-200"];
  return ["Sometimes late", "bg-amber-50 text-amber-700 ring-amber-200"];
}

export default function ClientsPage() {
  const { data } = useDashboard();
  if (!data) return <Spinner />;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Clients</h1>
        <p className="text-sm text-slate-600">The agent uses payment history to choose its tone and which plan to recommend.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.clients.map((c) => {
          const [label, cls] = reliability(c);
          const open = data.invoices.filter((i) => i.clientId === c.id && ["SENT", "OVERDUE", "UNPAID"].includes(i.displayStatus));
          const total = c.onTime + c.late;
          return (
            <GlassCard key={c.id} className="flex flex-col gap-4 p-5">
              <div className="flex items-center gap-3">
                <Avatar name={c.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{c.name}</p>
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <Globe className="size-3" /> {c.country || "Unknown country"}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>{label}</span>
              </div>
              <div>
                <div className="flex h-2 overflow-hidden rounded-full bg-slate-900/5">
                  {total > 0 && (
                    <>
                      <span className="bg-emerald-400" style={{ width: `${(c.onTime / total) * 100}%` }} />
                      <span className="bg-rose-400" style={{ width: `${(c.late / total) * 100}%` }} />
                    </>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {total === 0 ? "No payment history yet" : `${c.onTime} on time · ${c.late} late${c.late ? ` (avg ${c.avgDaysLate} days)` : ""}`}
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-slate-900/5 pt-3 text-sm">
                <span className="text-slate-500">Open balance</span>
                <span className="font-semibold text-slate-900 tabular-nums">{money(open.reduce((s, i) => s + i.amount, 0))}</span>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
