import { ensureXFilteredStreamRule, openXFilteredStream } from "@/lib/x";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureXFilteredStreamRule();
  const upstream = await openXFilteredStream(request.signal);

  return new Response(upstream.body, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "application/x-ndjson",
    },
  });
}
