#!/usr/bin/env bash
# =============================================================================
# check_gmail.sh — Gmail 用户名可用性检查脚本
#
# 使用 Google 官方注册 API（NHJMOd）验证用户名是否已被注册。
#
# 用法：
#   ./check_gmail.sh [选项] [用户名...]
#
# 选项：
#   --curl              从剪贴板读取 curl 命令并自动提取 session 参数（macOS pbpaste）
#   --curl-file <文件>  从文件中读取 curl 命令
#
# 示例：
#   # 先在 DevTools 中 Copy as cURL，然后直接运行（从剪贴板读取）
#   ./check_gmail.sh --curl sk7blue blu3skygo
#
#   # 从文件读取 curl 命令
#   pbpaste > /tmp/curl.txt
#   ./check_gmail.sh --curl-file /tmp/curl.txt sk7blue blu3skygo
#
#   # 使用脚本内置 session（需手动更新配置区）
#   ./check_gmail.sh sk7blue blu3skygo blu3skydawn
#   ./check_gmail.sh sk7blue                        # 单个检查
#
# 批量模式（不传参数，直接跑内置候选列表）：
#   ./check_gmail.sh
#   ./check_gmail.sh --curl                         # 用新 session 跑内置列表
#
# 注意：
#   session 参数有时效性（通常数小时），过期后需重新抓包。
#   推荐用 --curl 从剪贴板自动读取，免去手动拆解参数的麻烦。
#   重新获取方法见 gmail_username_guide.md 中「如何抓取有效请求」一节。
# =============================================================================


# =============================================================================
# !! 配置区：session 过期后替换这里的值（或改用 --curl 参数自动提取） !!
# 来源：Google 注册页 DevTools → Network → batchexecute?rpcids=NHJMOd
# =============================================================================

# URL 参数 f.sid=
FSID="3345362658277654095"

# URL 参数 bl=
BL="boq_identity-account-creation-evolution-ui_20260412.09_p0"

# URL 参数 TL=
TL="AIgtPP0SeGG93Efdmq4wmuTLabXT1QrPTtYblBTtFRAq3PSPeYZQ24xjVnz5XmFa"

# --data-raw 中 at= 后的值（%3A 解码为 :）
AT="ALG5oF0snPvZf4yUfSX-30kZBVlf:1776092567809"

# Cookie __Host-GAPS 的值（含 1: 前缀）
GAPS_COOKIE="1:F7gitjxIbEIvtfdTuUdvYTAburnXeg:zvF_GoWIQUIS8XBX"

# Cookie NID 的值
NID_COOKIE="530=j5_4KPKFsNEOVNeEtDi0gIfwgoeBAQGqFKHH5aY2xr_ToyqmCSJsQQbX5jTSsf0pUqRKvsj2DuRP-RPJ9pmtZ4J-BP-ySRKks3Smuv71WSXtGKxqod9QVB_UUjQblDJbBQDECZl0LqjwitNlrBic26FUCpGd5A-nYSvTWHgI9xTzpGzKSELSmrtAPjpAgUmbPWx0NcZBwfxQ5ep_AZZKu9c"


# =============================================================================
# curl 命令解析函数
# =============================================================================

# 当使用 --curl 模式时，保存原始 curl 模板
CURL_TEMPLATE=""

parse_curl() {
  local curl_text="$1"
  # 保存原始 curl 文本作为模板
  CURL_TEMPLATE="$curl_text"

  # 提取关键参数用于显示确认（不用于发请求）
  local tmpfile
  tmpfile=$(mktemp)
  printf '%s' "$curl_text" > "$tmpfile"
  eval "$(python3 - "$tmpfile" << 'PYEOF'
import sys, re, urllib.parse

curl = open(sys.argv[1]).read()

url_m = re.search(r"""['"]?(https?://[^\s'"]+)['"]?""", curl)
url = url_m.group(1) if url_m else ""
params = dict(urllib.parse.parse_qsl(urllib.parse.urlparse(url).query))

fsid = params.get("f.sid", "")
bl = params.get("bl", "")
tl = params.get("TL", "")

# 提取 at= 值
at = ""
data_m = re.search(r"""(?:--data-raw|--data|-d)\s+['"]([^'"]+)['"]""", curl)
if data_m:
    body_decoded = urllib.parse.unquote(data_m.group(1))
    at_m = re.search(r'(?:^|&)at=([^&]+)', body_decoded)
    if at_m:
        at = at_m.group(1)

def shell_escape(s):
    return s.replace("'", "'\\''")

# 输出用于显示的变量
if fsid: print(f"_DISPLAY_FSID='{shell_escape(fsid)}'")
if bl:   print(f"_DISPLAY_BL='{shell_escape(bl)}'")
if tl:   print(f"_DISPLAY_TL='{shell_escape(tl)}'")
if at:   print(f"_DISPLAY_AT='{shell_escape(at)}'")

found = sum(1 for v in [fsid, bl, tl, at] if v)
if found == 0:
    print("echo '错误：未能从 curl 命令中识别出有效的 Google API 请求' >&2; exit 1", end="")
PYEOF
)"
  rm -f "$tmpfile"
}


