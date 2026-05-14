# 常见问题排查

## 编码问题

### 中文乱码
```js
// 现象: resp.content 显示为乱码
// 原因: 网站使用 GBK/GB2312 编码
// 解决:
let resp = req(url, { buffer: 1 });  // 取字节数组
let html = gbkTool(resp.content);     // 转为 UTF-8 字符串
```

### URL 中文字符
```js
// 搜索关键词需要编码
let url = '/search?wd=' + encodeURIComponent('长安');
// 不要直接拼接中文
```

## HTTP 请求问题

### 请求被拒 (403/Forbidden)
```js
// 逐步加头，逐个排查
let resp = req(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 ...',   // 必须有
        'Referer': host + '/',               // 来源页
        'Accept': 'text/html,application/json',
        'Accept-Language': 'zh-CN,zh;q=0.9'
    }
});
```

### Cookie 管理
```js
// 方式 1: 手动维护 Cookie
let cookie = '';
let loginResp = req(loginUrl, { method:'post', data:{user:'a',pw:'b'} });
// 从 Set-Cookie 响应头提取 cookie
cookie = loginResp.headers['Set-Cookie'] || '';

let dataResp = req(dataUrl, { headers: {'Cookie': cookie} });

// 方式 2: 如果 API 不需要 Cookie，直接跳过
```

### POST 请求
```js
// JSON POST (大多数 API)
req(url, { method:'post', data:{key:'value'}, postType:'json' });

// Form POST (传统表单)
req(url, { method:'post', data:{kw:'搜索'}, postType:'form' });

// 原始 body
req(url, { method:'post', body:'raw_string' });
```

### 超时和重试
```js
let resp = req(url, { timeout: 15000 });  // 15 秒超时（默认 10 秒）
if (resp.code >= 500) {
    // 服务器错误，稍后重试
    resp = req(url, { timeout: 20000 });
}
```

## JSON 数据解析

### resp.content 是空字符串
```js
let resp = req(url);
if (!resp.content || resp.content === '') {
    console.log('空响应, code=' + resp.code);
    // 检查是否需要 Cookie 或 Referer
}
```

### JSON.parse 失败
```js
let resp = req(url);
try {
    let data = JSON.parse(resp.content);
} catch (e) {
    console.log('JSON 解析失败，原始内容:', resp.content.substring(0, 200));
    // 可能是 HTML 错误页，检查 resp.code
}
```

## play 返回格式

```js
// 直接播放（蕞常用）
return JSON.stringify({ parse: 0, url: 'https://.../video.m3u8' });

// 带自定义 header
return JSON.stringify({
    parse: 0,
    url: 'https://.../video.m3u8',
    header: { 'Referer': 'https://site.com/', 'User-Agent': 'MOBILE_UA' }
});

// 需要平台解析器处理
return JSON.stringify({ parse: 1, url: 'https://.../player?id=123' });
```

## vod_play_url 格式

```js
// 单个源，多个剧集: 剧集名$播放地址# 分隔
let urls = episodes.map(e => e.title + '$' + e.url).join('#');
// 结果: "第1集$url1#第2集$url2#第3集$url3"

// 多个源: 源的 URL 之间用 $$$ 分隔
let source1 = "第1集$url1#第2集$url2";
let source2 = "1080P$url3#720P$url4";
let allUrls = source1 + '$$$' + source2;

return JSON.stringify({
    list: [{
        // ...
        vod_play_from: '线路1$$$线路2',
        vod_play_url: allUrls
    }]
});
```
