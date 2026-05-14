// ikanbot spider for CatVod/Fongmi
var HOST = 'https://v.aikanbot.com';
var UA = 'Mozilla/5.0 (Linux; Android 11; wv) AppleWebKit/537.36';
var HEADERS = { 'User-Agent': UA, 'Referer': HOST + '/' };

// Friendly source names
var SOURCE_NAMES = {
    'kuaikan': '快看', 'bfzym3u8': '暴风', 'ffm3u8': '非凡', 'lzm3u8': '量子',
    'gsm3u8': '光速', 'jsm3u8': '极速', 'xlm3u8': '迅雷', 'dbm3u8': '豆瓣',
    'hhm3u8': '红海', '1080zyk': '1080', 'wjm3u8': '万家', 'kcm3u8': '快车',
    'dyttm3u8': '电影', 'sdm3u8': '速度', 'wolong': '卧龙', 'tpm3u8': '太平',
    'hym3u8': '华语', 'snm3u8': '索尼', 'mtm3u8': '美图', 'jinyingm3u8': '精英',
    'zuidam3u8': '最大', 'ukm3u8': '优酷', '360zy': '360', 'okm3u8': 'OK',
    'nnm3u8': '年年', 'subm3u8': '字幕', 'yym3u8': '优影', 'tym3u8': '太阳',
    'yhm3u8': '银河', 'ikm3u8': '爱看'
};

function sourceName(flag) {
    return SOURCE_NAMES[flag] || flag;
}

function fixPic(url) {
    if (!url) return '';
    if (url.indexOf('doubanio.com') > -1) return url + '@Referer=https://movie.douban.com';
    if (url.indexOf(HOST) === -1 && url.indexOf('http') === 0) {
        try {
            var u = url.split('/');
            return url + '@Referer=' + u[0] + '//' + u[2];
        } catch (e) {}
    }
    return url;
}

// --- Token computation ---
function computeTks(currentId, eToken) {
    var last4 = currentId.substring(currentId.length - 4);
    var parts = [];
    var token = eToken;
    for (var i = 0; i < last4.length; i++) {
        var digit = parseInt(last4[i]);
        if (isNaN(digit)) return '';
        var skip = digit % 3 + 1;
        parts.push(token.substring(skip, skip + 8));
        token = token.substring(skip + 8);
    }
    return parts.join('');
}

// --- Fetch play page + hidden fields ---
function fetchPlayPage(id) {
    var resp = req(HOST + '/play/' + id, { headers: HEADERS });
    var html = resp.content;
    var result = { html: html };

    var m = html.match(/id="current_id"\s+value="([^"]*)"/);
    result.current_id = m ? m[1] : id;

    m = html.match(/id="e_token"\s+value="([^"]*)"/);
    result.e_token = m ? m[1] : '';

    m = html.match(/id="mtype"\s+value="([^"]*)"/);
    result.mtype = m ? m[1] : '1';

    m = html.match(/id="video_title"[^>]*>([^<]*)</);
    result.title = m ? m[1].trim() : '';

    m = html.match(/class="meta title">([^<]*)</);
    if (!result.title && m) result.title = m[1].trim();

    m = html.match(/data-src="([^"]*\.(?:jpg|png|webp)[^"]*)"/);
    result.pic = m ? m[1] : '';

    var metaRegex = /class="meta">([^<]*)<\/h3>/g;
    var metas = [];
    var mm;
    while (mm = metaRegex.exec(html)) metas.push(mm[1].trim());
    result.metas = metas;

    return result;
}

// --- Call video source API ---
function fetchVideoSources(currentId, eToken, mtype) {
    var tks = computeTks(currentId, eToken);
    if (!tks) return null;
    var url = HOST + '/api/getResN?videoId=' + currentId + '&mtype=' + mtype + '&token=' + tks;
    var resp = req(url, { headers: Object.assign({}, HEADERS, { 'Referer': HOST + '/play/' + currentId }) });
    try { return JSON.parse(resp.content); } catch (e) { return null; }
}

