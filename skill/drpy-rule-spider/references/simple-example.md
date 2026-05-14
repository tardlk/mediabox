# 简单示例 — 纯 CSS 选择器

4khdr.js — 论坛类网站，无需 JS，全部 CSS 搞定。

```js
var rule = {
    title: '4KHDR[磁]',
    host: 'https://www.4khdr.cn',
    homeUrl: '/forum.php?mod=forumdisplay&fid=2&page=1',
    url: '/forum.php?mod=forumdisplay&fid=2&filter=typeid&typeid=fyclass&page=fypage',
    searchUrl: '/search.php?mod=forum&searchsubmit=yes&srchtxt=**&page=fypage;post',
    searchable: 2,
    quickSearch: 0,
    filterable: 1,
    filter_url: '',
    filter: {},
    headers: { 'User-Agent': 'PC_UA' },
    timeout: 5000,
    // 分类：容器;名称;链接;ID正则
    class_parse: '.filter-option-a;li&&a&&Text;a&&href;.*typeid=(\\d+)',
    // 首页推荐
    推荐: '.module.cl.xld&&.cl3;.xlda-bt&&h3&&a&&Text;.xlda-img&&img&&src;.xlda-zz&&a&&Text;a&&href',
    // 分类列表
    一级: '.module.cl&&.cl3;.xlda-bt&&h3&&a&&Text;.xlda-img&&img&&src;.xlda-zza;div&&a&&href',
    // 详情页
    二级: {
        title: 'h3.zz-tl&&a&&Text;.zz-fl&&.zz-fl-type&&Text',
        img: '.zz-img&&img&&src',
        desc: '.zz-fl.zz-fl-yjdz&&Text;.zz-fl:eq(1)&&a&&Text;.zz-fl:eq(1);.zz-fl:eq(2)',
        content: '.zz-fl zz-fl-xq&&Text',
        tabs: '.zz-tab-bt&&li',
        lists: '#thread-{id}&&li',
    },
    // 搜索
    搜索: '.module.cl&&.cl3;.xlda-bt&&h3&&a&&Text;.xlda-img&&img&&src;.xlda-zza;div&&a&&href',
    // 搜索详情复用二级
    play_parse: true,
    play_json: [{
        re: '*',
        json: { parse: 0, jx: 0 }
    }],
    lazy: ''
}
```

要点：
- `class_parse` 用正则 `.*typeid=(\\d+)` 从链接提取分类 ID
- `二级.tabs` 用 CSS 选择器找播放源标签
- `二级.lists` 用 `#thread-{id}` — `{id}` 会在循环中被替换为标签序号
- `headers` 直接写 `'PC_UA'`，引擎自动替换为真实 UA
- `play_json: [{re: '*', json: {parse: 0}}]` 表示直接播放，不经过解析器
