// Step 2 of chat -> invoice: after the user confirms the preview, create + send it in PayPal.
import type { InvoiceDraft } from "@/lib/agent";
import { handle, readJson } from "@/lib/api";
import { createInvoiceFromDraft, UserError } from "@/lib/service";

export async function POST(request: Request) {
  return handle(async () => {
    const { draft } = await readJson(request);
    const d = draft as InvoiceDraft | undefined;
    if (!d || typeof d.clientName !== "string" || typeof d.description !== "string") {
      throw new UserError("Missing invoice details.");
    }
    return createInvoiceFromDraft({
      clientName: d.clientName.slice(0, 120),
      clientEmail: typeof d.clientEmail === "string" ? d.clientEmail : null,
      description: d.description.slice(0, 200),
      amount: Number(d.amount),
      currency: String(d.currency || "USD").toUpperCase(),
      dueInDays: Math.round(Number(d.dueInDays)),
    });
  });
}
