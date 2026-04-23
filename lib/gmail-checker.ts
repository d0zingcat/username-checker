import type { SessionParams } from "./curl-parser";

export interface CheckResult {
  username: string;
  status: "available" | "taken" | "error";
  message: string;
  suggestions: string[];
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
    username,
    status: "error",
    message: "",
    suggestions: [],
  };

  const m = raw.match(/"NHJMOd","(\[.*?\])"/);

  if (!m) {
    if (raw.includes("401") || raw.includes("Unauthorized")) {
      return { ...base, message: "Session 已过期，请重新粘贴 curl 命令" };
    }
    if (raw.includes("steps/signup/password")) {
      return { ...base, status: "available" };
    }
    if (!raw.trim()) {
      return { ...base, message: "响应为空，session 可能已过期" };
    }
    if (raw.includes('"er"')) {
      return { ...base, message: "Session 已过期，请重新粘贴 curl 命令" };
    }
    return { ...base, message: `无法解析响应: ${raw.slice(0, 120)}` };
  }

  const val = m[1];

  if (val === "[null,[]]") {
    return { ...base, status: "taken" };
  }

  if (val.includes("[null,[[")) {
    try {
      const parsed = JSON.parse(val);
      const suggestions: string[] = parsed[1]?.[0] || [];
      return {
        ...base,
        status: "taken",
        suggestions: suggestions.slice(0, 3),
      };
    } catch {
      return { ...base, status: "taken" };
    }
  }

  if (val.includes("steps/signup/password")) {
    return { ...base, status: "available" };
  }

  if (val.includes("must be between")) {
    return { ...base, message: "用户名长度不符合要求（需 6-30 字符）" };
  }

  if (val.includes("isn't allowed") || val.includes("not allowed")) {
    return { ...base, status: "error", message: "该用户名不被允许使用" };
  }

  return { ...base, message: `未知响应: ${val.slice(0, 80)}` };
}
