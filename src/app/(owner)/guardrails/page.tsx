"use client";
// Guardrails form. The live preview uses the SAME plain-code functions the server uses.
import { Code2, RotateCcw, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDashboard } from "@/components/AppShell";
import { api, Button, GlassCard, money, niceDate, Spinner, useToast } from "@/components/ui";
import type { Settings } from "@/lib/db";
import { standardPlans, validateGuardrails } from "@/lib/guardrails";

const FIELDS: { key: keyof Omit<Settings, "ownerName">; label: string; hint: string; suffix: string; step: number }[] = [
  { key: "minUpfrontPct", label: "Minimum upfront", hint: "First payment must be at least this share of the total.", suffix: "%", step: 5 },
  { key: "maxInstallments", label: "Maximum payments", hint: "Most payments a plan can have, including the first.", suffix: "payments", step: 1 },
  { key: "maxDays", label: "Maximum days", hint: "Everything must be paid within this many days.", suffix: "days", step: 5 },
  { key: "maxDiscountPct", label: "Maximum discount", hint: "Largest discount the agent may offer for paying fast.", suffix: "%", step: 1 },
];

function Form({ initial, onSaved }: { initial: Settings; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const [form, setForm] = useState<Settings>(initial);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const router = useRouter();

  let previewError: string | null = null;
  let plans: ReturnType<typeof standardPlans> = [];
  try {
    plans = standardPlans(2000, validateGuardrails(form));
  } catch (err) {
    previewError = err instanceof Error ? err.message : String(err);
  }

  async function save() {
    setSaving(true);
    try {
      await api("/api/settings", form, "PUT");
      toast.show({ kind: "ok", text: "Guardrails saved. New offers will follow these rules." });
      await onSaved();
    } catch (err) {
      toast.show({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  }

  async function resetDemo() {
    if (!confirm("Reset the demo? This deletes all local invoices, plans and activity and reloads the demo clients. PayPal invoices are not deleted.")) return;
    setResetting(true);
    try {
      await api("/api/demo/reset");
      toast.show({ kind: "ok", text: "Demo workspace reset." });
      await onSaved();
      router.push("/");
      setResetting(false);
    } catch (err) {
      toast.show({ kind: "error", text: err instanceof Error ? err.message : String(err) });
      setResetting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <GlassCard className="flex flex-col gap-5 p-6">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-800">Your name</span>
          <span className="text-xs text-slate-500">Shown to clients on their payment page.</span>
          <input
            value={form.ownerName}
            onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
            className="glass-strong mt-1 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
          />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-800">{f.label}</span>
              <span className="min-h-8 text-xs text-slate-500">{f.hint}</span>
              <div className="glass-strong mt-1 flex items-center rounded-xl pr-3 focus-within:ring-2 focus-within:ring-blue-500/30">
                <input
                  type="number"
                  step={f.step}
                  min={0}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value === "" ? 0 : Number(e.target.value) })}
                  className="w-full bg-transparent px-3 py-2 text-sm tabular-nums focus:outline-none"
                />
                <span className="text-xs text-slate-400">{f.suffix}</span>
              </div>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-900/5 pt-5">
          <Button onClick={save} loading={saving} disabled={!!previewError}>
            Save guardrails
          </Button>
          <Button variant="ghost" onClick={resetDemo} loading={resetting} className="ml-auto">
            <RotateCcw className="size-4" /> Reset demo data
          </Button>
        </div>
      </GlassCard>

      <div className="flex flex-col gap-4">
        <GlassCard className="p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Code2 className="size-4 text-indigo-600" /> Enforced in code, not by the AI
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            The AI only writes wording and suggests plans. Every plan is checked by a validation function before a client sees it and again before
            PayPal invoices are created. Anything outside these rules comes to you for approval.
          </p>
        </GlassCard>
        <GlassCard className="p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ShieldCheck className="size-4 text-emerald-600" /> Live preview for a {money(2000)} invoice
          </p>
          {previewError ? (
            <p className="mt-3 text-sm text-rose-600">{previewError}</p>
          ) : plans.length === 0 ? (
            <p className="mt-3 text-sm text-amber-700">No standard plan fits these rules. Try allowing more days or payments.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {plans.map((p) => (
                <div key={p.id} className="rounded-xl bg-white/60 p-3 ring-1 ring-slate-900/5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800">{p.title}</span>
                    <span className="font-semibold tabular-nums">{money(p.total)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {p.payments.map((x) => `${money(x.amount)} by ${niceDate(x.dueDate)}`).join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
      {toast.view}
    </div>
  );
}

export default function GuardrailsPage() {
  const { data, refresh } = useDashboard();
  if (!data) return <Spinner />;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Guardrails</h1>
        <p className="text-sm text-slate-600">Set your rules once. The agent negotiates only inside them.</p>
      </header>
      <Form initial={data.settings} onSaved={refresh} />
    </div>
  );
}
