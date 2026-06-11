import {
  type BrunsonMetricsSnapshot,
  getBrunsonMetricsSnapshot,
  subscribeToBrunsonMetricsSnapshots,
} from "@/lib/brunson-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function encodeSse(snapshot: BrunsonMetricsSnapshot) {
  return `event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`;
}

export function GET(request: Request) {
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const sendSnapshot = (snapshot: BrunsonMetricsSnapshot) => {
        controller.enqueue(encoder.encode(encodeSse(snapshot)));
      };

      unsubscribe = subscribeToBrunsonMetricsSnapshots(sendSnapshot);
      heartbeat = setInterval(() => {
        sendSnapshot(getBrunsonMetricsSnapshot());
      }, 10_000);

      request.signal.addEventListener("abort", () => {
        unsubscribe();

        if (heartbeat) {
          clearInterval(heartbeat);
        }

        controller.close();
      });
    },
    cancel() {
      unsubscribe();

      if (heartbeat) {
        clearInterval(heartbeat);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no",
    },
  });
}
