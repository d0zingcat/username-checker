# username-checker

批量检查 Gmail 用户名是否可用，基于 Google 官方注册 API（`NHJMOd`）。

## 快速开始

依赖：`bash`、`curl`、`python3`

```bash
# 在 DevTools 中 Copy as cURL，然后直接运行（从剪贴板自动读取，推荐）
./check_gmail.sh --curl sk7blue blu3skygo

# 或者把 curl 命令保存到文件
pbpaste > /tmp/curl.txt
./check_gmail.sh --curl-file /tmp/curl.txt sk7blue blu3skygo

# 使用脚本内置 session（需手动更新配置区）
./check_gmail.sh sk7blue blu3skygo blu3skydawn

# 批量检查内置候选列表
./check_gmail.sh
```

## Session 配置

脚本依赖 Google 注册页的 session 参数，有效期通常数小时。过期后有两种更新方式：

**方式一（推荐）：** 在 DevTools 中右键 Copy as cURL，然后运行 `./check_gmail.sh --curl`，脚本自动从剪贴板读取并解析。

**方式二：** 手动将以下值填入 `check_gmail.sh` 顶部配置区：

- `FSID` — URL 参数 `f.sid`
- `BL` — URL 参数 `bl`
- `TL` — URL 参数 `TL`
- `AT` — 请求体中 `at=` 的值
- `GAPS_COOKIE` — Cookie `__Host-GAPS`
- `NID_COOKIE` — Cookie `NID`

抓包步骤详见 [gmail_username_guide.md](gmail_username_guide.md)。

## 输出示例

```
[7字符] sk7blue@gmail.com     ✅ 可用
[9字符] blu3skygo@gmail.com   ❌ 已注册   Google 推荐: blu3skygo1, blu3skygo2
```

## 文件说明

- `check_gmail.sh` — 检查脚本
- `gmail_username_guide.md` — 完整技术文档（含 ychecker 初筛 + Google API 精确验证流程）

## 更新日志

### 2026-04-22

修复 `--curl` / `--curl-file` 模式下的两个 bug：

1. **curl 模板传参溢出**：DevTools 导出的 curl 命令含大量 cookie/header，作为 Python `sys.argv` 传递时触发 macOS `[Errno 63] File name too long`。改为写入临时文件，Python 从文件读取，再生成可执行脚本交由 `bash` 直接运行，避免 `shlex.split` 重建复杂引号结构时出错。

2. **响应解析 stdin 冲突**：`echo "$raw" | python3 - << 'PYEOF'` 中管道与 heredoc 同时作用于 stdin，heredoc 优先导致 `sys.stdin.read()` 读不到 curl 响应，所有结果误报为"session 过期"。改为通过环境变量 `RAW_RESPONSE` 传递响应内容。
