import { handle, readJson } from "@/lib/api";
import { ownerDecision } from "@/lib/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(async () => {
    const { approve } = await readJson(request);
    return ownerDecision(Number(id), approve === true);
  });
}
