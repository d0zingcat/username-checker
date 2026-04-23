"use client";

import { useState, useRef, useCallback } from "react";
import { parseCurlCommand, type SessionParams } from "@/lib/curl-parser";
import type { CheckResult } from "@/lib/gmail-checker";

export default function Home() {
  const [curlInput, setCurlInput] = useState("");
  const [session, setSession] = useState<SessionParams | null>(null);
  const [parseError, setParseError] = useState<string[]>([]);
  const [parseSuccess, setParseSuccess] = useState(false);

  const [usernameInput, setUsernameInput] = useState("");
  const [results, setResults] = useState<CheckResult[]>([]);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const abortRef = useRef(false);

  const handleParse = useCallback(() => {
    setParseSuccess(false);
    setParseError([]);
    const result = parseCurlCommand(curlInput);
    if (result.ok) {
      setSession(result.params);
      setParseSuccess(true);
    } else {
      setSession(null);
      setParseError(result.missing);
    }
  }, [curlInput]);

  const handleCheck = useCallback(async () => {
    if (!session) return;
    const usernames = usernameInput
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);
    if (usernames.length === 0) return;

    setResults([]);
    setChecking(true);
    setProgress({ current: 0, total: usernames.length });
    abortRef.current = false;

    for (let i = 0; i < usernames.length; i++) {
      if (abortRef.current) break;
      setProgress({ current: i + 1, total: usernames.length });

      try {
        const resp = await fetch("/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: usernames[i], ...session }),
        });
        const result: CheckResult = await resp.json();
        setResults((prev) => [...prev, result]);

        if (
          result.status === "error" &&
          result.message.includes("过期")
        ) {
          abortRef.current = true;
          break;
        }
      } catch {
        setResults((prev) => [
          ...prev,
          {
            username: usernames[i],
            status: "error",
            message: "请求失败",
            suggestions: [],
          },
        ]);
      }

      if (i < usernames.length - 1 && !abortRef.current) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    setChecking(false);
  }, [session, usernameInput]);

  const handleStop = useCallback(() => {
    abortRef.current = true;
  }, []);

  return (
    <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Gmail Username Checker</h1>
      <p className="text-sm text-foreground/60">
        粘贴从 DevTools 复制的 curl 命令，输入想查的用户名，批量检查可用性。
      </p>

      {/* Curl Input */}
      <section className="space-y-2">
        <label className="block text-sm font-medium">Curl 命令</label>
        <textarea
          className="w-full h-32 rounded-lg border border-foreground/10 bg-foreground/[.03] p-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          placeholder={"curl 'https://accounts.google.com/lifecycle/...' \\\n  -H 'content-type: ...' \\\n  -b '__Host-GAPS=...; NID=...' \\\n  --data-raw 'f.req=...&at=...&'"}
          value={curlInput}
          onChange={(e) => setCurlInput(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleParse}
            disabled={!curlInput.trim()}
            className="px-4 py-1.5 text-sm font-medium rounded-lg bg-foreground text-background hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            解析
          </button>
          {parseSuccess && (
            <span className="text-sm text-green-600">Session 参数解析成功</span>
          )}
          {parseError.length > 0 && (
            <span className="text-sm text-red-500">
              缺少参数: {parseError.join(", ")}
            </span>
          )}
        </div>
        {parseSuccess && session && (
          <details className="text-xs text-foreground/50">
            <summary className="cursor-pointer hover:text-foreground/70">查看解析结果</summary>
            <pre className="mt-1 p-2 rounded bg-foreground/[.03] overflow-x-auto">
{JSON.stringify(session, null, 2)}
            </pre>
          </details>
        )}
      </section>

      {/* Username Input */}
      <section className="space-y-2">
        <label className="block text-sm font-medium">用户名（每行一个）</label>
        <textarea
          className="w-full h-28 rounded-lg border border-foreground/10 bg-foreground/[.03] p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          placeholder={"blu3skylux\nblu3skydawn\nsk7bluewarm"}
          value={usernameInput}
          onChange={(e) => setUsernameInput(e.target.value)}
        />
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleCheck}
          disabled={!session || !usernameInput.trim() || checking}
          className="px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {checking ? `检查中 ${progress.current}/${progress.total}...` : "开始检查"}
        </button>
        {checking && (
          <button
            onClick={handleStop}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
          >
            停止
          </button>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">
            检查结果
            <span className="ml-2 text-foreground/50 font-normal">
              {results.filter((r) => r.status === "available").length} 个可用 / {results.length} 个已检查
            </span>
          </h2>
          <div className="rounded-lg border border-foreground/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-foreground/[.03] text-left text-xs text-foreground/50">
                  <th className="px-3 py-2">用户名</th>
                  <th className="px-3 py-2 w-12">长度</th>
                  <th className="px-3 py-2">状态</th>
                  <th className="px-3 py-2">备注</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr
                    key={i}
                    className={
                      r.status === "available"
                        ? "bg-green-50 dark:bg-green-950/30"
                        : r.status === "error"
                          ? "bg-yellow-50 dark:bg-yellow-950/20"
                          : ""
                    }
                  >
                    <td className="px-3 py-1.5 font-mono">{r.username}@gmail.com</td>
                    <td className="px-3 py-1.5 text-foreground/50">{r.username.length}</td>
                    <td className="px-3 py-1.5">
                      {r.status === "available" && <span className="text-green-600">可用</span>}
                      {r.status === "taken" && <span className="text-red-500">已注册</span>}
                      {r.status === "error" && <span className="text-yellow-600">错误</span>}
                    </td>
                    <td className="px-3 py-1.5 text-foreground/50 text-xs">
                      {r.suggestions.length > 0 && `推荐: ${r.suggestions.join(", ")}`}
                      {r.status === "error" && r.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
