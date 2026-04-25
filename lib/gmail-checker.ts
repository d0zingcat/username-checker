import type { SessionParams } from "./curl-parser";

export type CheckPlatform = "gmail" | "github" | "x";

export interface CheckResult {
  platform: CheckPlatform;
  username: string;
  status: "available" | "taken" | "error";
  message: string;
  suggestions: string[];
  url?: string;
}

export function buildGoogleRequest(
  username: string,
  session: SessionParams
): { url: string; headers: Record<string, string>; body: string } {
  const reqid = `${Math.floor(Math.random() * 900000) + 100000}9`;

  const params = new URLSearchParams({
    rpcids: "NHJMOd",
    "source-path": "/lifecycle/steps/signup/username",
    "f.sid": session.fsid,
    bl: session.bl,
    "hl": "en-US",
    TL: session.tl,
    _reqid: reqid,
    rt: "c",
  });

  const url = `https://accounts.google.com/lifecycle/_/AccountLifecyclePlatformSignupUi/data/batchexecute?${params.toString()}`;

  const inner = JSON.stringify([
    username, 1, 0, null, [null, null, null, null, 0, 79786], 0, 40,
  ]);
  const outer = JSON.stringify([[["NHJMOd", inner, null, "generic"]]]);
  const fReq = encodeURIComponent(outer);
  const atEncoded = encodeURIComponent(session.at);
  const body = `f.req=${fReq}&at=${atEncoded}&`;

  const headers: Record<string, string> = {
    accept: "*/*",
    "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    cookie: `__Host-GAPS=${session.gaps_cookie}; NID=${session.nid_cookie}`,
    origin: "https://accounts.google.com",
    referer: "https://accounts.google.com/",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
    "x-same-domain": "1",
  };

  return { url, headers, body };
}

export function parseGoogleResponse(raw: string, username: string): CheckResult {
  const base: CheckResult = {
    platform: "gmail",
    username,
    status: "error",
    message: "",
    suggestions: [],
  };

  const payloads = extractResponsePayloads(raw);

  if (raw.includes("401") || raw.includes("Unauthorized")) {
    return { ...base, message: "Session 已过期，请重新粘贴 curl 命令" };
  }
  if (!raw.trim()) {
    return { ...base, message: "响应为空，session 可能已过期" };
  }
  if (raw.includes('"er"')) {
    return { ...base, message: "Session 已过期，请重新粘贴 curl 命令" };
  }

  for (const val of payloads) {
    if (val.includes("steps/signup/password")) {
      return { ...base, status: "available" };
    }
  }

  for (const val of payloads) {
    if (val.trim() === "[null,[]]" || val.includes("[null,[]]")) {
      return { ...base, status: "taken" };
    }

    if (val.includes("[null,[[")) {
      const suggestions = extractSuggestions(val);
      return {
        ...base,
        status: "taken",
        suggestions: suggestions.slice(0, 3),
      };
    }

    if (val.includes("must be between")) {
      return { ...base, message: "用户名长度不符合要求（需 6-30 字符）" };
    }

    if (val.includes("isn't allowed") || val.includes("not allowed")) {
      return { ...base, status: "error", message: "该用户名不被允许使用" };
    }
  }

  return { ...base, message: `无法解析响应: ${raw.slice(0, 120).replace(/\s+/g, " ")}` };
}

function extractSuggestions(val: string): string[] {
  return extractSuggestionsFromNode(parseJsonSafely(val)).slice(0, 3);
}

function extractSuggestionsFromNode(node: unknown): string[] {
  if (typeof node === "string") {
    if (!node.includes("[null,[[")) return [];
    return extractSuggestionsFromNode(parseJsonSafely(node));
  }

  if (!Array.isArray(node)) return [];

  const direct = node[1]?.[0];
  if (Array.isArray(direct)) {
    return direct.filter((v): v is string => typeof v === "string");
  }

  for (const item of node) {
    const nested = extractSuggestionsFromNode(item);
    if (nested.length > 0) return nested;
  }

  return [];
}

function parseJsonSafely(val: string): unknown {
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

function extractResponsePayloads(raw: string): string[] {
  const values: string[] = [];
  const seen = new Set<string>();

  const add = (value: string) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    values.push(value);
  };

  const walk = (node: unknown) => {
    if (typeof node === "string") {
      add(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (node && typeof node === "object") {
      for (const item of Object.values(node)) walk(item);
    }
  };

  add(raw);

  for (const match of raw.matchAll(/"NHJMOd","((?:\\.|[^"])*)"/g)) {
    try {
      add(JSON.parse(`"${match[1]}"`));
    } catch {
      add(match[1]);
    }
  }

  const normalized = raw.replace(/^\)\]\}'\s*/, "");
  for (const line of normalized.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || /^\d+$/.test(trimmed)) continue;
    try {
      walk(JSON.parse(trimmed));
    } catch {
      add(trimmed);
    }
  }

  return values;
}
