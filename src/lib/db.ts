// SQLite storage (better-sqlite3). The database file lives in ./data (gitignored) and is
// created + seeded with demo clients automatically on first use.
import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { addDays, type Guardrails, type Plan, todayISO } from "./guardrails";

// ---------- Types ----------

export interface Settings extends Guardrails {
  ownerName: string;
}

export interface Client {
  id: number;
  name: string;
  email: string;
  country: string;
  onTime: number;
  late: number;
  avgDaysLate: number;
}

export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "CANCELLED" | "REPLACED" | string;

export interface Invoice {
  id: number;
  clientId: number;
  clientName: string;
  description: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: InvoiceStatus;
  displayStatus: string; // status, with SENT + past due shown as OVERDUE
  paypalId: string | null;
  paypalNumber: string | null;
  payUrl: string | null;
  parentId: number | null;
  installmentNo: number | null;
  installmentCount: number | null;
  isDemo: boolean;
  createdAt: string;
}

export interface ChatMessage {
  from: "agent" | "client" | "owner" | "system";
  text: string;
  ts: string;
}

export type NegotiationStatus = "open" | "pending_approval" | "agreed";

export interface Negotiation {
  id: number;
  token: string;
  invoiceId: number;
  status: NegotiationStatus;
  reasoning: string[];
  message: string;
  options: Plan[];
  recommended: string | null;
  messages: ChatMessage[];
  pendingPlan: Plan | null;
  pendingReasons: string[];
  chosenPlan: Plan | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: number;
  ts: string;
  kind: string;
  text: string;
}

// ---------- Connection ----------

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "paypilot.db");

const globalForDb = globalThis as unknown as { __paypilotDb?: Database.Database };

export function db(): Database.Database {
  if (globalForDb.__paypilotDb) return globalForDb.__paypilotDb;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const conn = new Database(DB_PATH);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  migrate(conn);
  globalForDb.__paypilotDb = conn;
  if ((conn.prepare("SELECT COUNT(*) c FROM clients").get() as { c: number }).c === 0) seed(conn);
  return conn;
}

function migrate(conn: Database.Database) {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      owner_name TEXT NOT NULL,
      min_upfront_pct REAL NOT NULL,
      max_installments INTEGER NOT NULL,
      max_days INTEGER NOT NULL,
      max_discount_pct REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT '',
      on_time INTEGER NOT NULL DEFAULT 0,
      late INTEGER NOT NULL DEFAULT 0,
      avg_days_late REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      due_date TEXT NOT NULL,
      status TEXT NOT NULL,
      paypal_id TEXT,
      paypal_number TEXT,
      pay_url TEXT,
      parent_id INTEGER REFERENCES invoices(id),
      installment_no INTEGER,
      installment_count INTEGER,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS negotiations (
      id INTEGER PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id),
      status TEXT NOT NULL,
      reasoning TEXT NOT NULL DEFAULT '[]',
      message TEXT NOT NULL DEFAULT '',
      options TEXT NOT NULL DEFAULT '[]',
      recommended TEXT,
      messages TEXT NOT NULL DEFAULT '[]',
      pending_plan TEXT,
      pending_reasons TEXT NOT NULL DEFAULT '[]',
      chosen_plan TEXT,
      summary TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY,
      ts TEXT NOT NULL DEFAULT (datetime('now')),
      kind TEXT NOT NULL,
      text TEXT NOT NULL
    );
  `);
}

/** Demo data: fictional international clients with different payment histories. */
function seed(conn: Database.Database) {
  const t = todayISO();
  conn.prepare(
    `INSERT OR REPLACE INTO settings (id, owner_name, min_upfront_pct, max_installments, max_days, max_discount_pct)
     VALUES (1, 'Alvin', 25, 3, 60, 5)`,
  ).run();

  const addClient = conn.prepare(
    "INSERT INTO clients (name, email, country, on_time, late, avg_days_late) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const addInvoice = conn.prepare(
    `INSERT INTO invoices (client_id, description, amount, due_date, status, is_demo, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
  );

  const clients: [string, string, string, number, number, number][] = [
    ["Nordlicht Design GmbH", "accounts@nordlicht.example.com", "Germany", 9, 0, 0],
    ["Sakura Labs KK", "finance@sakuralabs.example.com", "Japan", 5, 2, 6],
    ["Andes Coffee Co.", "pagos@andescoffee.example.com", "Peru", 2, 5, 21],
    ["Maple & Finch Ltd", "billing@maplefinch.example.com", "Canada", 0, 0, 0],
    ["Kestrel Analytics", "ap@kestrel.example.com", "United Kingdom", 6, 1, 3],
  ];
  const ids = clients.map((c) => Number(addClient.run(...c).lastInsertRowid));
  const [nordlicht, sakura, andes, maple, kestrel] = ids;

  // [client, description, amount, due (days from today), status]
  const invoices: [number, string, number, number, string][] = [
    [nordlicht, "Website redesign, phase 2", 4200, -20, "PAID"],
    [kestrel, "Dashboard UX audit", 3200, -8, "PAID"],
    [sakura, "Mobile app UI design", 2400, -12, "SENT"], // overdue
    [andes, "Brand identity refresh", 900, -35, "SENT"], // very overdue
    [maple, "Website copywriting", 1500, 10, "SENT"],
  ];
  for (const [client, desc, amount, due, status] of invoices) {
    addInvoice.run(client, desc, amount, addDays(t, due), status, addDays(t, due - 30));
  }
  conn.prepare("INSERT INTO activity (kind, text) VALUES ('system', ?)").run(
    "Demo workspace ready: 5 clients, 5 invoices loaded.",
  );
}

