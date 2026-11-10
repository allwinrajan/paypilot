import { handle, readJson } from "@/lib/api";
import { clientRequestPlan, UserError } from "@/lib/service";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return handle(async () => {
    const { message } = await readJson(request);
    if (typeof message !== "string" || !message.trim()) throw new UserError("Write what plan you need first.");
    return clientRequestPlan(token, message);
  });
}
