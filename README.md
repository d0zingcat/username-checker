# username-checker

批量检查 Gmail 用户名是否可用，基于 Google 官方注册 API（`NHJMOd`）。

## 快速开始

依赖：`bash`、`curl`、`python3`

```bash
# 检查指定用户名
./check_gmail.sh sk7blue blu3skygo blu3skydawn

# 批量检查内置候选列表
./check_gmail.sh
```

## Session 配置

脚本依赖 Google 注册页的 session 参数，有效期通常数小时。过期后需重新抓包，将以下值填入 `check_gmail.sh` 顶部配置区：

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
