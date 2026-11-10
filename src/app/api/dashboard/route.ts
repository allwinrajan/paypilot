import { connection } from "next/server";
import { handle } from "@/lib/api";
import { dashboardData } from "@/lib/service";

export async function GET() {
  await connection(); // always read fresh data (never prerender at build time)
  return handle(() => dashboardData());
}
