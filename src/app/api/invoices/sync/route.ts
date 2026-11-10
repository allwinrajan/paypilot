import { handle } from "@/lib/api";
import { syncFromPayPal } from "@/lib/service";

export async function POST() {
  return handle(() => syncFromPayPal());
}
