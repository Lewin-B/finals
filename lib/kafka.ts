import "server-only";

import {
  Kafka,
  logLevel,
  type KafkaConfig,
  type Producer,
} from "kafkajs";

const globalForKafka = globalThis as typeof globalThis & {
  kafkaProducerPromise?: Promise<Producer>;
};

function getBrokers() {
  const brokers = process.env.KAFKA_BROKERS?.split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);

  if (!brokers?.length) {
    throw new Error("KAFKA_BROKERS must include at least one broker");
  }

  return brokers;
}

function getSasl(): KafkaConfig["sasl"] {
  const username = process.env.KAFKA_SASL_USERNAME;
  const password = process.env.KAFKA_SASL_PASSWORD;

  if (!username && !password) {
    return undefined;
  }

  if (!username || !password) {
    throw new Error(
      "KAFKA_SASL_USERNAME and KAFKA_SASL_PASSWORD must be set together",
    );
  }

  return {
    mechanism: process.env.KAFKA_SASL_MECHANISM ?? "plain",
    username,
    password,
  } as KafkaConfig["sasl"];
}

function createProducer() {
  const kafka = new Kafka({
    brokers: getBrokers(),
    clientId: process.env.KAFKA_CLIENT_ID ?? "finals-nextjs",
    logLevel: logLevel.ERROR,
    sasl: getSasl(),
    ssl: process.env.KAFKA_SSL === "true",
  });

  const producer = kafka.producer();

  return producer.connect().then(
    () => producer,
    (error) => {
      globalForKafka.kafkaProducerPromise = undefined;
      throw error;
    },
  );
}

export function getKafkaProducer() {
  globalForKafka.kafkaProducerPromise ??= createProducer();
  return globalForKafka.kafkaProducerPromise;
}

export async function sendKafkaJson({
  key,
  topic,
  value,
}: {
  key?: string;
  topic: string;
  value: unknown;
}) {
  const producer = await getKafkaProducer();

  return producer.send({
    topic,
    messages: [
      {
        key,
        value: JSON.stringify(value),
        headers: {
          "content-type": "application/json",
        },
      },
    ],
  });
}