/** Deletes all data and re-creates the demo workspace. */
export function resetDemo() {
  const conn = db();
  conn.exec(
    "DELETE FROM negotiations; DELETE FROM invoices; DELETE FROM clients; DELETE FROM activity; DELETE FROM settings;",
  );
  seed(conn);
}

// ---------- Settings ----------

export function getSettings(): Settings {
  const r = db().prepare("SELECT * FROM settings WHERE id = 1").get() as Record<string, unknown>;
  return {
    ownerName: String(r.owner_name),
    minUpfrontPct: Number(r.min_upfront_pct),
    maxInstallments: Number(r.max_installments),
    maxDays: Number(r.max_days),
    maxDiscountPct: Number(r.max_discount_pct),
  };
}

export function saveSettings(s: Settings) {
  db().prepare(
    `UPDATE settings SET owner_name = ?, min_upfront_pct = ?, max_installments = ?, max_days = ?, max_discount_pct = ?
     WHERE id = 1`,
  ).run(s.ownerName, s.minUpfrontPct, s.maxInstallments, s.maxDays, s.maxDiscountPct);
}

// ---------- Clients ----------

const toClient = (r: Record<string, unknown>): Client => ({
  id: Number(r.id),
  name: String(r.name),
  email: String(r.email),
  country: String(r.country),
  onTime: Number(r.on_time),
  late: Number(r.late),
  avgDaysLate: Number(r.avg_days_late),
});

export function listClients(): Client[] {
  return (db().prepare("SELECT * FROM clients ORDER BY name").all() as Record<string, unknown>[]).map(toClient);
}

export function getClient(id: number): Client | null {
  const r = db().prepare("SELECT * FROM clients WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return r ? toClient(r) : null;
}

export function findClientByName(name: string): Client | null {
  const all = listClients();
  const q = name.trim().toLowerCase();
  return (
    all.find((c) => c.name.toLowerCase() === q) ??
    all.find((c) => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase().split(" ")[0])) ??
    null
  );
}

export function createClient(name: string, email: string, country = ""): Client {
  const id = Number(
    db().prepare("INSERT INTO clients (name, email, country) VALUES (?, ?, ?)").run(name, email, country)
      .lastInsertRowid,
  );
  return getClient(id)!;
}

// ---------- Invoices ----------

const toInvoice = (r: Record<string, unknown>): Invoice => {
  const status = String(r.status);
  const dueDate = String(r.due_date);
  const overdue = (status === "SENT" || status === "UNPAID") && dueDate < todayISO();
  return {
    id: Number(r.id),
    clientId: Number(r.client_id),
    clientName: String(r.client_name ?? ""),
    description: String(r.description),
    amount: Number(r.amount),
    currency: String(r.currency),
    dueDate,
    status,
    displayStatus: overdue ? "OVERDUE" : status,
    paypalId: (r.paypal_id as string) ?? null,
    paypalNumber: (r.paypal_number as string) ?? null,
    payUrl: (r.pay_url as string) ?? null,
    parentId: r.parent_id == null ? null : Number(r.parent_id),
    installmentNo: r.installment_no == null ? null : Number(r.installment_no),
    installmentCount: r.installment_count == null ? null : Number(r.installment_count),
    isDemo: Number(r.is_demo) === 1,
    createdAt: String(r.created_at),
  };
};

const INVOICE_SELECT = "SELECT i.*, c.name AS client_name FROM invoices i JOIN clients c ON c.id = i.client_id";

export function listInvoices(): Invoice[] {
  return (db().prepare(`${INVOICE_SELECT} ORDER BY i.id DESC`).all() as Record<string, unknown>[]).map(toInvoice);
}

export function getInvoiceRow(id: number): Invoice | null {
  const r = db().prepare(`${INVOICE_SELECT} WHERE i.id = ?`).get(id) as Record<string, unknown> | undefined;
  return r ? toInvoice(r) : null;
}