// --- Parse HTML list items ---
function parseList(html) {
    var list = [];
    var itemRegex = /<a[^>]*href="\/play\/(\d+)"[^>]*>[\s\S]*?<img[^>]*alt="([^"]*)"[^>]*data-src="([^"]*)"[^>]*>/g;
    var m;
    while (m = itemRegex.exec(html)) {
        list.push({
            vod_id: m[1],
            vod_name: m[2],
            vod_pic: fixPic(m[3] || ''),
            vod_remarks: ''
        });
    }
    return list;
}

function parseSearch(html) {
    var list = [];
    var itemRegex = /<a[^>]*href="\/play\/(\d+)"[^>]*>[\s\S]*?<img[^>]*class="[^"]*cover[^"]*"[^>]*alt="([^"]*)"[^>]*data-src="([^"]*)"[^>]*>/g;
    var m;
    while (m = itemRegex.exec(html)) {
        list.push({
            vod_id: m[1],
            vod_name: m[2],
            vod_pic: fixPic(m[3] || ''),
            vod_remarks: ''
        });
    }
    if (list.length === 0) {
        var re2 = /href="\/play\/(\d+)"[^>]*>[\s\S]*?<img[^>]*alt="([^"]*)"[^>]*data-src="([^"]*)"[^>]*>/g;
        while (m = re2.exec(html)) {
            list.push({ vod_id: m[1], vod_name: m[2], vod_pic: fixPic(m[3] || ''), vod_remarks: '' });
        }
    }
    return list;
}

// ============= Spider methods =============

function init(cfg) {}

function home(filter) {
    return JSON.stringify({
        class: [
            { type_id: 'movie', type_name: '电影' },
            { type_id: 'tv', type_name: '剧集' },
            { type_id: 'billboard', type_name: '排行榜' }
        ]
    });
}

function homeVod() {
    var resp = req(HOST + '/', { headers: HEADERS });
    var list = parseList(resp.content);
    return JSON.stringify({ list: list.slice(0, 30) });
}

function category(tid, pg, filter, extend) {
    var page = parseInt(pg) || 1;
    var base = '';
    if (tid === 'movie') base = HOST + '/hot/index-movie-%E7%83%AD%E9%97%A8';
    else if (tid === 'tv') base = HOST + '/hot/index-tv-%E7%83%AD%E9%97%A8';
    else if (tid === 'billboard') base = HOST + '/billboard';
    else return JSON.stringify({ page: page, pagecount: 0, total: 0, list: [] });

    var url = base + (page > 1 ? '-p-' + page : '') + '.html';
    var resp = req(url, { headers: HEADERS });
    var list = parseList(resp.content);
    return JSON.stringify({ page: page, pagecount: list.length >= 20 ? page + 1 : page, total: list.length, list: list });
}

function search(wd, quick, pg) {
    var page = parseInt(pg) || 1;
    var url = HOST + '/search?q=' + encodeURIComponent(wd);
    if (page > 1) url += '&p=' + page;
    var resp = req(url, { headers: HEADERS });
    var list = parseSearch(resp.content);
    return JSON.stringify({ list: list.slice(0, 30) });
}

function detail(ids) {
    var id = Array.isArray(ids) ? ids[0] : ids;
    if (!id) return JSON.stringify({ list: [] });
    id = String(id);

    var page = fetchPlayPage(id);
    var title = page.title || '';
    var pic = fixPic(page.pic || '');
    var metas = page.metas || [];

    var playFrom = [];
    var playUrl = [];
    if (page.e_token) {
        var data = fetchVideoSources(page.current_id, page.e_token, page.mtype);
        if (data && data.state === 1 && data.data && data.data.list) {
            data.data.list.forEach(function (line) {
                try {
                    var res = typeof line.resData === 'string' ? JSON.parse(line.resData) : line.resData;
                    var flag = (res && res.length > 0 && res[0].flag) ? sourceName(res[0].flag) : ('线路' + line.siteId);
                    playFrom.push(flag);
                    var parts = [];
                    if (res) res.forEach(function (r) { if (r.url) parts.push(r.url); });
                    playUrl.push(parts.join('#'));
                } catch (e) {
                    playFrom.push('线路' + line.siteId);
                    playUrl.push('');
                }
            });
        }
    }

    return JSON.stringify({
        list: [{
            vod_id: id,
            vod_name: title || '',
            vod_pic: pic,
            vod_year: metas[1] || '',
            vod_area: metas[2] || '',
            vod_actor: metas[3] || '',
            type_name: metas[0] || '',
            vod_play_from: playFrom.join('$$$') || '默认',
            vod_play_url: playUrl.join('$$$') || ''
        }]
    });
}

function play(flag, id, vipFlags) {
    if (id && (id.indexOf('.m3u8') > -1 || id.indexOf('.mp4') > -1)) {
        return JSON.stringify({ parse: 0, url: id, header: { 'Referer': HOST + '/' } });
    }

    var videoId = id;
    var m = id.match(/play\/(\d+)/);
    if (m) videoId = m[1];

    var page = fetchPlayPage(videoId);
    if (!page.e_token) {
        return JSON.stringify({ parse: 1, url: HOST + '/play/' + videoId, header: { 'Referer': HOST + '/' } });
    }

    var data = fetchVideoSources(page.current_id, page.e_token, page.mtype);
    if (data && data.state === 1 && data.data && data.data.list) {
        for (var i = 0; i < data.data.list.length; i++) {
            var line = data.data.list[i];
            if (flag && line.flag !== flag) continue;
            try {
                var res = typeof line.resData === 'string' ? JSON.parse(line.resData) : line.resData;
                if (res && res.length > 0) {
                    for (var j = 0; j < res.length; j++) {
                        var urls = (res[j].url || '').split('#');
                        for (var k = 0; k < urls.length; k++) {
                            var parts = urls[k].split('$');
                            var m3u8 = parts[parts.length - 1];
                            if (m3u8 && (m3u8.indexOf('.m3u8') > -1 || m3u8.indexOf('.mp4') > -1)) {
                                return JSON.stringify({ parse: 0, url: m3u8, header: { 'Referer': HOST + '/' } });
                            }
                        }
                    }
                }
            } catch (e) {}
        }
    }

    return JSON.stringify({ parse: 1, url: HOST + '/play/' + videoId, header: { 'Referer': HOST + '/' } });
}

export default { init, home, homeVod, category, search, detail, play };
