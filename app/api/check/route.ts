import { NextRequest, NextResponse } from "next/server";
import { buildGoogleRequest, parseGoogleResponse } from "@/lib/gmail-checker";
import type { SessionParams } from "@/lib/curl-parser";

interface CheckRequestBody extends SessionParams {
  username: string;
}

export async function POST(request: NextRequest) {
  let body: CheckRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { username: "", status: "error", message: "无效的请求体", suggestions: [] },
      { status: 400 }
    );
  }

  const { username, fsid, bl, tl, at, gaps_cookie, nid_cookie } = body;

  if (!username || !fsid || !bl || !tl || !at || !gaps_cookie || !nid_cookie) {
    return NextResponse.json(
      { username: username || "", status: "error", message: "缺少必要参数", suggestions: [] },
      { status: 400 }
    );
  }

  if (username.length < 6 || username.length > 30) {
    return NextResponse.json({
      username,
      status: "error",
      message: "用户名长度须在 6-30 字符之间",
      suggestions: [],
    });
  }

  const session: SessionParams = { fsid, bl, tl, at, gaps_cookie, nid_cookie };
  const { url, headers, body: reqBody } = buildGoogleRequest(username, session);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: reqBody,
      signal: AbortSignal.timeout(10000),
    });

    const raw = await resp.text();
    const result = parseGoogleResponse(raw, username);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({
      username,
      status: "error",
      message: `请求失败: ${err instanceof Error ? err.message : "未知错误"}`,
      suggestions: [],
    });
  }
}
