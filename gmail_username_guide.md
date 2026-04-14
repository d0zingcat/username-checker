# Gmail 用户名查重完整指南

## 为什么要做这件事

注册一个新 Gmail，想要一个有意义、好记、又真正属于自己的用户名——不是系统随机推荐的那种。

但好的用户名早就被注册光了。直接在注册页面一个个试太慢，而且 Google 不会告诉你"这个被注册了，试试那个"，只会让你来回改。

所以目标变成了：**在注册之前就批量查清楚哪些名字还可用**，直接选一个满意的注册，不浪费时间。

这份文档记录了整个查重流程的技术细节，以及最终可用的候选用户名，方便以后复用或换其他关键词重新查。

---

## 背景

目标：找一个基于特定关键词的 Gmail 用户名，同时满足：

- 不超过 10 个字符
- 仅含字母和数字（无特殊字符）
- 通过 leet 变形保证全网唯一性
- 经 Google 官方注册 API 确认可用

---

## 整体流程

```
第一步：ychecker.com 初筛（快速排除明显已注册的）
    ↓
第二步：Google 注册 API 精确验证（官方直接确认）
```

---

## 用户名设计原则

**Leet 变形规则（保持可读性）：**

| 原字母 | 替换 | 说明 |
|--------|------|------|
| `e` | `3` | 视觉相近 |
| `y` | `7` | 视觉相近 |
| 两处同时替换 | | 可读性下降，不推荐 |

**后缀策略：**

在关键词后追加 4-5 字母的英文后缀，增加唯一性，总长度控制在 10 字符以内。

---

## 第一步：ychecker.com 初筛

这一步用于快速筛选，**不够准确**（存在误判），仅作参考。

### 接口说明

ychecker 的验证分两步：先获取 JWT token，再用 token 查询。

**Step 1：获取 JWT**

```bash
curl 'https://ychecker.com/app/payload?email=<用户名>%40gmail.com&use_credit_first=0' \
  -H 'accept: */*' \
  -b 'XSRF-TOKEN=<token>; sonjj_session=<session>' \
  -H 'referer: https://ychecker.com/' \
  -H 'user-agent: Mozilla/5.0'
```

返回示例：
```json
{"code":200,"msg":"OK","items":"eyJ0eXAiOiJKV1Qi..."}
```

`items` 字段即为 JWT。

**Step 2：检查邮箱**

```bash
curl 'https://api.sonjj.com/v1/check_email/?payload=<JWT>' \
  -H 'accept: */*' \
  -H 'origin: https://ychecker.com' \
  -H 'referer: https://ychecker.com/'
```

返回示例：
```json
// 已注册（有头像）
{"type":"Gmail","status":"Ok","avatar":"https://lh3.googleusercontent.com/..."}

// 未注册
{"type":"Gmail","status":"Disable","avatar":null}
```

### 如何获取新鲜 Cookie

JWT 和 cookie 均有时效性，使用前需重新抓包：

1. 打开浏览器 DevTools（F12）→ Network 标签
2. 访问 `https://ychecker.com`
3. 输入任意邮箱触发查询
4. 找到 `/app/payload` 请求 → 右键 Copy as cURL

---

## 第二步：Google 注册 API 精确验证

这是**官方的用户名可用性检查接口**，在 Gmail 注册流程中被调用，准确率 100%。

### 接口信息

```
POST https://accounts.google.com/lifecycle/_/AccountLifecyclePlatformSignupUi/data/batchexecute
```

关键 URL 参数：

| 参数 | 说明 |
|------|------|
| `rpcids=NHJMOd` | 用户名检查的 RPC 方法 ID |
| `f.sid` | 会话 ID，从注册页面自动生成 |
| `bl` | 前端构建版本号 |
| `TL` | 防 CSRF token，每次会话唯一 |

请求体（URL 编码前）：
```
f.req=[[["NHJMOd","[\"<用户名>\",1,0,null,[null,null,null,null,0,79786],0,40]",null,"generic"]]]&at=<AT值>&
```

### 响应格式解读

