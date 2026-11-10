// Small helper so every API route returns errors the same way.
import "server-only";
import { AIError } from "./ai";
import { PayPalError } from "./paypal";
import { UserError } from "./service";

export async function handle(fn: () => Promise<unknown> | unknown): Promise<Response> {
  try {
    return Response.json(await fn());
  } catch (err) {
    if (err instanceof UserError || err instanceof AIError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof PayPalError) {
      console.error("PayPal error", err.status, JSON.stringify(err.details));
      const d = err.details as { message?: string; details?: { description?: string }[] } | null;
      const reason = d?.details?.[0]?.description ?? d?.message ?? "";
      return Response.json({ error: `PayPal: ${err.message}${reason ? ` (${reason})` : ""}` }, { status: 502 });
    }
    console.error(err);
    return Response.json({ error: "Something went wrong. Check the server log." }, { status: 500 });
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    throw new UserError("Request body must be JSON.");
  }
}
