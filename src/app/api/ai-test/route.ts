// Test route: confirms AI_API_KEY / AI_MODEL work.
//   /api/ai-test          -> one short text reply
//   /api/ai-test?json=1   -> one JSON reply through generateJSON (parse + validate + retry)
import { AIError, generateJSON, generateText } from "@/lib/ai";

export async function GET(request: Request) {
  const wantJson = new URL(request.url).searchParams.get("json") === "1";
  try {
    if (wantJson) {
      const data = await generateJSON({
        system: "You extract invoice details.",
        prompt: 'Text: "Bill Acme GmbH 1200 USD for a logo redesign." Return {"client": string, "amount": number}.',
        validate: (d) => {
          const o = d as { client?: unknown; amount?: unknown };
          if (typeof o?.client !== "string" || typeof o?.amount !== "number") {
            throw new Error('expected {"client": string, "amount": number}');
          }
          return { client: o.client, amount: o.amount };
        },
      });
      return Response.json({ ok: true, model: process.env.AI_MODEL, data });
    }

    const reply = await generateText({ prompt: "Reply with one short sentence: are you working?" });
    return Response.json({ ok: true, model: process.env.AI_MODEL, reply });
  } catch (err) {
    const message = err instanceof AIError ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
