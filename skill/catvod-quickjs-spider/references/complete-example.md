# 完整示例 — apple.js

基于真实站点 API 的完整爬虫。已在 CatVod Tool 验证通过。

```js
// apple.js — Apple TV 爬虫
let host = 'http://asp.xpgtv.com';
let headers = { "User-Agent": "okhttp/3.12.11" };

async function init(cfg) {}

function makeVodList(data) {
    let videos = [];
    data.forEach(vod => {
        videos.push({
            "vod_id": vod.id.toString(),
            "vod_name": vod.name,
            "vod_pic": vod.pic || '',
            "vod_remarks": vod.updateInfo || vod.score?.toString() || ''
        });
    });
    return videos;
}

async function home(filter) {
    let url = host + "/api.php/v2.vod/androidtypes";
    let resp = await req(url, { headers: headers });
    let data = JSON.parse(resp.content);
    let classes = [];
    let filters = {};
    data.data.forEach(item => {
        let typeId = item.type_id.toString();
        classes.push({ "type_name": item.type_name, "type_id": typeId });
        if (item.types) {
            let subClasses = item.types.map(t => ({ "n": t.name, "v": t.id.toString() }));
            filters[typeId] = [
                { "key": "classes", "name": "分类", "value": subClasses },
                { "key": "areaes", "name": "地区", "value": [
                    {"n":"全部","v":""},{"n":"大陆","v":"大陆"},{"n":"港台","v":"港台"},{"n":"日韩","v":"日韩"},{"n":"欧美","v":"欧美"}
                ]},
                { "key": "sortby", "name": "排序", "value": [
                    {"n":"时间","v":"updatetime"},{"n":"人气","v":"hits"},{"n":"评分","v":"score"}
                ]}
            ];
        }
    });
    return JSON.stringify({ class: classes, filters: filters });
}

async function homeVod() {
    let url = host + "/api.php/v2.main/androidhome";
    let resp = await req(url, { headers: headers });
    let data = JSON.parse(resp.content);
    return JSON.stringify({ list: makeVodList(data.data.list) });
}

async function category(tid, pg, filter, extend) {
    let url = host + '/api.php/v2.vod/androidfilter?' +
        'type_id=' + tid + '&page=' + pg;
    if (extend) {
        for (let k in extend) {
            if (extend[k]) url += '&' + k + '=' + encodeURIComponent(extend[k]);
        }
    }
    let resp = await req(url, { headers: headers });
    let data = JSON.parse(resp.content);
    return JSON.stringify({
        list: makeVodList(data.data),
        page: parseInt(pg),
        pagecount: 999, limit: 90, total: 9999
    });
}

async function detail(id) {
    let url = host + '/api.php/v3.vod/androiddetail2?vod_id=' + id;
    let resp = await req(url, { headers: headers });
    let data = JSON.parse(resp.content).data;
    let playlist = data.urls.map(i => i.key + '$' + i.url).join('#');
    return JSON.stringify({
        list: [{
            vod_id: id,
            vod_name: data.name,
            vod_year: data.year || '',
            vod_area: data.area || '',
            vod_lang: data.lang || '',
            type_name: data.className || '',
            vod_actor: data.actor || '',
            vod_director: data.director || '',
            vod_content: data.content || '',
            vod_play_from: '默认线路',
            vod_play_url: playlist
        }]
    });
}

async function search(wd, quick, pg) {
    let page = pg || '1';
    let url = host + '/api.php/v2.vod/androidsearch?page=' + page + '&wd=' + encodeURIComponent(wd);
    let resp = await req(url, { headers: headers });
    let data = JSON.parse(resp.content);
    return JSON.stringify({ list: makeVodList(data.data), page: page });
}

async function play(flag, id, flags) {
    let playUrl = id.startsWith('http') ? id : host + '/play/' + id;
    let playHeader = { 'User-Agent': 'Mozilla/5.0' };
    return JSON.stringify({ parse: 0, url: playUrl, header: playHeader });
}

export default { init, home, homeVod, category, detail, search, play };
```
