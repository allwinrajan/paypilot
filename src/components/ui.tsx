"use client";
// Shared UI building blocks and helpers for PayPilot screens.
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

export function money(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: n % 1 === 0 ? 0 : 2 }).format(n);
}

export function niceDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** SQLite timestamps are UTC "YYYY-MM-DD HH:MM:SS". */
export function timeAgo(ts: string) {
  const t = Date.parse(ts.includes("T") ? ts : `${ts.replace(" ", "T")}Z`);
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export function GlassCard({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`glass rounded-2xl ${className}`}>{children}</div>;
}

export function SectionTitle({ title, count, action }: { title: string; count?: number; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
        {title}
        {count !== undefined && (
          <span className="rounded-full bg-slate-900/5 px-2 py-0.5 text-xs font-medium text-slate-600">{count}</span>
        )}
      </h2>
      {action}
    </div>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-[0_6px_16px_-6px_rgba(37,99,235,0.6)] hover:from-blue-500 hover:to-blue-700",
  secondary: "glass-strong text-slate-800 hover:bg-white",
  ghost: "text-slate-600 hover:bg-slate-900/5",
  danger: "glass-strong text-rose-600 hover:bg-rose-50",
};

export function Button({
  variant = "primary",
  loading = false,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

const STATUS_STYLE: Record<string, [string, string]> = {
  OVERDUE: ["Overdue", "bg-rose-50 text-rose-700 ring-rose-200"],
  SENT: ["Sent", "bg-sky-50 text-sky-700 ring-sky-200"],
  UNPAID: ["Unpaid", "bg-sky-50 text-sky-700 ring-sky-200"],
  PAID: ["Paid", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
  PARTIALLY_PAID: ["Part paid", "bg-teal-50 text-teal-700 ring-teal-200"],
  DRAFT: ["Draft", "bg-slate-100 text-slate-600 ring-slate-200"],
  REPLACED: ["Replaced by plan", "bg-violet-50 text-violet-700 ring-violet-200"],
  CANCELLED: ["Cancelled", "bg-slate-100 text-slate-500 ring-slate-200"],
  open: ["Waiting for client", "bg-amber-50 text-amber-700 ring-amber-200"],
  pending_approval: ["Needs your OK", "bg-rose-50 text-rose-700 ring-rose-200"],
  agreed: ["Plan agreed", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
};

export function StatusPill({ status }: { status: string }) {
  const [label, cls] = STATUS_STYLE[status] ?? [status, "bg-slate-100 text-slate-600 ring-slate-200"];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>{label}</span>;
}

const AVATAR_COLORS = ["from-sky-400 to-blue-500", "from-violet-400 to-indigo-500", "from-emerald-400 to-teal-500", "from-amber-400 to-orange-500", "from-rose-400 to-pink-500"];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const color = AVATAR_COLORS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  const dims = size === "sm" ? "size-7 text-[11px]" : "size-9 text-xs";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white shadow-sm ${color} ${dims}`}>
      {initials}
    </span>
  );
}

/** POST/PUT JSON helper that throws the server's friendly error message. */
export async function api<T = unknown>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

/** Fetches JSON and keeps it fresh. `pollMs` re-fetches in the background (for live demo updates). */
export function useData<T>(url: string, pollMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load data");
      if (alive.current) {
        setData(json as T);
        setError(null);
      }
    } catch (err) {
      if (alive.current) setError(err instanceof Error ? err.message : String(err));
    }
  }, [url]);

  useEffect(() => {
    alive.current = true;
    // Initial load runs as a promise callback, not synchronously inside the effect.
    void Promise.resolve().then(refresh);
    const t = pollMs ? setInterval(refresh, pollMs) : undefined;
    return () => {
      alive.current = false;
      if (t) clearInterval(t);
    };
  }, [refresh, pollMs]);

  return { data, error, refresh };
}

export interface Toast {
  kind: "ok" | "error";
  text: string;
}

export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.kind === "error" ? 7000 : 4000);
    return () => clearTimeout(t);
  }, [toast]);
  const view = toast ? (
    <div
      role="status"
      className={`animate-rise fixed right-4 bottom-4 z-50 max-w-sm rounded-2xl px-4 py-3 text-sm shadow-lg glass ${
        toast.kind === "error" ? "text-rose-700" : "text-slate-800"
      }`}
    >
      {toast.text}
    </div>
  ) : null;
  return { show: setToast, view };
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
      <Loader2 className="size-4 animate-spin" /> {label}…
    </div>
  );
}