export function insertInvoice(i: {
  clientId: number;
  description: string;
  amount: number;
  currency?: string;
  dueDate: string;
  status: string;
  paypalId?: string | null;
  paypalNumber?: string | null;
  payUrl?: string | null;
  parentId?: number | null;
  installmentNo?: number | null;
  installmentCount?: number | null;
}): Invoice {
  const id = Number(
    db().prepare(
      `INSERT INTO invoices (client_id, description, amount, currency, due_date, status, paypal_id, paypal_number,
         pay_url, parent_id, installment_no, installment_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      i.clientId, i.description, i.amount, i.currency ?? "USD", i.dueDate, i.status, i.paypalId ?? null,
      i.paypalNumber ?? null, i.payUrl ?? null, i.parentId ?? null, i.installmentNo ?? null, i.installmentCount ?? null,
    ).lastInsertRowid,
  );
  return getInvoiceRow(id)!;
}

export function updateInvoice(id: number, fields: Partial<{ status: string; dueDate: string; payUrl: string | null }>) {
  if (fields.status !== undefined) db().prepare("UPDATE invoices SET status = ? WHERE id = ?").run(fields.status, id);
  if (fields.dueDate !== undefined) db().prepare("UPDATE invoices SET due_date = ? WHERE id = ?").run(fields.dueDate, id);
  if (fields.payUrl !== undefined) db().prepare("UPDATE invoices SET pay_url = ? WHERE id = ?").run(fields.payUrl, id);
}

// ---------- Negotiations ----------

const parse = <T>(s: unknown, fallback: T): T => {
  try {
    return s == null ? fallback : (JSON.parse(String(s)) as T);
  } catch {
    return fallback;
  }
};

const toNegotiation = (r: Record<string, unknown>): Negotiation => ({
  id: Number(r.id),
  token: String(r.token),
  invoiceId: Number(r.invoice_id),
  status: String(r.status) as NegotiationStatus,
  reasoning: parse(r.reasoning, []),
  message: String(r.message),
  options: parse(r.options, []),
  recommended: (r.recommended as string) ?? null,
  messages: parse(r.messages, []),
  pendingPlan: parse(r.pending_plan, null),
  pendingReasons: parse(r.pending_reasons, []),
  chosenPlan: parse(r.chosen_plan, null),
  summary: (r.summary as string) ?? null,
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
});

export function listNegotiations(): Negotiation[] {
  return (db().prepare("SELECT * FROM negotiations ORDER BY updated_at DESC, id DESC").all() as Record<
    string,
    unknown
  >[]).map(toNegotiation);
}

export function getNegotiationByToken(token: string): Negotiation | null {
  const r = db().prepare("SELECT * FROM negotiations WHERE token = ?").get(token) as Record<string, unknown> | undefined;
  return r ? toNegotiation(r) : null;
}

export function getNegotiation(id: number): Negotiation | null {
  const r = db().prepare("SELECT * FROM negotiations WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return r ? toNegotiation(r) : null;
}

export function getNegotiationForInvoice(invoiceId: number): Negotiation | null {
  const r = db().prepare("SELECT * FROM negotiations WHERE invoice_id = ?").get(invoiceId) as
    | Record<string, unknown>
    | undefined;
  return r ? toNegotiation(r) : null;
}

export function insertNegotiation(n: {
  token: string;
  invoiceId: number;
  reasoning: string[];
  message: string;
  options: Plan[];
  recommended: string | null;
  messages: ChatMessage[];
}): Negotiation {
  const id = Number(
    db().prepare(
      `INSERT INTO negotiations (token, invoice_id, status, reasoning, message, options, recommended, messages)
       VALUES (?, ?, 'open', ?, ?, ?, ?, ?)`,
    ).run(
      n.token, n.invoiceId, JSON.stringify(n.reasoning), n.message, JSON.stringify(n.options), n.recommended,
      JSON.stringify(n.messages),
    ).lastInsertRowid,
  );
  return getNegotiation(id)!;
}

export function updateNegotiation(
  id: number,
  f: Partial<{
    status: NegotiationStatus;
    options: Plan[];
    messages: ChatMessage[];
    pendingPlan: Plan | null;
    pendingReasons: string[];
    chosenPlan: Plan | null;
    summary: string | null;
  }>,
) {
  const sets: string[] = [];
  const vals: unknown[] = [];
  const add = (col: string, v: unknown) => {
    sets.push(`${col} = ?`);
    vals.push(v);
  };
  if (f.status !== undefined) add("status", f.status);
  if (f.options !== undefined) add("options", JSON.stringify(f.options));
  if (f.messages !== undefined) add("messages", JSON.stringify(f.messages));
  if (f.pendingPlan !== undefined) add("pending_plan", f.pendingPlan ? JSON.stringify(f.pendingPlan) : null);
  if (f.pendingReasons !== undefined) add("pending_reasons", JSON.stringify(f.pendingReasons));
  if (f.chosenPlan !== undefined) add("chosen_plan", f.chosenPlan ? JSON.stringify(f.chosenPlan) : null);
  if (f.summary !== undefined) add("summary", f.summary);
  if (!sets.length) return;
  sets.push("updated_at = datetime('now')");
  db().prepare(`UPDATE negotiations SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
}

// ---------- Activity feed ----------

export function logActivity(kind: string, text: string) {
  db().prepare("INSERT INTO activity (kind, text) VALUES (?, ?)").run(kind, text);
}

export function listActivity(limit = 12): Activity[] {
  return db().prepare("SELECT * FROM activity ORDER BY id DESC LIMIT ?").all(limit) as Activity[];
}
