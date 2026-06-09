import "server-only";
import process from "node:process";

export const DEFAULT_X_STREAM_RULE =
  '("Jalen Brunson" OR Brunson OR @jalenbrunson1 OR #JalenBrunson) lang:en -is:retweet';

export const DEFAULT_X_RULE_TAG = "jalen-brunson-v1";

const X_API_BASE_URL = "https://api.x.com/2";

type XApiError = {
  detail?: string;
  errors?: unknown;
  status?: number;
  title?: string;
  type?: string;
};

type XRule = {
  id: string;
  tag?: string;
  value: string;
};

type XRulesResponse = {
  data?: XRule[];
  errors?: unknown;
  meta?: unknown;
};

export function getXStreamRule() {
  return process.env.X_STREAM_RULE ?? DEFAULT_X_STREAM_RULE;
}

export function getXRuleTag() {
  return process.env.X_RULE_TAG ?? DEFAULT_X_RULE_TAG;
}

export function isXBearerTokenConfigured() {
  return Boolean(process.env.X_BEARER_TOKEN);
}

function getXBearerToken() {
  const token = process.env.X_BEARER_TOKEN;

  if (!token) {
    throw new Error("X_BEARER_TOKEN must be set");
  }

  return token;
}

async function readXApiError(response: Response) {
  try {
    const body = (await response.json()) as XApiError;
    return body.detail ?? body.title ?? JSON.stringify(body);
  } catch {
    return response.statusText;
  }
}

async function xFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${X_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getXBearerToken()}`,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(
      `X API request failed (${response.status}): ${await readXApiError(response)}`,
    );
  }

  return response;
}

export async function listXFilteredStreamRules() {
  const response = await xFetch("/tweets/search/stream/rules");
  const payload = (await response.json()) as XRulesResponse;
  return payload.data ?? [];
}

export async function configureXFilteredStreamRule() {
  const existingRules = await listXFilteredStreamRules();
  const rule = {
    tag: getXRuleTag(),
    value: getXStreamRule(),
  };

  const existingRuleIds = existingRules.map((existingRule) => existingRule.id);

  if (existingRuleIds.length) {
    await xFetch("/tweets/search/stream/rules", {
      body: JSON.stringify({
        delete: {
          ids: existingRuleIds,
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  }

  const response = await xFetch("/tweets/search/stream/rules", {
    body: JSON.stringify({
      add: [rule],
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return {
    deletedRuleCount: existingRuleIds.length,
    result: await response.json(),
    rule,
  };
}

export async function ensureXFilteredStreamRule() {
  const rules = await listXFilteredStreamRules();
  const rule = {
    tag: getXRuleTag(),
    value: getXStreamRule(),
  };
  const ruleAlreadyConfigured =
    rules.length === 1 &&
    rules[0]?.tag === rule.tag &&
    rules[0]?.value === rule.value;

  if (ruleAlreadyConfigured) {
    return {
      configured: false,
      deletedRuleCount: 0,
      rule,
    };
  }

  return {
    configured: true,
    ...(await configureXFilteredStreamRule()),
  };
}

export function openXFilteredStream(signal?: AbortSignal) {
  return xFetch(
    "/tweets/search/stream?tweet.fields=author_id,created_at,lang,public_metrics&expansions=author_id&user.fields=username,name",
    {
      headers: {
        Accept: "application/json",
      },
      signal,
    },
  );
}
