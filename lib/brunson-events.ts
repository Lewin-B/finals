export const BRUNSON_TWEETS_TOPIC = "brunson-tweets";
export const BRUNSON_DASHBOARD_GROUP_ID = "brunson-dashboard-v1";

export type SentimentLabel = "negative" | "neutral" | "positive";

export type BrunsonTweetEvent = {
  authorId?: string;
  authorUsername?: string;
  createdAt?: string;
  id: string;
  matchedLexiconTerms: string[];
  matchingRuleTags: string[];
  receivedAt: string;
  sentimentLabel: SentimentLabel;
  sentimentScore: number;
  text: string;
};

export function getBrunsonTweetsTopic() {
  return process.env.KAFKA_BRUNSON_TWEETS_TOPIC ?? BRUNSON_TWEETS_TOPIC;
}

export function parseBrunsonTweetEvent(value: Buffer | string | null) {
  if (!value) {
    return undefined;
  }

  const candidate = JSON.parse(value.toString()) as Partial<BrunsonTweetEvent>;

  if (
    !candidate.id ||
    !candidate.text ||
    !candidate.receivedAt ||
    typeof candidate.sentimentScore !== "number" ||
    !candidate.sentimentLabel
  ) {
    return undefined;
  }

  return {
    authorId: candidate.authorId,
    authorUsername: candidate.authorUsername,
    createdAt: candidate.createdAt,
    id: candidate.id,
    matchedLexiconTerms: candidate.matchedLexiconTerms ?? [],
    matchingRuleTags: candidate.matchingRuleTags ?? [],
    receivedAt: candidate.receivedAt,
    sentimentLabel: candidate.sentimentLabel,
    sentimentScore: candidate.sentimentScore,
    text: candidate.text,
  } satisfies BrunsonTweetEvent;
}
