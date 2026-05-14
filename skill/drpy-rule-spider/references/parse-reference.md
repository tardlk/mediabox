# 解析表达式完整参考

## 选择器语法

```
容器选择器;标题解析;图片解析;备注解析;链接解析[;内容解析]
```

每段用分号`;`分隔。每段内部用`&&`链式选择。

### 基本格式

```
CSS选择器&&二级选择器&&属性名
```

- `div.title&&Text` — 找 `div.title`，取文本
- `a&&href` — 找 `a`，取 `href` 属性
- `img&&data-src` — 找 `img`，取 `data-src` 属性
- `.lazyload&&data-original` — 懒加载图片

### 链式嵌套

```
外层&&内层&&最内层&&属性
```

- `.item&&.pic&&img&&src` — 在 `.item` → `.pic` → `img`，取 `src`
- `li&&a&&style` — 取 `a` 的 `style` 属性（自动提取 `url(...)` 中的图片地址）

### 位置选择

- `:eq(n)` — 第 n 个元素（从 0 开始）
- `:gt(n)` — 大于第 n 个
- `:lt(n)` — 小于第 n 个
- `:first` / `:last` — 第一个/最后一个
- `:has(selector)` — 包含匹配子元素的元素

例：`li:gt(1):lt(5)&&a&&Text` — 取第 2 到第 4 个 li 中的 a 标签文本

### 多源拼接

链接解析可以用 `+` 把多个 URL 拼成一个 vod_id：

```
a&&href+.pic&&data-url
```
结果：`url1$url2`（`$` 分隔）

## 分段详解

### title 段（名称）

```
`.title&&Text`          → 取文本
`.title&&a&&Text`       → 链式取文本
`h1&&Text;.type&&Text`  → 多段用分号，分别对应片名和类型
```

### img 段（图片）

```
`img&&src`              → 取 src
`img&&data-original`    → 取懒加载原图
`.pic&&style`           → 从 style 中提取 url(...)
```

### desc 段（备注/描述）

对于一级/搜索列表，取 vod_remarks。
```
`.note&&Text`           → 取文本
```
`*` 表示跳过（用默认值）。

对于二级详情，desc 分 5 段用分号分隔：
```
remarks;year;area;actor;director
```
每段可留空。例：
```
`.remarks&&Text;;;.actor&&Text;.director&&Text` 
// → remarks=文本, year=空, area=空, actor=文本, director=文本
```

### link 段（链接）

```
`a&&href`               → 取链接
`a&&href+.img&&src`     → 拼接多个值
```

### content 段（简介）

仅二级使用。
```
`.desc&&Text`           → 取文本
```

## 二级 tabs/lists

### tabs

- CSS: `'.tab-list&&li'` — 找标签元素
- `js:code` — 跑 JS，填充 `TABS = ['线路1', '线路2']`

### lists

- CSS: `'#playlist-{id}&&li'` — `{id}` 会被替换为标签序号（0,1,2...）
- CSS 自动提取：子元素内找 `a&&href` 做 URL，`Text` 做名称
- `js:code` — 跑 JS，填充 `LISTS = [['第1集$url1','第2集$url2'], ...]`

### tab_text / list_text / list_url

控制每个元素如何提取文本和 URL：
```js
list_text: 'body&&Text',          // 默认
list_url: 'a&&href',              // 默认
tab_text: 'body&&Text',           // 默认
```

## 常见问题

1. **选择器不匹配** — 加 `:eq(0)` 精确位置或 `.trim()` 去掉空格
2. **编码问题** — 设 `encoding: 'gbk'`，列表页和搜索可以分开设 `搜索编码: 'gb2312'`
3. **图片不显示** — 设 `图片来源: '@Referer=xxx@User-Agent=xxx'` 添加 Referer/UA 或替换域名
4. **Cookie 无效** — headers 中 Cookie 值如果是 `http://` 开头，引擎会自动请求该 URL 获取 Cookie
