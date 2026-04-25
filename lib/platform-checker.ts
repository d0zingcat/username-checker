import type { CheckPlatform, CheckResult } from "./gmail-checker";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

const PROFILE_URLS: Record<Exclude<CheckPlatform, "gmail">, (username: string) => string> = {
  github: (username) => `https://github.com/${username}`,
  x: (username) => `https://x.com/${username}`,
};

export function validateUsername(platform: CheckPlatform, username: string): string | null {
  if (platform === "gmail") {
    if (username.length < 6 || username.length > 30) {
      return "Gmail 用户名长度须在 6-30 字符之间";
    }
    return null;
  }

  if (platform === "github") {
    if (username.length < 1 || username.length > 39) {
      return "GitHub 用户名长度须在 1-39 字符之间";
    }
    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(username)) {
      return "GitHub 用户名只能包含字母、数字、连字符，且不能以连字符开头或结尾";
    }
    if (username.includes("--")) {
      return "GitHub 用户名不能包含连续连字符";
    }
    return null;
  }

  if (username.length < 4 || username.length > 15) {
    return "X 用户名长度须在 4-15 字符之间";
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return "X 用户名只能包含字母、数字、下划线";
  }
  return null;
}

export async function checkPublicProfile(
  platform: Exclude<CheckPlatform, "gmail">,
  username: string
): Promise<CheckResult> {
  const url = PROFILE_URLS[platform](username);
  const validationError = validateUsername(platform, username);
  const base: CheckResult = {
    platform,
    username,
    status: "error",
    message: "",
    suggestions: [],
    url,
  };

  if (validationError) {
    return { ...base, message: validationError };
  }

  try {
    const resp = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent": USER_AGENT,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    if (resp.status === 404) {
      return { ...base, status: "available" };
    }

    if (resp.status === 429) {
      return { ...base, message: "请求过于频繁，请稍后重试" };
    }

    const text = await resp.text();
    if (platform === "x" && isMissingXProfile(text)) {
      return { ...base, status: "available" };
    }

    if (resp.ok) {
      return { ...base, status: "taken" };
    }

    return { ...base, message: `平台返回 HTTP ${resp.status}` };
  } catch (err) {
    return {
      ...base,
      message: `请求失败: ${err instanceof Error ? err.message : "未知错误"}`,
    };
  }
}

function isMissingXProfile(html: string): boolean {
  return [
    "This account doesn’t exist",
    "This account doesn't exist",
  ].some((marker) => html.includes(marker));
}
