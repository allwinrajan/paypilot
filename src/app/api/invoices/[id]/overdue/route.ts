// Demo helper: pretend an invoice is overdue (a demo cannot wait two weeks).
import { handle } from "@/lib/api";
import { markOverdueForDemo } from "@/lib/service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(() => {
    markOverdueForDemo(Number(id));
    return { ok: true };
  });
}
