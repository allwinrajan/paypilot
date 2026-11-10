import { handle, readJson } from "@/lib/api";
import { saveSettings } from "@/lib/db";
import { validateGuardrails } from "@/lib/guardrails";
import { UserError } from "@/lib/service";

export async function PUT(request: Request) {
  return handle(async () => {
    const body = await readJson(request);
    let guardrails;
    try {
      guardrails = validateGuardrails(body);
    } catch (err) {
      throw new UserError(err instanceof Error ? err.message : "Invalid guardrails");
    }
    const ownerName = String(body.ownerName ?? "").trim().slice(0, 60);
    if (!ownerName) throw new UserError("Your name is required.");
    saveSettings({ ownerName, ...guardrails });
    return { ok: true };
  });
}
