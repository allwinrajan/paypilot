// Step 1 of chat -> invoice: the AI extracts fields, code checks them. Nothing is sent to PayPal yet.
import { parseInvoiceRequest } from "@/lib/agent";
import { handle, readJson } from "@/lib/api";
import { findClientByName, listClients } from "@/lib/db";
import { checkDraft, UserError } from "@/lib/service";

export async function POST(request: Request) {
  return handle(async () => {
    const { message } = await readJson(request);
    if (typeof message !== "string" || !message.trim()) throw new UserError("Type what you want to bill first.");
    const draft = await parseInvoiceRequest(message, listClients().map((c) => c.name));
    const existing = findClientByName(draft.clientName);
    return { draft, problems: checkDraft(draft), existingClient: existing?.name ?? null };
  });
}
