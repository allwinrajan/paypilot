import { handle, readJson } from "@/lib/api";
import { clientChoosePlan } from "@/lib/service";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return handle(async () => {
    const { planId } = await readJson(request);
    return clientChoosePlan(token, String(planId));
  });
}
