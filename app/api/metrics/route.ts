import { getBrunsonMetricsSnapshot } from "@/lib/brunson-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(getBrunsonMetricsSnapshot());
}
