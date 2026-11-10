"use client";
import { RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { useDashboard } from "@/components/AppShell";
import { InvoiceGrid } from "@/components/InvoiceGrid";
import { api, Button, GlassCard, Spinner, useToast } from "@/components/ui";
import type { Invoice } from "@/lib/db";

export default function InvoicesPage() {
  const { data, refresh } = useDashboard();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [syncing, setSyncing] = useState(false);
  if (!data) return <Spinner />;

  const fail = (err: unknown) => toast.show({ kind: "error", text: err instanceof Error ? err.message : String(err) });
  async function sync() {
    setSyncing(true);
    try {
      const r = await api<{ checked: number; changed: number }>("/api/invoices/sync");
      toast.show({ kind: "ok", text: `Synced ${r.checked} PayPal invoices, ${r.changed} updated.` });
      await refresh();
    } catch (err) {
      fail(err);
    } finally {
      setSyncing(false);
    }
  }
  async function markOverdue(inv: Invoice) {
    try {
      await api(`/api/invoices/${inv.id}/overdue`);
      toast.show({ kind: "ok", text: `${inv.clientName}'s invoice is now overdue (demo).` });
      await refresh();
    } catch (err) {
      fail(err);
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-600">Every invoice, with live status from PayPal. Installments show as 1/3, 2/3…</p>
        </div>
        <div className="flex gap-2">
          <label className="glass-strong flex items-center gap-2 rounded-full px-3 py-2 text-sm">
            <Search className="size-4 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoices" className="w-40 bg-transparent focus:outline-none" />
          </label>
          <Button variant="secondary" onClick={sync} loading={syncing}>
            {!syncing && <RefreshCw className="size-4" />} Sync PayPal
          </Button>
        </div>
      </header>
      <GlassCard className="overflow-hidden p-2">
        <InvoiceGrid invoices={data.invoices} quickFilter={q} height={620} onMarkOverdue={markOverdue} />
      </GlassCard>
      {toast.view}
    </div>
  );
}
