// Server-side PayPal client (Invoicing API v2).
// "server-only" makes the build fail if this file is ever imported into browser code,
// so PAYPAL_CLIENT_SECRET can never leak to the client.
import "server-only";

const BASE_URL =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

export class PayPalError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: unknown,
  ) {
    super(message);
  }
}

// ---------- OAuth token (cached in memory until shortly before it expires) ----------

let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) {
    throw new PayPalError(
      "PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set. Copy .env.example to .env and fill them in.",
      500,
      null,
    );
  }

  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new PayPalError("PayPal OAuth failed (check client id/secret)", res.status, data);

  cachedToken = {
    value: data.access_token,
    // refresh 60s early to avoid using a token that expires mid-request
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.value;
}

async function paypalFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new PayPalError(`PayPal ${init.method ?? "GET"} ${path} failed`, res.status, data);
  return data;
}

// ---------- Invoices ----------

export interface InvoiceItemInput {
  name: string;
  quantity: number;
  unitAmount: number; // e.g. 250.5
  description?: string;
}

export interface DraftInvoiceInput {
  recipientEmail: string;
  recipientName?: { givenName: string; surname: string };
  recipientBusinessName?: string;
  currency?: string; // default USD (multi-currency is out of scope)
  items: InvoiceItemInput[];
  dueDate?: string; // YYYY-MM-DD
  note?: string;
}

export interface PayPalInvoice {
  id: string;
  status: string; // DRAFT, SENT, PAID, ...
  detail: { invoice_number?: string; currency_code: string; metadata?: { recipient_view_url?: string } };
  amount?: { value: string; currency_code: string };
  links?: { href: string; rel: string; method: string }[];
}

/** Creates a DRAFT invoice. The invoicer is the PayPal business account that owns the API credentials. */
export async function createDraftInvoice(input: DraftInvoiceInput): Promise<PayPalInvoice> {
  const currency = input.currency ?? "USD";
  const body = {
    detail: {
      currency_code: currency,
      ...(input.note ? { note: input.note } : {}),
      ...(input.dueDate ? { payment_term: { due_date: input.dueDate } } : {}),
    },
    primary_recipients: [
      {
        billing_info: {
          email_address: input.recipientEmail,
          ...(input.recipientBusinessName ? { business_name: input.recipientBusinessName } : {}),
          ...(input.recipientName
            ? { name: { given_name: input.recipientName.givenName, surname: input.recipientName.surname } }
            : {}),
        },
      },
    ],
    items: input.items.map((item) => ({
      name: item.name,
      ...(item.description ? { description: item.description } : {}),
      quantity: String(item.quantity),
      unit_amount: { currency_code: currency, value: item.unitAmount.toFixed(2) },
    })),
  };

  // "return=representation" makes PayPal return the full invoice (incl. id) instead of just a link.
  return (await paypalFetch("/v2/invoicing/invoices", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body),
  })) as PayPalInvoice;
}

/**
 * Sends a draft invoice. In sandbox, PayPal does not deliver real email;
 * the recipient sees it by logging into the sandbox personal account.
 */
export async function sendInvoice(
  invoiceId: string,
  opts: { subject?: string; note?: string } = {},
): Promise<unknown> {
  return paypalFetch(`/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/send`, {
    method: "POST",
    body: JSON.stringify({ send_to_invoicer: false, send_to_recipient: true, ...opts }),
  });
}

/** Cancels a SENT invoice (used when an installment plan replaces it). */
export async function cancelInvoice(invoiceId: string, note: string): Promise<void> {
  await paypalFetch(`/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ note, send_to_invoicer: false, send_to_recipient: false }),
  });
}

/** Deletes a DRAFT invoice. */
export async function deleteInvoice(invoiceId: string): Promise<void> {
  await paypalFetch(`/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`, { method: "DELETE" });
}

export async function getInvoice(invoiceId: string): Promise<PayPalInvoice> {
  return (await paypalFetch(`/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`)) as PayPalInvoice;
}
