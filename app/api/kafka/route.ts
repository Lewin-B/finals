import { sendKafkaJson } from "@/lib/kafka";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type KafkaPostBody = {
  key?: string;
  message?: unknown;
  topic?: string;
};

export function GET() {
  return Response.json({
    brokersConfigured: Boolean(process.env.KAFKA_BROKERS),
    defaultTopicConfigured: Boolean(process.env.KAFKA_TOPIC),
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

  const topic = body.topic ?? process.env.KAFKA_TOPIC;

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
