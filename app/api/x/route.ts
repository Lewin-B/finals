import {
  configureXFilteredStreamRule,
  getXRuleTag,
  getXStreamRule,
  isXBearerTokenConfigured,
  listXFilteredStreamRules,
} from "@/lib/x";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const configured = isXBearerTokenConfigured();

  if (!configured) {
    return Response.json({
      bearerTokenConfigured: false,
      rule: getXStreamRule(),
      tag: getXRuleTag(),
    });
  }

  const rules = await listXFilteredStreamRules();

  return Response.json({
    bearerTokenConfigured: true,
    rule: getXStreamRule(),
    rules,
    tag: getXRuleTag(),
  });
}

export async function POST() {
  const result = await configureXFilteredStreamRule();

  return Response.json({
    ok: true,
    ...result,
  });
}
