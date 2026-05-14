---
name: catvod-quickjs-spider
description: >
  Complete reference for writing QuickJS spider scripts on CatVod/Fongmi platform. Use when user asks to "write a spider", "写爬虫",
  "写源", "create a JS source", "开发视频源", mentions CatVod/TVBox/fongmi spider, needs to parse video site APIs, build video
  streaming sources, or debug existing spider JS. Covers all platform globals (req, md5X, aesX, s2t, cheerio), 7 required methods,
  JSON return formats, filter system, and common pitfalls. Triggers on any spider/源/crawler development request in Chinese or English.
---

# CatVod QuickJS 爬虫编写指南

## 爬虫是什么

一个 JS 文件放到 HTTP 服务器上，JSON 配置里引用 `api` 字段，平台自动加载执行。

```json
{"key":"my_site","name":"我的站点","type":3,"api":"https://example.com/spider.js","ext":"{\"host\":\"https://site.com\"}"}
```

## 可用的全局函数

所有函数已预注入，直接调用，无需 import。

### HTTP 请求

```js
let resp = req(url, options);  // 同步，蕞常用
// resp.code — HTTP 状态码
// resp.content — 响应体字符串
// resp.headers — 响应头对象

// options 完整选项
{
  method: "get"|"post",           // 默认 get
  headers: {"User-Agent":"...", "Cookie":"..."},
  data: {...},                    // POST 数据对象
  postType: "json"|"form"|"form-data",  // 默认 json
  body: "...",                    // 原始请求体
  timeout: 10000,                 // 毫秒，默认 10000
  buffer: 0|1|2,                  // 0=字符串 1=字节数组 2=Base64
  redirect: 0|1                   // 是否跟随跳转，默认 1
}
```

**POST 示例：**
```js
// JSON POST
let r = req(url, {method:"post", data:{page:1}, headers:{"Content-Type":"application/json"}});

// Form POST
let r = req(url, {method:"post", data:{kw:"搜索词"}, postType:"form"});

// 带 Cookie
let r = req(url, {headers:{"Cookie":"session=abc","Referer":"https://site.com/"}});
```

### 加密函数

```js
md5X("hello")                              // "5d41402abc4b2a76b9719d911017c592"
aesX("AES/CBC/PKCS5", true, input, false, key, iv, true)
// aesX(mode, encrypt, input, inBase64, key, iv, outBase64)
rsaX("RSA/PKCS1", true, true, input, false, keyPEM, true)
// rsaX(mode, pub, encrypt, input, inBase64, keyPEM, outBase64)
```

### 简繁转换、URL、调试

```js
s2t("中国")          // "中國"
t2s("中國")          // "中国"
joinUrl("http://a.com/b/c", "../d")  // "http://a.com/d"
console.log("调试信息", obj)
local.get("rule","key") / local.set(...) / local.delete(...)
setTimeout(function(){}, 1000)   // 延迟执行
```

### 内置 JS 库

- **`cheerio`** — jQuery 风格 HTML 解析。`cheerio.load(html)`、`cheerio.jp(selector, html)`
- **`CryptoJS`** — AES、DES、SHA 等完整加密
- **`gbkTool()`** — GBK→UTF-8 编码转换
- **`compareTwoStrings(a,b)`** / **`findBestMatch(str,candidates)`** — 字符串相似度

## 必须实现的 7 个方法

所有方法返回 `JSON.stringify(obj)` 字符串。用 `async function` + `await req()` 模式。

### 1. `init(cfg)` — 初始化

```js
async function init(cfg) {
    if (cfg) {
        let c = typeof cfg === 'string' ? JSON.parse(cfg) : cfg;
        host = c.host;  // 从 ext 传入
    }
}
```

### 2. `home(filter)` — 首页分类

**返回格式：**
```json
{
  "class": [
    {"type_name":"电影","type_id":"1"},
    {"type_name":"电视剧","type_id":"2"}
  ],
  "filters": {
    "1": [{"key":"areaes","name":"地区","value":[{"n":"全部","v":""},{"n":"大陆","v":"大陆"}]}]
  }
}
```

Filter 支持的 key: `classes`(子分类), `areaes`(地区), `yeares`(年份), `sortby`(排序), `letter`(字母)

### 3. `homeVod()` — 首页推荐

```json
{"list":[{"vod_id":"123","vod_name":"片名","vod_pic":"http://...","vod_remarks":"备注"}]}
```

### 4. `category(tid, pg, filter, extend)` — 分类列表

入参: tid(字符串), pg(字符串页码), filter(boolean), extend(筛选参数对象)
```json
{"page":1,"pagecount":100,"limit":30,"total":3000,"list":[...]}
```

### 5. `detail(id)` — 影片详情（核心方法）

```json
{"list":[{
  "vod_id":"123","vod_name":"片名","vod_year":"2023","vod_area":"大陆",
  "vod_actor":"演员A","vod_director":"导演","vod_content":"简介",
  "vod_play_from":"线路1$$$线路2",
  "vod_play_url":"第1集$url1#第2集$url2$$$第1集$b1#第2集$b2"
}]}
```

分隔符规则：`$$$` 分源，`#` 分集，`$` 分集名和 URL

### 6. `search(wd, quick, pg)` — 搜索

```json
{"list":[{"vod_id":"123","vod_name":"结果","vod_pic":"","vod_remarks":""}]}
```

### 7. `play(flag, id, flags)` — 播放解析

```json
{"parse":0,"url":"https://.../video.m3u8"}                    // 直接播放
{"parse":1,"url":"https://.../player?id=123"}                  // 需解析器
```

### 导出

```js
export default { init, home, homeVod, category, detail, search, play };
```

## 常见踩坑

| 问题 | 解决 |
|------|------|
| `resp.content` 中文乱码 | 用 `buffer:1` 取字节数组，`gbkTool(arr)` 转 UTF-8 |
| 网站需要特殊 Referer/Cookie | 在 `headers` 里加 `Referer` 和 `Cookie` |
| `vod_play_url` 里 URL 含 `$` | 用 `replaceAll('$','%24')` 转义 |
| `type_id` 被当成数字 | 所有 ID 用字符串 `"1"` 不用 `1` |
| POST 请求参数不对 | 试 `postType:"form"` + `data:{...}` 发送表单 |
| 异步结果丢失 | 用 `async function` + `await req()`，不要用 `.then()` |
| 网站返回状态码 4xx/5xx | 检查 `resp.code`，`resp.content` 可能是空字符串 |
| filter 不生效 | key 必须用预定义的：`classes`/`areaes`/`yeares`/`sortby`/`letter` |

## 调试流程

```bash
# 本地文件测试
gradlew runTest -Pargs="D:/project/my_spider.js"

# 远程文件测试
gradlew runTest -Pargs="https://example.com/spider.js"

# 带 ext 参数
gradlew runTest -Pargs="https://example.com/spider.js {\"host\":\"https://site.com\"}"

# 批量测试
gradlew runTest   # 测 tvbox-main 和 X-main 所有爬虫
```

## 参考

- 完整示例代码 → `references/complete-example.md`
- 可选的扩展方法: `live(url)`, `sniffer()`→boolean, `isVideo(url)`→boolean, `action(action)`, `destroy()`
