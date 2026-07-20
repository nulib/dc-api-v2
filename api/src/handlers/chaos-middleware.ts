import type { MiddlewareHandler } from "hono/types";
import { createMiddleware } from "hono/factory";
import { readFileSync } from "fs";
import type { ContentfulStatusCode } from "hono/utils/http-status";

type ErrorRule = {
  pattern: string;
  effect: "error";
  status: number;
  chance: number; // 0–1
};

type DelayRule = {
  pattern: string;
  effect: "delay";
  ms: number | [number, number];
};

type ChaosRule = ErrorRule | DelayRule;

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/:[^/]+/g, "[^/]+");
  // Allow any number of leading path segments so patterns work regardless of
  // mount prefix (e.g. /works/:id matches both /works/123 and /api/v2/works/123).
  return new RegExp(`^(/[^/]+)*${escaped}(/.*)?$`);
}

function loadConfig(): ChaosRule[] | null {
  const raw = process.env["CHAOS_CONFIG"];
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ChaosRule[];
  } catch {
    try {
      return JSON.parse(readFileSync(raw, "utf-8")) as ChaosRule[];
    } catch {
      console.error(`[chaos] Failed to load config from path: ${raw}`);
      return null;
    }
  }
}

const rules = loadConfig();

import type { Context } from "hono";

// Each handler returns true if it short-circuits (i.e. a response was sent).
type RuleHandler<T extends ChaosRule> = (
  c: Context,
  rule: T,
) => ReturnType<MiddlewareHandler>;

const applyError: RuleHandler<ErrorRule> = async (c, rule) => {
  if (Math.random() >= rule.chance) return;
  return c.json(
    { error: `Chaos rule triggered: ${rule.pattern}` },
    rule.status as ContentfulStatusCode,
  );
};

const applyDelay: RuleHandler<DelayRule> = async (_c, rule) => {
  const [lo, hi] = Array.isArray(rule.ms) ? rule.ms : [rule.ms, rule.ms];
  await new Promise((res) => setTimeout(res, lo + Math.random() * (hi - lo)));
};

const handlers = {
  error: applyError,
  delay: applyDelay,
} satisfies {
  [K in ChaosRule["effect"]]: RuleHandler<Extract<ChaosRule, { effect: K }>>;
};

// Iterate all matching rules. Delay rules accumulate; an error rule that fires
// short-circuits immediately. If an error rule doesn't fire, keep checking.
const createChaos = (rules: ChaosRule[] | null) => {
  if (!rules || rules.length === 0) return null;

  return createMiddleware(async (c, next) => {
    const path = new URL(c.req.url).pathname;

    for (const rule of rules) {
      if (!patternToRegex(rule.pattern).test(path)) continue;
      const handler = handlers[rule.effect] as RuleHandler<typeof rule>;
      const handlerResponse = await handler(c, rule);
      if (handlerResponse) return handlerResponse;
    }

    await next();
  });
};

const logRules = (rules: ChaosRule[] | null) => {
  if (!rules || rules.length === 0) return;
  console.warn("[chaos] Loaded rules:");
  for (const rule of rules) {
    if (rule.effect === "error") {
      console.warn(
        `[chaos]   ${rule.pattern} -> error ${rule.status} (${rule.chance})`,
      );
    } else if (rule.effect === "delay") {
      const ms = Array.isArray(rule.ms)
        ? `${rule.ms[0]}-${rule.ms[1]}`
        : rule.ms;
      console.warn(`[chaos]   ${rule.pattern} -> delay ${ms}ms`);
    }
  }
};

logRules(rules ?? []);
export default createChaos(rules);
