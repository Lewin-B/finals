import type { BrunsonTweetEvent, SentimentLabel } from "./brunson-events";

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const RECENT_TWEETS_LIMIT = 50;
const MAX_DEDUPE_IDS = 10_000;

type MetricsState = {
  events: BrunsonTweetEvent[];
  seenOrder: string[];
  seenTweetIds: Set<string>;
  subscribers: Set<(snapshot: BrunsonMetricsSnapshot) => void>;
};

export type BrunsonMetricsSnapshot = {
  averageSentimentScore: number;
  metricsWindowMinutes: number;
  recentTweets: BrunsonTweetEvent[];
  recentTweetsLimit: number;
  sentimentCounts: Record<SentimentLabel, number>;
  topLexiconTerms: {
    count: number;
    term: string;
  }[];
  totalTweets: number;
};

const globalForMetrics = globalThis as typeof globalThis & {
  brunsonMetricsState?: MetricsState;
};

function getState() {
  globalForMetrics.brunsonMetricsState ??= {
    events: [],
    seenOrder: [],
    seenTweetIds: new Set<string>(),
    subscribers: new Set<(snapshot: BrunsonMetricsSnapshot) => void>(),
  };

  return globalForMetrics.brunsonMetricsState;
}

function getMetricsWindowMs() {
  const configured = Number(process.env.METRICS_WINDOW_MINUTES);

  if (Number.isFinite(configured) && configured > 0) {
    return configured * 60 * 1000;
  }

  return DEFAULT_WINDOW_MS;
}

function pruneEvents(nowMs: number) {
  const state = getState();
  const cutoff = nowMs - getMetricsWindowMs();

  state.events = state.events.filter((event) => {
    const receivedAtMs = Date.parse(event.receivedAt);
    return Number.isFinite(receivedAtMs) && receivedAtMs >= cutoff;
  });
}

function rememberTweetId(tweetId: string) {
  const state = getState();

  state.seenTweetIds.add(tweetId);
  state.seenOrder.push(tweetId);

  while (state.seenOrder.length > MAX_DEDUPE_IDS) {
    const expiredId = state.seenOrder.shift();

    if (expiredId) {
      state.seenTweetIds.delete(expiredId);
    }
  }
}

export function ingestBrunsonTweetEvent(event: BrunsonTweetEvent) {
  const state = getState();

  if (state.seenTweetIds.has(event.id)) {
    return false;
  }

  rememberTweetId(event.id);
  state.events.push(event);
  pruneEvents(Date.now());
  publishSnapshot();

  return true;
}

export function getBrunsonMetricsSnapshot(): BrunsonMetricsSnapshot {
  pruneEvents(Date.now());

  const state = getState();
  const sentimentCounts: Record<SentimentLabel, number> = {
    negative: 0,
    neutral: 0,
    positive: 0,
  };
  const termCounts = new Map<string, number>();
  let sentimentScoreTotal = 0;

  for (const event of state.events) {
    sentimentCounts[event.sentimentLabel] += 1;
    sentimentScoreTotal += event.sentimentScore;

    for (const term of event.matchedLexiconTerms) {
      termCounts.set(term, (termCounts.get(term) ?? 0) + 1);
    }
  }

  const recentTweets = [...state.events]
    .sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))
    .slice(0, RECENT_TWEETS_LIMIT);
  const topLexiconTerms = [...termCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20)
    .map(([term, count]) => ({ count, term }));

  return {
    averageSentimentScore: state.events.length
      ? sentimentScoreTotal / state.events.length
      : 0,
    metricsWindowMinutes: getMetricsWindowMs() / 60_000,
    recentTweets,
    recentTweetsLimit: RECENT_TWEETS_LIMIT,
    sentimentCounts,
    topLexiconTerms,
    totalTweets: state.events.length,
  };
}

function publishSnapshot() {
  const state = getState();
  const snapshot = getBrunsonMetricsSnapshot();

  for (const subscriber of state.subscribers) {
    subscriber(snapshot);
  }
}

export function subscribeToBrunsonMetricsSnapshots(
  subscriber: (snapshot: BrunsonMetricsSnapshot) => void,
) {
  const state = getState();

  state.subscribers.add(subscriber);
  subscriber(getBrunsonMetricsSnapshot());

  return () => {
    state.subscribers.delete(subscriber);
  };
}
