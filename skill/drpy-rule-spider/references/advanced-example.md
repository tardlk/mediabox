# 复杂示例 — 模板继承 + 完整筛选 + JS 处理

Fun4K.js — 使用模板、完整筛选系统、JS 懒加载。

```js
var rule = {
    title: 'Fun4K',
    模板: 'mxpro',
    host: 'https://fun4k.com',
    url: '/vodshow/fyclassfyfilter/page/fypage/',
    searchUrl: '/vodsearch/**----------fypage---/',
    searchable: 2,
    quickSearch: 0,
    filterable: 1,
    filter_url: '{{fl.cateId}}-{{fl.area}}-{{fl.by}}-{{fl.class}}-{{fl.lang}}-{{fl.letter}}---fypage---{{fl.year}}',
    filter: {
        '1': [
            { key: 'cateId', name: '类型', value: [
                { n: '全部', v: 'dianying' }, { n: '动作', v: 'dongzuo' }
            ]},
            { key: 'area', name: '地区', value: [
                { n: '全部', v: '' }, { n: '大陆', v: '大陆' }, { n: '香港', v: '香港' }
            ]},
            { key: 'lang', name: '语言', value: [
                { n: '全部', v: '' }, { n: '国语', v: '国语' }
            ]},
            { key: 'year', name: '年份', value: [
                { n: '全部', v: '' }, { n: '2026', v: '2026' }
            ]},
            { key: 'letter', name: '字母', value: [
                { n: '全部', v: '' }, { n: 'A', v: 'A' }
            ]},
            { key: 'sortby', name: '排序', value: [
                { n: '时间', v: 'time' }, { n: '人气', v: 'hits' }
            ]}
        ]
    },
    一级: '*',          // 复用模板的选择器
    搜索: '*',
    // 预处理 — 在请求前执行
    预处理: `js:
        rule_fetch_params.headers['Cookie'] = 'timezone=8';
    `,
    // 懒加载 — 播放时动态获取真实地址
    lazy: `js:
        let realHtml = request(input);
        let url = pdfh(realHtml, 'iframe&&src');
        if (url) {
            return { parse: 1, url: url };
        }
        return { parse: 0, url: input };
    `
}
```

要点：
- `模板: 'mxpro'` 继承 mxpro 模板的 class_parse、推荐、一级等
- `filter_url` 用 Jinja2 语法 `{{fl.key}}` 拼接筛选参数
- `预处理` 在 init 时执行，可设 Cookie
- `lazy` 在播放时执行，`input` = 原始播放 URL，返回 `{parse, url}`
