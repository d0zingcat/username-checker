import { NextRequest, NextResponse } from "next/server";
import {
  buildGoogleRequest,
  parseGoogleResponse,
  type CheckPlatform,
  type CheckResult,
} from "@/lib/gmail-checker";
import type { SessionParams } from "@/lib/curl-parser";
import { checkPublicProfile, validateUsername } from "@/lib/platform-checker";

interface CheckRequestBody extends Partial<SessionParams> {
  username: string;
  platforms?: CheckPlatform[];
}

const DEFAULT_PLATFORMS: CheckPlatform[] = ["gmail", "github", "x"];
const PLATFORM_SET = new Set<CheckPlatform>(DEFAULT_PLATFORMS);

export async function POST(request: NextRequest) {
  let body: CheckRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        results: [
          {
            platform: "gmail",
            username: "",
            status: "error",
            message: "无效的请求体",
            suggestions: [],
          },
        ],
      },
      { status: 400 }
    );
  }

  const username = body.username?.trim().replace(/^@/, "");
  const platforms = normalizePlatforms(body.platforms);

  if (!username) {
    return NextResponse.json(
      {
        results: [
          {
            platform: "gmail",
            username: "",
            status: "error",
            message: "缺少用户名",
            suggestions: [],
          },
        ],
      },
      { status: 400 }
    );
  }

  const results = await Promise.all(
    platforms.map((platform) => checkPlatform(platform, username, body))
  );

  return NextResponse.json({ results });
}

async function checkPlatform(
  platform: CheckPlatform,
  username: string,
  params: Partial<SessionParams>
): Promise<CheckResult> {
  if (platform !== "gmail") {
    return checkPublicProfile(platform, username);
  }

  const validationError = validateUsername("gmail", username);
  if (validationError) {
    return {
      platform: "gmail",
      username,
      status: "error",
      message: validationError,
      suggestions: [],
    };
  }

  const { fsid, bl, tl, at, gaps_cookie, nid_cookie } = params;
  if (!fsid || !bl || !tl || !at || !gaps_cookie || !nid_cookie) {
    return {
      platform: "gmail",
      username,
      status: "error",
      message: "缺少 Gmail session 参数",
      suggestions: [],
    };
  }

  const session: SessionParams = { fsid, bl, tl, at, gaps_cookie, nid_cookie };
  const { url, headers, body } = buildGoogleRequest(username, session);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(10000),
    });

    const raw = await resp.text();
    return parseGoogleResponse(raw, username);
  } catch (err) {
    return {
      platform: "gmail",
      username,
      status: "error",
      message: `请求失败: ${err instanceof Error ? err.message : "未知错误"}`,
      suggestions: [],
    };
  }
}

function normalizePlatforms(platforms: CheckRequestBody["platforms"]): CheckPlatform[] {
  if (!platforms?.length) return DEFAULT_PLATFORMS;
  const filtered = platforms.filter((platform): platform is CheckPlatform =>
    PLATFORM_SET.has(platform)
  );
  return filtered.length > 0 ? filtered : DEFAULT_PLATFORMS;
}
