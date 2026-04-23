export interface SessionParams {
  fsid: string;
  bl: string;
  tl: string;
  at: string;
  gaps_cookie: string;
  nid_cookie: string;
}

export type ParseResult = {
  ok: true;
  params: SessionParams;
} | {
  ok: false;
  missing: string[];
}

export function parseCurlCommand(raw: string): ParseResult {
  // Normalize: strip line-continuation backslashes, collapse to single line
  const normalized = raw.replace(/\\\n\s*/g, " ").trim();

  const missing: string[] = [];

  // Extract URL (first quoted string after 'curl')
  const urlMatch = normalized.match(/curl\s+['"]([^'"]+)['"]/);
  let fsid = "";
  let bl = "";
  let tl = "";

  if (urlMatch) {
    try {
      const url = new URL(urlMatch[1]);
      fsid = url.searchParams.get("f.sid") || "";
      bl = url.searchParams.get("bl") || "";
      tl = url.searchParams.get("TL") || "";
    } catch {
      // URL parse failed, try regex fallback
    }
  }

  // Regex fallback for URL params
  if (!fsid) {
    const m = normalized.match(/f\.sid=([^&\s'"]+)/);
    fsid = m ? m[1] : "";
  }
  if (!bl) {
    const m = normalized.match(/[?&]bl=([^&\s'"]+)/);
    bl = m ? m[1] : "";
  }
  if (!tl) {
    const m = normalized.match(/[?&]TL=([^&\s'"]+)/);
    tl = m ? m[1] : "";
  }

  if (!fsid) missing.push("f.sid");
  if (!bl) missing.push("bl");
  if (!tl) missing.push("TL");

  // Extract cookies from -b or --cookie
  let gaps_cookie = "";
  let nid_cookie = "";
  const cookieMatch = normalized.match(/(?:-b|--cookie)\s+['"]([^'"]+)['"]/);
  if (cookieMatch) {
    const cookieStr = cookieMatch[1];
    const gapsMatch = cookieStr.match(/__Host-GAPS=([^;]+)/);
    gaps_cookie = gapsMatch ? gapsMatch[1].trim() : "";
    const nidMatch = cookieStr.match(/NID=([^;]+)/);
    nid_cookie = nidMatch ? nidMatch[1].trim() : "";
  }

  if (!gaps_cookie) missing.push("__Host-GAPS");
  if (!nid_cookie) missing.push("NID");

  // Extract 'at' from --data-raw or --data or -d
  let at = "";
  const dataMatch = normalized.match(/(?:--data-raw|--data|-d)\s+['"]([^'"]+)['"]/);
  if (dataMatch) {
    const dataStr = dataMatch[1];
    const atMatch = dataStr.match(/[&?]?at=([^&]+)/);
    if (atMatch) {
      try {
        at = decodeURIComponent(atMatch[1]);
      } catch {
        at = atMatch[1];
      }
    }
  }

  if (!at) missing.push("at");

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  return {
    ok: true,
    params: { fsid, bl, tl, at, gaps_cookie, nid_cookie },
  };
}
