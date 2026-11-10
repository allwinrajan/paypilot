// Public: what the client sees on their payment page.
import { connection } from "next/server";
import { handle } from "@/lib/api";
import { publicNegotiation, UserError } from "@/lib/service";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  return handle(() => {
    const data = publicNegotiation(token);
    if (!data) throw new UserError("This payment link is not valid.");
    return data;
  });
}