```
✅ 可用（响应中包含跳转到下一步的标志）：
...steps/signup/password...

❌ 已注册（无推荐替代名）：
[null,[]]

❌ 已注册（附带 Google 推荐的替代用户名）：
[null,[["推荐用户名1","推荐用户名2"]]]

⚠️ 格式错误（用户名长度不符合要求）：
[null,null,"Sorry, your username must be between 6 and 30 characters long."]
```

> 注意：`[null,[]]` 表示已注册但 Google 无推荐替代名，**不是可用**。只有响应中出现 `steps/signup/password` 才表示用户名可用。

### 如何抓取有效请求（重新获取 session）

> session 过期后（通常数小时）需要重新抓包，步骤如下：

1. 打开**无痕窗口**，访问 `https://accounts.google.com/signup`
2. 填写名字（随便填），点击下一步
3. 填写生日和性别，点击下一步，进入**用户名输入页**
4. 在用户名框输入任意内容（如 `testtest`），等待约 1 秒触发验证
5. 在 DevTools → Network 中筛选 `batchexecute`，找到 `rpcids=NHJMOd` 的请求
6. 右键 → **Copy as cURL**
7. 从中提取以下值，填入 `check_gmail.sh` 脚本顶部的变量：

| 脚本变量 | 来自请求的位置 |
|----------|----------------|
| `FSID` | URL 参数 `f.sid=` |
| `TL` | URL 参数 `TL=` |
| `AT` | `--data-raw` 中 `at=` 后的值（需 URL 解码 `%3A` → `:`）|
| `BL` | URL 参数 `bl=` |
| `GAPS_COOKIE` | Cookie 中 `__Host-GAPS=` 的值 |
| `NID_COOKIE` | Cookie 中 `NID=` 的值 |

---

## 完整验证结果

### 所有检查的候选用户名

| 用户名 | 长度 | 变形说明 | ychecker | Google API |
|--------|------|----------|----------|------------|
| `skyblue` | 7 | 原始 | — | ❌ 已注册 |
| `sk7blue` | 7 | y→7 | ❌ 已注册 | ❌ 已注册 |
| `blu3sky` | 7 | e→3 | ✅ 可用 | ❌ 已注册 |
| `blu3sk7` | 7 | e→3, y→7 | ✅ 可用 | ❌ 已注册 |
| `sk7blu3` | 7 | y→7, e→3 | ✅ 可用 | ❌ 已注册 |
| `blu3skygo` | 9 | e→3, +go | ✅ 可用 | ❌ 已注册 |
| `blu3skyray` | 10 | e→3, +ray | ✅ 可用 | ❌ 已注册 |
| `blu3skylux` | 10 | e→3, +lux | ✅ 可用 | ✅ **可用** |
| `blu3skydawn` | 11 | e→3, +dawn | — | ✅ **可用** |
| `blu3skywarm` | 11 | e→3, +warm | — | ✅ **可用** |
| `sk7bluego` | 9 | y→7, +go | ✅ 可用 | ❌ 已注册 |
| `sk7blueray` | 10 | y→7, +ray | — | ❌ 已注册 |
| `sk7bluelux` | 10 | y→7, +lux | ✅ 可用 | ❌ 已注册 |
| `sk7bluedawn` | 11 | y→7, +dawn | ✅ 可用 | ❌ 已注册 |
| `sk7bluewarm` | 11 | y→7, +warm | ✅ 可用 | ✅ **可用** |
| `blu3skyvibe` | 11 | e→3, +vibe | — | ✅ **可用** |
| `sk7bluevibe` | 11 | y→7, +vibe | — | ✅ **可用** |

> ychecker 存在误判，以 Google API 结果为准。

### 最终可用候选（Google API 确认）

| 用户名 | 长度 | 备注 |
|--------|------|------|
| `blu3skylux` | 10 | |
| `blu3skydawn` | 11 | |
| `blu3skywarm` | 11 | |
| `sk7bluewarm` | 11 | |
| `blu3skyvibe` | 11 | |
| `sk7bluevibe` | 11 | |

---

## 参考

- ychecker 在线工具：https://ychecker.com
- 验证脚本：`check_gmail.sh`（同目录，使用方法见脚本注释）
