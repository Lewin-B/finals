import {
  getDefaultKafkaTopic,
  getKafkaStatus,
  sendKafkaJson,
} from "@/lib/kafka";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type KafkaPostBody = {
  key?: string;
  message?: unknown;
  topic?: string;
};

export function GET() {
  const status = getKafkaStatus();

  return Response.json({
    brokers: status.brokers,
    clientId: status.clientId,
    ssl: status.ssl,
    topic: status.topic,
  });
}

export async function POST(request: Request) {
  let body: KafkaPostBody;

  try {
    body = (await request.json()) as KafkaPostBody;
  } catch {
    return Response.json(
      { error: "Request body must be JSON" },
      { status: 400 },
    );
  }

  const topic = body.topic ?? getDefaultKafkaTopic();

  if (!topic) {
    return Response.json(
      { error: "Provide a topic in the request body or set KAFKA_TOPIC" },
      { status: 400 },
    );
  }

  const result = await sendKafkaJson({
    key: body.key,
    topic,
    value: body.message ?? body,
  });

  return Response.json({
    ok: true,
    topic,
    partitions: result.map(({ partition }) => partition),
  });
}
