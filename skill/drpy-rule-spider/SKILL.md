---
name: drpy-rule-spider
description: >
  Complete guide for writing DrPy rule-based spiders (var rule = {...}) for CatVod/TVBox. Use when user asks to "write a DrPy spider", "写drpy源", "写规则源",
  "写drpy爬虫", "写drpy规则", mentions DrPy/dr_py/drpy2, needs to create a rule-based video source, or asks about $js/muban/PC_UA/pdfh/pdfa/template variables.
  Covers rule object fields, URL patterns (fyclass/fypage/**), parse expressions (&& selectors), filter system, template inheritance, and all global functions available to rule code.
  Triggers on any DrPy/rule source development request.
---

# DrPy 规则爬虫编写指南

DrPy 是一种声明式爬虫框架——不需要写搜索/详情/播放方法，只需定义一个 `rule` 对象，引擎自动完成所有逻辑。

```js
var rule = {
    title: '我的站点',
    host: 'https://example.com',
    url: '/type/fyclass/page/fypage',
    class_name: '电影&电视剧&综艺&动漫',
    class_url: '1&2&3&4',
    searchUrl: '/search?wd=**',
    // ... 解析规则
}
```

## 规则对象字段

### 基础配置

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | string | 源名称 |
| `host` | string | 网站域名 |
| `模板` | string | 继承模板：`'mxpro'`, `'mxone5'`, `'首图'`, `'首图2'`, `'海螺3'`, `'默认'` |
| `headers` | object | 请求头，UA 可直接写 `PC_UA` / `MOBILE_UA` |
| `timeout` | number | 超时毫秒，默认 5000 |
| `encoding` | string | 页面编码，如 `'gbk'`, `'gb2312'` |
| `searchable` | 0/1/2 | 搜索能力：0=无 1=站内 2=全局，默认 2 |

### URL 模板

| 字段 | 占位符 | 示例 |
|------|--------|------|
| `url` | `fyclass`, `fypage`, `fyfilter` | `'/type/fyclass/page/fypage'` |
| `searchUrl` | `**`(关键词), `fypage` | `'/search?wd=**&page=fypage'` |
| `detailUrl` | `fyid` | `'/detail/fyid.html'` |
| `homeUrl` | — | `'/'` 或不填 |

`searchUrl` 支持 POST：
```js
searchUrl: '/search.php;post'                          // Form POST
searchUrl: '/api/search#{"kw":"**"};postjson'           // JSON POST
```

`url` 分页括号语法（首页不同 URL）：
```js
url: '/list/fyclass/fypage.html[/list/fyclass.html]'    // []内=首页
```

### 分类配置

两种方式，任选其一：

**方式一：简单映射**
```js
class_name: '电影&电视剧&综艺&动漫',   // & 分隔，要和 class_url 一一对应
class_url: '1&2&3&4',
```

**方式二：HTML 解析**
```js
class_parse: '.nav li;a&&Text;a&&href;/(\\d+).html'  // 选择器;名称解析;链接解析;ID正则
```

排除分类：`cate_exclude: '首页|留言|下载'`

### 筛选器

```js
filterable: 1,                                       // 开启筛选UI
filter: {
    "1": [                                           // type_id=1 的分类
        { key: "areaes", name: "地区", value: [
            { n: "全部", v: "" },
            { n: "大陆", v: "大陆" }
        ]}
    ]
},
filter_url: '{{fl.areaes}}-{{fl.sortby}}---fypage',   // 筛选参数如何拼接到URL
filter_def: { "1": { areaes: "" } }                   // 默认筛选值
```

Filter key 必须是: `classes`, `areaes`, `yeares`, `sortby`, `letter`

### 解析表达式语法

使用 `&&` 链式选择器：`'父元素&&子元素&&Text'`（取文本）或 `'img&&src'`（取属性）。

```js
// 简单元素
'a&&Text'            → 取 a 标签文本
'img&&data-src'      → 取 data-src 属性
'.lazyload&&data-original' → 懒加载图片真实地址

// 层叠选择
'.item&&.title&&Text'  → 在 .item 内找 .title，取文本
'.item&&img&&src'      → 在 .item 内找 img，取 src

// 位置过滤
'li:gt(2):lt(8)'      → 第3到第8个 li
'li:eq(0)'            → 第1个 li
```

### 列表解析（必填）

| 字段 | 用途 | 模式 |
|------|------|------|
| `推荐` | 首页推荐列表 | CSS 选择器 或 `'*'`(复用一级) 或 `js:代码` |
| `一级` | 分类列表 | 同 |
| `搜索` | 搜索结果 | 同，或 `'*'` 复用一级 |
| `二级` | 详情页(重要) | CSS 或 `'*'`(无详情) 或 `js:代码` 或 object |

**一级/推荐/搜索 的 CSS 模式（5段，分号分隔）：**
```js
推荐: '容器选择器;标题解析;图片解析;备注解析;链接解析'
// 例：
一级: '.module-item;.module-item-title&&Text;.lazyload&&data-original;.module-item-text&&Text;a&&href'
```

**二级 CSS 模式（用 object）：**
```js
二级: {
    title: '.title&&Text;.type&&Text',                  // 片名;类型名(分号)
    img: '.poster&&src',
    desc: '.remarks&&Text;.year&&Text;;;',              // 备注;年份;地区;演员;导演
    content: '.desc&&Text',
    tabs: '.tab-list&&li',                              // 播放源标签
    lists: '.play-list-{id}&&a',                        // 选集列表({id}=标签序号)
}
```

**二级 js: 模式：**
```js
二级: `js:
    let $ = cheerio.load(html);
    VOD.vod_name = $('.title').text();
    // ... 解析 HTML，填充 VOD 对象
    TABS = ['线路1'];                                    // 源名数组
    LISTS = [['第1集$url1', '第2集$url2']];              // url 数组的数组
`
```

`VOD` 对象字段: `vod_id, vod_name, vod_pic, vod_year, vod_area, type_name, vod_actor, vod_director, vod_content, vod_play_from, vod_play_url`

### 播放配置

```js
play_parse: true,                                       // 是否需要解析器
play_json: [{ re: '*', json: { parse: 0, jx: 0 } }],  // 直接播放
lazy: `js:
    // id 是选集 URL，处理后返回 {parse, jx, url}
    let realUrl = request(id).content;
    return { parse: 0, url: realUrl };
`
```

### 高级字段

| 字段 | 说明 |
|------|------|
| `预处理` | `js:code` — 在所有请求前执行，可设置 Cookie |
| `tab_remove` | 要移除的播放源名数组 |
| `tab_order` | 播放源排序数组 |
| `tab_rename` | `{旧名: 新名}` 重命名源 |
| `pagecount` | `{type_id: 最大页数}` 限制翻页 |
| `double` | `true` 表示首页双层 HTML（先取外层再取内层） |
| `图片来源` | 字符串，拼到所有图片 URL 后面 |

### 可用的全局函数（js: 代码中使用）

```js
// HTTP
request(url, options)          // GET/POST
post(url, options)             // POST
fetch(url)                     // GET
getHtml(url)                   // 带 Cookie 的 GET

// HTML 解析
cheerio.load(html)             // jQuery 风格
pdfh(html, '.sel&&Text')       // 取单个值
pdfa(html, '.sel&&Text')       // 取数组
pd(html, '.sel&&href', baseUrl) // 取 URL（自动补全）
cheerio.jinja2(tpl, ctx)       // Jinja2 模板

// 编码
encodeStr(str, 'gbk')          // UTF-8 → GBK
decodeStr(str, 'gbk')          // GBK → UTF-8

// 存储
setItem('key', 'val')          // 持久化
getItem('key')                 // 读取

// 工具
md5(str)                       // MD5
base64Encode/Decode(str)
urljoin(base, rel)             // URL 拼接
JSON.parse/stringify
```

### 预定义常量

`PC_UA`, `MOBILE_UA`, `UC_UA`, `IOS_UA` — User-Agent 字符串，可在 headers 中直接引用。

## 三种复杂度示例

**简单：** 纯 CSS 选择器，不需要写任何 JS → 参考 `references/simple-example.md`
**中等：** CSS + JS 混合（二级用 js: 代码） → 参考 `references/medium-example.md`
**复杂：** 全 JS 处理 + 模板继承 → 参考 `references/advanced-example.md`

## 调试

```bash
gradlew runTest -Pargs="D:/project/my_spider.js"
```

## 调试技巧

1. 引擎日志会打印到 stderr（`[JS]` 前缀），可看到 `init_test_start`、`home` 等标记
2. 在 js: 代码中加 `console.log(变量)` 打印调试信息
3. `二级=js:...` 出问题时，先确认 HTML 是否能正常获取（检查 `input` 变量）
4. 选择器不匹配时，试试简化选择器或加 `:eq(0)` 精确位置

## 参考文档

- `references/simple-example.md` — 纯 CSS 选择器完整示例
- `references/medium-example.md` — CSS + JS 混合示例
- `references/advanced-example.md` — 复杂 JS + 模板示例
- `references/parse-reference.md` — 解析表达式完整参考
