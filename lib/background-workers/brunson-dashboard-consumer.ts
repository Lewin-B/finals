import {
  BRUNSON_DASHBOARD_GROUP_ID,
  getBrunsonTweetsTopic,
  parseBrunsonTweetEvent,
} from "../brunson-events";
import { ingestBrunsonTweetEvent } from "../brunson-metrics";
import { createKafkaConsumer } from "../kafka";

const globalForDashboardConsumer = globalThis as typeof globalThis & {
  brunsonDashboardConsumerStarted?: boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextBackoffMs(attempt: number) {
  const cappedAttempt = Math.min(attempt, 6);
  const base = 1_000 * 2 ** cappedAttempt;
  const jitter = Math.floor(Math.random() * 500);

  return Math.min(base + jitter, 60_000);
}

export async function startBrunsonDashboardConsumerWorker() {
  if (globalForDashboardConsumer.brunsonDashboardConsumerStarted) {
    return;
  }

  globalForDashboardConsumer.brunsonDashboardConsumerStarted = true;

  const topic = getBrunsonTweetsTopic();
  let attempt = 0;

  for (;;) {
    const consumer = createKafkaConsumer(BRUNSON_DASHBOARD_GROUP_ID);

    try {
      await consumer.connect();
      await consumer.subscribe({ fromBeginning: false, topic });
      await consumer.run({
        eachMessage: async ({ message }) => {
          const event = parseBrunsonTweetEvent(message.value);

          if (event) {
            ingestBrunsonTweetEvent(event);
          }
        },
      });

      return;
    } catch (error) {
      attempt += 1;
      console.error("[brunson-dashboard-consumer] Kafka consumer failed", error);

      try {
        await consumer.disconnect();
      } catch (disconnectError) {
        console.error(
          "[brunson-dashboard-consumer] Kafka disconnect failed",
          disconnectError,
        );
      }

      await sleep(nextBackoffMs(attempt));
    }
  }
}