# =============================================================================
# 批量模式候选列表（不传参数时使用，可自由编辑）
# =============================================================================

BATCH_NAMES=(
  sk7blue
  blu3skygo
  blu3skyray
  blu3skylux
  blu3skydawn
  blu3skywarm
  sk7bluewarm
)


# =============================================================================
# 核心检查函数
# =============================================================================

check_username() {
  local username="$1"
  local len=${#username}

  if [[ $len -lt 6 || $len -gt 30 ]]; then
    printf "[%d字符] %-20s  ⚠️  长度须在 6-30 字符之间\n" "$len" "${username}@gmail.com"
    return
  fi

  local raw

  if [[ -n "$CURL_TEMPLATE" ]]; then
    # --curl 模式：复用原始 curl 命令，只替换用户名
    # 通过临时文件传递 curl 模板，避免命令行参数/环境变量长度限制
    local tmpfile tmpscript
    tmpfile=$(mktemp)
    tmpscript=$(mktemp)
    printf '%s' "$CURL_TEMPLATE" > "$tmpfile"
    # 用 Python 替换用户名，生成可直接 bash 执行的 curl 命令
    python3 - "$tmpfile" "$username" "$tmpscript" << 'PYEOF'
import sys, re, urllib.parse

curl_text = open(sys.argv[1]).read()
username = sys.argv[2]
out_path = sys.argv[3]

# 直接在原始 curl 文本中替换用户名（支持 URL 编码和明文两种形式）
# URL 编码形式: %5C%22旧用户名%5C%22
modified = re.sub(
    r'(%5C%22)([A-Za-z0-9._]+?)(%5C%22)',
    r'\g<1>' + urllib.parse.quote(username) + r'\g<3>',
    curl_text, count=1
)
# 明文形式（如果 body 未编码）: \"旧用户名\"
if modified == curl_text:
    modified = re.sub(
        r'(\[\\")(.*?)(\\")',
        r'\g<1>' + username + r'\g<3>',
        curl_text, count=1
    )

# 确保有 -s 静默标志
if ' -s ' not in modified and ' --silent' not in modified:
    modified = modified.replace('curl ', 'curl -s ', 1)

with open(out_path, 'w') as f:
    f.write(modified)
PYEOF
    raw=$(bash "$tmpscript" 2>/dev/null)
    rm -f "$tmpfile" "$tmpscript"
  else
    # 传统模式：用脚本内置参数拼接请求
    local cookies="__Host-GAPS=${GAPS_COOKIE}; NID=${NID_COOKIE}"
    local base_url="https://accounts.google.com/lifecycle/_/AccountLifecyclePlatformSignupUi/data/batchexecute"
    local url_params="rpcids=NHJMOd&source-path=%2Flifecycle%2Fsteps%2Fsignup%2Fusername&f.sid=${FSID}&bl=${BL}&hl=en-US&TL=${TL}&_reqid=${RANDOM}9&rt=c"

    local at_encoded
    at_encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${AT}'))")

    local body="f.req=%5B%5B%5B%22NHJMOd%22%2C%22%5B%5C%22${username}%5C%22%2C1%2C0%2Cnull%2C%5Bnull%2Cnull%2Cnull%2Cnull%2C0%2C79786%5D%2C0%2C40%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&at=${at_encoded}&"

    raw=$(curl -s "${base_url}?${url_params}" \
      -H 'accept: */*' \
      -H 'content-type: application/x-www-form-urlencoded;charset=UTF-8' \
      -b "$cookies" \
      -H 'origin: https://accounts.google.com' \
      -H 'referer: https://accounts.google.com/' \
      -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36' \
      -H 'x-same-domain: 1' \
      -H 'x-goog-ext-278367001-jspb: ["GlifWebSignIn"]' \
      -H 'x-browser-channel: stable' \
      -H 'x-browser-copyright: Copyright 2026 Google LLC. All Rights reserved.' \
      -H 'x-browser-validation: jb22yUkoV3Npo3n6tSAI1eU+2lE=' \
      -H 'x-browser-year: 2026' \
      --data-raw "$body")
  fi

  local verdict
  verdict=$(RAW_RESPONSE="$raw" python3 << 'PYEOF'
import os, re, json

raw = os.environ.get('RAW_RESPONSE', '')

m = re.search(r'"NHJMOd","(\[.*?\])"', raw)
if not m:
    if '401' in raw or 'Unauthorized' in raw:
        print('ERR_SESSION  session 已过期，请重新抓包更新配置区')
    elif 'steps/signup/password' in raw:
        print('AVAILABLE')
    else:
        # 空响应或 session 状态异常，通常是 session 过期
        if not raw.strip():
            print('ERR_SESSION  响应为空，session 可能已过期，请重新抓包更新配置区')
        elif '"er"' in raw:
            print('ERR_SESSION  session 已过期，请重新抓包更新配置区')
        else:
            print('ERR_PARSE    ' + raw[:120].replace('\n', ' '))
    sys.exit()

val = m.group(1)

if val == '[null,[]]':
    print('TAKEN')
elif '[null,[[' in val:
    try:
        parsed = json.loads(val)
        suggestions = parsed[1][0] if parsed[1] else []
        if suggestions:
            print('TAKEN        Google 推荐: ' + ', '.join(suggestions[:3]))
        else:
            print('TAKEN')
    except:
        print('TAKEN')
elif 'steps/signup/password' in val:
    print('AVAILABLE')
elif 'must be between' in val:
    print('ERR_LENGTH   用户名长度不符合要求')
else:
    print('UNKNOWN      ' + val[:80])
PYEOF
)

  local tag="${verdict%%  *}"
  local detail="${verdict#*  }"

  case "$tag" in
    AVAILABLE)
      printf "[%d字符] %-20s  ✅ 可用\n" "$len" "${username}@gmail.com"
      ;;
    TAKEN)
      printf "[%d字符] %-20s  ❌ 已注册   %s\n" "$len" "${username}@gmail.com" "$detail"
      ;;
    ERR_SESSION)
      printf "[%d字符] %-20s  ⚠️  %s\n" "$len" "${username}@gmail.com" "$detail"
      ;;
    *)
      printf "[%d字符] %-20s  ?  %s\n" "$len" "${username}@gmail.com" "$verdict"
      ;;
  esac

  sleep 0.6
}


