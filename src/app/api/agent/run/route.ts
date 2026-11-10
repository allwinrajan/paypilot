import { handle } from "@/lib/api";
import { runAgent } from "@/lib/service";

export async function POST() {
  return handle(() => runAgent());
}
