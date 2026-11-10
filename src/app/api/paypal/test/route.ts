// Test route: creates ONE sandbox invoice to prove the PayPal connection works.
// Open in the browser:
//   /api/paypal/test          -> create a draft invoice
//   /api/paypal/test?send=1   -> create the draft and send it
import { createDraftInvoice, getInvoice, PayPalError, sendInvoice } from "@/lib/paypal";

export async function GET(request: Request) {
  if (process.env.PAYPAL_MODE === "live") {
    return Response.json({ error: "Test route is disabled in live mode." }, { status: 403 });
  }

  const shouldSend = new URL(request.url).searchParams.get("send") === "1";
  const recipientEmail = process.env.PAYPAL_TEST_RECIPIENT_EMAIL || "test-client@example.com";

  const due = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  try {
    const draft = await createDraftInvoice({
      recipientEmail,
      recipientName: { givenName: "Test", surname: "Client" },
      items: [{ name: "Website design (PayPilot test)", quantity: 1, unitAmount: 120 }],
      dueDate: due,
      note: "Test invoice created by PayPilot.",
    });

    if (shouldSend) {
      await sendInvoice(draft.id, { subject: "Your invoice from PayPilot (test)" });
      const sent = await getInvoice(draft.id);
      return Response.json({ ok: true, sent: true, id: sent.id, status: sent.status, invoice: sent });
    }

    return Response.json({ ok: true, sent: false, id: draft.id, status: draft.status, invoice: draft });
  } catch (err) {
    if (err instanceof PayPalError) {
      return Response.json({ ok: false, error: err.message, details: err.details }, { status: err.status });
    }
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
