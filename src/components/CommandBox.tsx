"use client";
// Plain English -> invoice. Step 1: AI reads the text and code checks it (preview).
// Step 2: the owner confirms, then the invoice is created and sent in PayPal.
import { ArrowUp, Check, Pencil, Sparkles, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import type { InvoiceDraft } from "@/lib/agent";
import { api, Button, money } from "./ui";

interface ParseResult {
  draft: InvoiceDraft;
  problems: string[];
  existingClient: string | null;
}

const EXAMPLES = [
  "Bill Maple & Finch $1,500 for website copy, due in 14 days",
  "Invoice Kestrel Analytics $850 for a KPI report, due in a week",
];

export function CommandBox({ onCreated, notify }: { onCreated: () => void; notify: (t: { kind: "ok" | "error"; text: string }) => void }) {
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);

  async function read() {
    if (!text.trim()) return;
    setParsing(true);
    setResult(null);
    try {
      setResult(await api<ParseResult>("/api/chat/parse", { message: text }));
    } catch (err) {
      notify({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setParsing(false);
    }
  }

  async function create() {
    if (!result) return;
    setCreating(true);
    try {
      const r = await api<{ invoice: { paypalNumber: string | null }; warning?: string }>("/api/invoices", { draft: result.draft });
      notify({
        kind: r.warning ? "error" : "ok",
        text: r.warning ?? `PayPal invoice #${r.invoice.paypalNumber ?? ""} created and sent to ${result.draft.clientName}.`,
      });
      setResult(null);
      setText("");
      onCreated();
    } catch (err) {
      notify({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setCreating(false);
    }
  }

  const d = result?.draft;
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="glass rounded-2xl p-3 transition focus-within:ring-2 focus-within:ring-blue-500/30">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void read();
            }
          }}
          rows={2}
          placeholder="Describe an invoice in plain English…"
          className="w-full resize-none bg-transparent px-1 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
            <Sparkles className="size-3" /> AI invoice
          </span>
          <div className="hidden min-w-0 flex-1 gap-1.5 overflow-hidden sm:flex">
            {!text &&
              EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setText(ex)}
                  className="truncate rounded-full px-2 py-0.5 text-[11px] text-slate-500 ring-1 ring-slate-900/10 hover:bg-white/70"
                >
                  {ex}
                </button>
              ))}
          </div>
          <button
            onClick={read}
            disabled={parsing || !text.trim()}
            aria-label="Read invoice"
            className="ml-auto flex size-8 items-center justify-center rounded-full bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-md transition disabled:opacity-40"
          >
            {parsing ? <span className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <ArrowUp className="size-4" />}
          </button>
        </div>
      </div>

      {result && d && (
        <div className="glass animate-rise rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Invoice preview</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {d.currency === "USD" ? money(d.amount || 0) : `${d.currency} ${d.amount}`}{" "}
                <span className="text-sm font-normal text-slate-500">to {d.clientName}</span>
              </p>
              <p className="text-sm text-slate-600">
                {d.description} · due in {d.dueInDays} days
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {result.existingClient ? `Existing client: ${result.existingClient}` : "New client. It will be added to your list."}
              </p>
            </div>
            <button aria-label="Discard" onClick={() => setResult(null)} className="rounded-full p-1 text-slate-400 hover:bg-slate-900/5">
              <X className="size-4" />
            </button>
          </div>
          {result.problems.length > 0 ? (
            <div className="mt-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <div>{result.problems.join(" ")}</div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={create} loading={creating}>
                <Check className="size-4" /> Create &amp; send with PayPal
              </Button>
              <Button variant="ghost" onClick={() => setResult(null)}>
                <Pencil className="size-4" /> Edit text
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
