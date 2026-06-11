"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type SentimentLabel = "negative" | "neutral" | "positive";

type TweetEvent = {
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

type SentimentSnapshot = {
  averageSentimentScore: number;
  metricsWindowMinutes: number;
  recentTweets: TweetEvent[];
  recentTweetsLimit: number;
  sentimentCounts: Record<SentimentLabel, number>;
  topLexiconTerms: {
    count: number;
    term: string;
  }[];
  totalTweets: number;
};

const emptySnapshot: SentimentSnapshot = {
  averageSentimentScore: 0,
  metricsWindowMinutes: 15,
  recentTweets: [],
  recentTweetsLimit: 50,
  sentimentCounts: {
    negative: 0,
    neutral: 0,
    positive: 0,
  },
  topLexiconTerms: [],
  totalTweets: 0,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getMeterPercent(score: number) {
  return ((clamp(score, -3, 3) + 3) / 6) * 100;
}

function formatScore(score: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(score);
}

function formatTime(value?: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function KingMeter({ snapshot }: { snapshot: SentimentSnapshot }) {
  const meterPercent = getMeterPercent(snapshot.averageSentimentScore);

  return (
    <section className="relative z-10 mx-auto -mt-10 w-full max-w-3xl overflow-hidden rounded-lg border border-[#f58426]/25 bg-[linear-gradient(180deg,rgba(9,10,18,0.96)_0%,rgba(2,4,10,0.92)_100%)] px-4 pb-5 pt-6 shadow-[0_28px_95px_rgba(0,0,0,0.72),0_0_42px_rgba(245,132,38,0.14)] backdrop-blur sm:px-7 sm:pb-7">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f58426] to-transparent opacity-80" />
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-2xl font-black leading-none text-white drop-shadow-[0_0_18px_rgba(245,132,38,0.28)] sm:text-4xl">
          King of New York? Meter
        </h1>
        <div className="text-4xl font-black leading-none text-[#f58426] drop-shadow-[0_0_24px_rgba(245,132,38,0.55)] sm:text-6xl">
          {formatScore(snapshot.averageSentimentScore)}
        </div>
      </div>

      <div className="mt-7">
        <div className="relative h-14">
          <div className="absolute left-0 right-0 top-6 h-3 overflow-hidden rounded-full border border-[#f58426]/25 bg-[linear-gradient(90deg,#005da8_0%,#12213b_40%,#f8f8f8_50%,#87501e_61%,#f58426_100%)] shadow-[inset_0_2px_8px_rgba(0,0,0,0.75),0_0_24px_rgba(245,132,38,0.16)]">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.38),transparent_48%,rgba(0,0,0,0.35))]" />
          </div>
          <div className="absolute left-1/2 top-3 h-9 w-px -translate-x-1/2 bg-white/35" />
          <div
            className="absolute top-1.5 h-12 w-12 rounded-full border border-[#ffcb98] bg-[radial-gradient(circle_at_35%_30%,#ffd5aa_0%,#f58426_42%,#9b3d10_100%)] shadow-[0_10px_30px_rgba(245,132,38,0.78),0_0_0_6px_rgba(245,132,38,0.1)] transition-[left] duration-700 ease-[cubic-bezier(.2,1.55,.32,1)]"
            style={{ left: `${meterPercent}%`, transform: "translateX(-50%)" }}
          >
            <div className="absolute inset-2 rounded-full border border-white/30 bg-[#07101f]" />
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f58426]" />
          </div>
        </div>
        <div className="grid grid-cols-3 text-[11px] font-black uppercase tracking-[0.18em]">
          <div className="text-[#8fcbff]">Negative</div>
          <div className="text-center text-white/62">Neutral</div>
          <div className="text-right text-[#f58426]">Positive</div>
        </div>
      </div>
    </section>
  );
}

function CommentStream({ tweets }: { tweets: TweetEvent[] }) {
  return (
    <section className="mx-auto mt-5 w-full max-w-3xl overflow-hidden rounded-lg border border-[#f58426]/15 bg-black/50 shadow-[0_22px_70px_rgba(0,0,0,0.45)] backdrop-blur">
      <div className="max-h-[220px] overflow-y-auto sm:max-h-[260px]">
        {tweets.slice(0, 8).map((tweet, index) => (
          <article
            key={tweet.id}
            className="feed-item border-b border-white/10 px-4 py-3 last:border-b-0"
            style={{ animationDelay: `${Math.min(index, 5) * 35}ms` }}
          >
            <div className="flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.13em] text-white/38">
              <span className="truncate">
                @{tweet.authorUsername ?? tweet.authorId ?? "unknown"}
              </span>
              <span>{formatTime(tweet.receivedAt)}</span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-white/80">
              {tweet.text}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function SentimentDashboard() {
  const [snapshot, setSnapshot] = useState<SentimentSnapshot>(emptySnapshot);

  useEffect(() => {
    let active = true;

    fetch("/api/sentiment")
      .then((response) => response.json() as Promise<SentimentSnapshot>)
      .then((nextSnapshot) => {
        if (active) {
          setSnapshot(nextSnapshot);
        }
      })
      .catch(() => undefined);

    const events = new EventSource("/api/sentiment/stream");

    events.addEventListener("snapshot", (event) => {
      if (active) {
        setSnapshot(JSON.parse(event.data) as SentimentSnapshot);
      }
    });

    return () => {
      active = false;
      events.close();
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02040a] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_0%,rgba(0,53,104,0.42),transparent_38%),radial-gradient(circle_at_76%_6%,rgba(245,132,38,0.32),transparent_31%),radial-gradient(circle_at_50%_58%,rgba(245,132,38,0.12),transparent_34%),linear-gradient(135deg,#010207_0%,#040817_48%,#010103_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:72px_72px] opacity-15" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-4 py-6 sm:px-6">
        <section className="w-full">
          <div className="relative mx-auto h-[390px] w-full max-w-3xl sm:h-[500px]">
            <div className="absolute left-1/2 top-[12%] h-56 w-56 -translate-x-1/2 rounded-full bg-[#f58426]/22 blur-3xl sm:top-[16%] sm:h-72 sm:w-72" />
            <Image
              src="/jalen-brunson/brunson-cartoon.png"
              alt="Jalen Brunson"
              priority
              width={698}
              height={1024}
              sizes="(min-width: 768px) 768px, 100vw"
              className="sticker-image absolute bottom-1 left-1/2 h-[410px] w-auto -translate-x-1/2 sm:h-[530px]"
            />
          </div>

          <KingMeter snapshot={snapshot} />

          <CommentStream tweets={snapshot.recentTweets} />
        </section>
      </div>
    </main>
  );
}
