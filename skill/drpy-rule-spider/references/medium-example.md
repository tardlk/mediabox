# 中等示例 — CSS + JS 混合

xzys.js — 云盘站，分类用 CSS，详情用 JS 动态解析。

```js
var rule = {
    title: '校长影视[云盘]',
    host: 'https://xzys.fun',
    homeUrl: '/',
    url: '/fyclass.html?page=fypage',
    searchUrl: '/search.html?keyword=**',
    searchable: 2,
    quickSearch: 0,
    filterable: 0,
    headers: { 'User-Agent': 'PC_UA' },
    timeout: 5000,
    // 简单分类
    class_name: '电视剧&电影&动漫&纪录片&综艺',
    class_url: 'dsj&dy&dm&jlp&zy',
    // 首页推荐 — 检查是否为双层
    double: true,
    推荐: 'div.container div.row a:has(>img);img&&alt;img&&src;img&&alt;a&&href',
    // 分类列表 — '*' 表示复用推荐的格式
    一级: '*',
    // 详情 — JS 代码
    二级: `js:
        VOD = {};
        let html1 = request(input);
        VOD.vod_id = pdfh(html1, '#current_id&&value');
        VOD.vod_name = pdfh(html1, 'h2&&Text');
        VOD.vod_pic = pdfh(html1, '.item-root&&img&&data-src');
        VOD.vod_actor = pdfh(html1, '.meta:eq(4)&&Text');
        VOD.vod_area = pdfh(html1, '.meta:eq(3)&&Text');
        VOD.vod_year = pdfh(html1, '.meta:eq(2)&&Text');
        // 通过 API 获取播放列表
        let token = extractToken(html1);
        let vid = input.split('/').pop();
        let apiUrl = host + '/api/getResN?videoId=' + vid + '&mtype=2&token=' + token;
        let apiResp = JSON.parse(request(apiUrl, {
            headers: { 'User-Agent': 'MOBILE_UA', 'Referer': input }
        }));
        let episodes = apiResp.data.list;
        let playMap = {};
        episodes.forEach(ep => {
            let playurls = JSON.parse(ep.resData);
            playurls.forEach(pu => {
                if (!playMap[pu.flag]) playMap[pu.flag] = [];
                playMap[pu.flag].push(pu.url.replaceAll('##', '#'));
            });
        });
        let playFrom = Object.keys(playMap);
        let playList = playFrom.map(k => playMap[k]);
        VOD.vod_play_from = playFrom.join('$$$');
        VOD.vod_play_url = playList.map(arr => arr.join('#')).join('$$$');
    `,
    // 搜索
    搜索: '*',
    // 播放配置
    play_parse: true,
    play_json: [{ re: '*', json: { parse: 0, jx: 0 } }],
    lazy: ''
}
```

要点：
- `class_name` + `class_url` 用 `&` 分隔，一一对应
- `二级` 用 `js:` 前缀写 JS 代码，`input` = 当前页面 URL
- JS 代码中可用 `pdfh()`, `pdfa()`, `request()` 等全局函数
- `VOD.vod_play_from` 用 `$$$` 分源，`VOD.vod_play_url` 对应分源分集
- `一级: '*'` 复用 `推荐` 的解析规则
- `搜索: '*'` 复用 `一级` 的解析规则