# =============================================================================
# 主逻辑
# =============================================================================

if ! command -v python3 &>/dev/null; then
  echo "错误：需要 python3，请先安装。"
  exit 1
fi
if ! command -v curl &>/dev/null; then
  echo "错误：需要 curl，请先安装。"
  exit 1
fi

# =============================================================================
# 参数解析
# =============================================================================

NAMES=()

print_parsed() {
  echo "  FSID=${_DISPLAY_FSID:0:20}..."
  echo "  BL=${_DISPLAY_BL}"
  echo "  TL=${_DISPLAY_TL:0:20}..."
  echo "  AT=${_DISPLAY_AT:0:20}..."
  echo ""
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --curl)
      if ! command -v pbpaste &>/dev/null; then
        echo "错误：--curl 依赖 pbpaste（macOS），其他系统请用 --curl-file" >&2
        exit 1
      fi
      curl_content="$(pbpaste)"
      if [[ -z "$curl_content" ]]; then
        echo "错误：剪贴板为空，请先在 DevTools 中右键 Copy as cURL" >&2
        exit 1
      fi
      echo "正在从剪贴板中提取 session 参数..."
      parse_curl "$curl_content"
      print_parsed
      shift
      ;;
    --curl-file)
      if [[ -z "${2:-}" || ! -f "$2" ]]; then
        echo "错误：--curl-file 后需要跟一个有效的文件路径" >&2
        exit 1
      fi
      echo "正在从文件 $2 中读取 curl 命令..."
      curl_content=$(<"$2")
      parse_curl "$curl_content"
      print_parsed
      shift 2
      ;;
    -h|--help)
      sed -n '2,/^# ====/{ /^# ====/d; s/^# \{0,1\}//; p; }' "$0"
      exit 0
      ;;
    -*)
      echo "未知选项: $1" >&2
      exit 1
      ;;
    *)
      NAMES+=("$1")
      shift
      ;;
  esac
done

echo "========================================"
echo "  Gmail 用户名可用性检查"
echo "========================================"
echo ""

if [[ ${#NAMES[@]} -gt 0 ]]; then
  for name in "${NAMES[@]}"; do
    check_username "$name"
  done
else
  echo "批量检查内置候选列表（共 ${#BATCH_NAMES[@]} 个）..."
  echo ""
  for name in "${BATCH_NAMES[@]}"; do
    check_username "$name"
  done
fi

echo ""
echo "完成。"
