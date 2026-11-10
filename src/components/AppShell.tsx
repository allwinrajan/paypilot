"use client";
// Owner-side layout: glass sidebar + shared, auto-refreshing dashboard data for every page.
import { FileText, Home, Menu, Settings2, ShieldCheck, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { DashboardData } from "@/lib/service";
import { Avatar, useData } from "./ui";

interface Ctx {
  data: DashboardData | null;
  error: string | null;
  refresh: () => Promise<void>;
}
const DashboardContext = createContext<Ctx>({ data: null, error: null, refresh: async () => {} });
export const useDashboard = () => useContext(DashboardContext);

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/guardrails", label: "Guardrails", icon: Settings2 },
];

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="relative flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 text-white shadow-[0_6px_14px_-6px_rgba(79,70,229,0.7)]">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 12.5 20 4l-5.5 16-3-6.5L4 12.5Z" />
        </svg>
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-slate-900">PayPilot</span>
    </span>
  );
}

function Sidebar({ data, onNavigate }: { data: DashboardData | null; onNavigate?: () => void }) {
  const pathname = usePathname();
  const s = data?.settings;
  const waiting = data?.stats.waiting ?? 0;
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="px-2 pt-1">
        <Logo />
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                active ? "bg-white/80 font-medium text-slate-900 shadow-sm ring-1 ring-slate-900/5" : "text-slate-600 hover:bg-white/50"
              }`}
            >
              <Icon className="size-4" />
              <span className="flex-1">{label}</span>
              {href === "/" && waiting > 0 && (
                <span className="rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold text-white">{waiting}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <Link href="/guardrails" onClick={onNavigate} className="glass-strong block rounded-2xl p-3.5 transition hover:bg-white">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <ShieldCheck className="size-4 text-emerald-600" /> Guardrails on
            <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
              CODE
            </span>
          </div>
          {s ? (
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              ≥{s.minUpfrontPct}% upfront · ≤{s.maxInstallments} payments · ≤{s.maxDays} days · ≤{s.maxDiscountPct}% off
            </p>
          ) : (
            <p className="mt-2 h-8 animate-pulse rounded bg-slate-100" />
          )}
        </Link>
        <div className="flex items-center gap-3 px-2">
          <Avatar name={s?.ownerName ?? "?"} size="sm" />
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium text-slate-800">{s?.ownerName ?? "…"}</p>
            <p className="text-xs text-slate-500">Freelancer · PayPal sandbox</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data, error, refresh } = useData<DashboardData>("/api/dashboard", 8000);
  const [open, setOpen] = useState(false);

  return (
    <DashboardContext.Provider value={{ data, error, refresh }}>
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="glass sticky top-3 m-3 hidden h-[calc(100vh-1.5rem)] w-60 shrink-0 rounded-3xl lg:block">
          <Sidebar data={data} />
        </aside>

        {/* Mobile top bar + drawer */}
        <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-4 py-3 glass lg:hidden">
          <Logo />
          <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-white/60">
            <Menu className="size-5" />
          </button>
        </div>
        {open && (
          <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)}>
            <aside className="glass h-full w-64 rounded-r-3xl" onClick={(e) => e.stopPropagation()}>
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="absolute top-4 left-52 rounded-lg p-2">
                <X className="size-5" />
              </button>
              <Sidebar data={data} onNavigate={() => setOpen(false)} />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 pt-20 pb-10 sm:px-6 lg:px-8 lg:pt-8">
          {error && !data && (
            <div className="glass mb-4 rounded-2xl p-4 text-sm text-rose-700">Could not load data: {error}</div>
          )}
          {children}
        </main>
      </div>
    </DashboardContext.Provider>
  );
}
