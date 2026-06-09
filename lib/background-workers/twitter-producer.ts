import { sendKafkaJson } from "../kafka.ts";

const STREAM_RULES_URL = "https://api.twitter.com/2/tweets/search/stream/rules";
const STREAM_URL =
  "https://api.twitter.com/2/tweets/search/stream?tweet.fields=created_at,author_id,lang";
const TOPIC = "brunson-tweets";

const DEFAULT_RULE_VALUE = '(Jalen Brunson OR "Brunson") -is:retweet lang:en';
const DEFAULT_RULE_TAG = "brunson-tweets";

const positiveWords = new Set([
  "amazing",
  "awesome",
  "best",
  "clutch",
  "dominant",
  "elite",
  "excellent",
  "fire",
  "good",
  "great",
  "hero",
  "him",
  "incredible",
  "love",
  "mvp",
  "perfect",
  "star",
  "strong",
  "unreal",
  "win",
  "winner",
]);

const negativeWords = new Set([
  "awful",
  "bad",
  "blame",
  "choke",
  "cold",
  "disaster",
  "fraud",
  "hate",
  "hurt",
  "injury",
  "loss",
  "miss",
  "overrated",
  "poor",
  "sad",
  "terrible",
  "trash",
  "weak",
  "worst",
]);

type XRule = {
  id: string;
  tag?: string;
  value: string;
};

type XTweet = {
  author_id?: string;
  created_at?: string;
  id: string;
  lang?: string;
  text: string;
};

type XStreamMessage = {
  data?: XTweet;
  matching_rules?: XRule[];
};

type Sentiment = {
  label: "negative" | "neutral" | "positive";
  negative: number;
  positive: number;
  score: number;
};

function getBearerToken() {
  const source = process.env.X_BEARER_TOKEN
    ? "X_BEARER_TOKEN"
    : process.env.x_bearer_token
    ? "x_bearer_token"
    : undefined;
  const token = (source ? process.env[source] : undefined)?.trim().replace(
    /^Bearer\s+/i,
    "",
  );

  if (!token) {
    throw new Error(
      "X_BEARER_TOKEN or x_bearer_token must be set when background workers run",
    );
  }

  return token;
}

function getRule() {
  return {
    tag: process.env.X_STREAM_RULE_TAG ?? process.env.X_RULE_TAG ??
      DEFAULT_RULE_TAG,
    value: process.env.X_STREAM_RULE_VALUE ?? process.env.X_STREAM_RULE ??
      DEFAULT_RULE_VALUE,
  };
}

function getHeaders() {
  return {
    authorization: `Bearer ${getBearerToken()}`,
    "content-type": "application/json",
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextBackoffMs(attempt: number) {
  const cappedAttempt = Math.min(attempt, 6);
  const base = 1_000 * 2 ** cappedAttempt;
  const jitter = Math.floor(Math.random() * 500);

  return Math.min(base + jitter, 60_000);
}

async function readJson<T>(response: Response) {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`X API returned ${response.status}: ${text}`);
  }

  return (text ? JSON.parse(text) : {}) as T;
}

async function ensureStreamRule() {
  const rule = getRule();
  const response = await fetch(STREAM_RULES_URL, {
    headers: getHeaders(),
  });
  const existing = await readJson<{ data?: XRule[] }>(response);

  if (existing.data?.some(({ value }) => value === rule.value)) {
    return;
  }

  const addResponse = await fetch(STREAM_RULES_URL, {
    body: JSON.stringify({ add: [rule] }),
    headers: getHeaders(),
    method: "POST",
  });

  await readJson(addResponse);
}

function scoreSentiment(text: string): Sentiment {
  const words = text.toLowerCase().match(/[a-z][a-z']*/g) ?? [];
  let positive = 0;
  let negative = 0;

  for (const word of words) {
    if (positiveWords.has(word)) {
      positive += 1;
    }

    if (negativeWords.has(word)) {
      negative += 1;
    }
  }

  const score = positive - negative;

  return {
    label: score > 0 ? "positive" : score < 0 ? "negative" : "neutral",
    negative,
    positive,
    score,
  };
}

async function publishTweet(message: XStreamMessage) {
  if (!message.data) {
    return;
  }

  const tweet = message.data;

  await sendKafkaJson({
    key: tweet.id,
    topic: TOPIC,
    value: {
      id: tweet.id,
      text: tweet.text,
      authorId: tweet.author_id,
      createdAt: tweet.created_at,
      lang: tweet.lang,
      matchingRules: message.matching_rules ?? [],
      receivedAt: new Date().toISOString(),
      sentiment: scoreSentiment(tweet.text),
      source: "x-search-stream",
    },
  });
}

async function consumeStream() {
  const response = await fetch(STREAM_URL, {
    headers: getHeaders(),
  });

  if (!response.ok || !response.body) {
    const body = await response.text();
    throw new Error(`X stream returned ${response.status}: ${body}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      return;
    }

    buffer += decoder.decode(value, { stream: true });

    for (;;) {
      const newlineIndex = buffer.indexOf("\n");

      if (newlineIndex === -1) {
        break;
      }

      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (!line) {
        continue;
      }

      await publishTweet(JSON.parse(line) as XStreamMessage);
    }
  }
}

export async function startTwitterProducerWorker() {
  let attempt = 0;

  for (;;) {
    try {
      await ensureStreamRule();
      await consumeStream();
      attempt = 0;
    } catch (error) {
      attempt += 1;
      console.error("[twitter-producer] stream failed", error);
      await sleep(nextBackoffMs(attempt));
    }
  }
}
