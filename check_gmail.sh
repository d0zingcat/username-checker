#!/usr/bin/env bash
# =============================================================================
# check_gmail.sh — Gmail 用户名可用性检查脚本
#
# 使用 Google 官方注册 API（NHJMOd）验证用户名是否已被注册。
#
# 用法：
#   ./check_gmail.sh <用户名1> [用户名2] [用户名3] ...
#
# 示例：
#   ./check_gmail.sh sk7blue blu3skygo blu3skydawn
#   ./check_gmail.sh sk7blue                        # 单个检查
#
# 批量模式（不传参数，直接跑内置候选列表）：
#   ./check_gmail.sh
#
# 注意：
#   session 参数有时效性（通常数小时），过期后需重新抓包填入下方配置区。
#   重新获取方法见 gmail_username_guide.md 中「如何抓取有效请求」一节。
# =============================================================================


# =============================================================================
# !! 配置区：session 过期后替换这里的值 !!
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

  local cookies="__Host-GAPS=${GAPS_COOKIE}; NID=${NID_COOKIE}"
  local base_url="https://accounts.google.com/lifecycle/_/AccountLifecyclePlatformSignupUi/data/batchexecute"
  local url_params="rpcids=NHJMOd&source-path=%2Flifecycle%2Fsteps%2Fsignup%2Fusername&f.sid=${FSID}&bl=${BL}&hl=en-US&TL=${TL}&_reqid=${RANDOM}9&rt=c"

  # URL-encode the AT token
  local at_encoded
  at_encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${AT}'))")

  local body="f.req=%5B%5B%5B%22NHJMOd%22%2C%22%5B%5C%22${username}%5C%22%2C1%2C0%2Cnull%2C%5Bnull%2Cnull%2Cnull%2Cnull%2C0%2C79786%5D%2C0%2C40%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&at=${at_encoded}&"

  local raw
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

  local verdict
  verdict=$(echo "$raw" | python3 - << 'PYEOF'
import sys, re, json

raw = sys.stdin.read()

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

echo "========================================"
echo "  Gmail 用户名可用性检查"
echo "========================================"
echo ""

if [[ $# -gt 0 ]]; then
  for name in "$@"; do
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
