import { handle } from "@/lib/api";
import { resetDemo } from "@/lib/db";

export async function POST() {
  return handle(() => {
    resetDemo();
    return { ok: true };
  });
}
