// nsvod.cc spider for CatVod/Fongmi
// Optimized: homepage fetched once, categories extracted from sections
let host = 'https://nsvod.cc';
let headers = { 'User-Agent': 'Mozilla/5.0', 'Referer': host + '/' };
let homeHtml = null;  // cached homepage HTML

async function init(cfg) {}

function buildVod(v) {
    return {
        vod_id: v.vod_id.toString(),
        vod_name: v.vod_name,
        vod_pic: v.vod_pic || '',
        vod_remarks: v.vod_remarks || ''
    };
}

// --- Extract video cards from HTML ---
function extractVideos(html) {
    let results = [];
    let cardRegex = /class="public-list-div[^"]*"\s*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g;
    let cm;
    while (cm = cardRegex.exec(html)) {
        let card = cm[0];
        let idm = card.match(/detail\/id\/(\d+)\.html/);
        let nm = card.match(/title="([^"]*)"/);
        let img = card.match(/data-src="([^"]*)"/);
        let remarks = card.match(/public-list-subtitle[^>]*>([^<]*)</);
        if (idm && nm) {
            results.push({
                vod_id: idm[1],
                vod_name: nm[1],
                vod_pic: img ? img[1] : '',
                vod_remarks: remarks ? remarks[1].trim() : ''
            });
        }
    }
    return results;
}

// --- Extract section by category name from homepage ---
const SECTION_NAMES = {
    '1': '最新电影', '2': '最新连续剧', '3': '最新综艺', '4': '最新动漫'
};

function extractSection(html, tid) {
    let sectionName = SECTION_NAMES[tid];
    if (!sectionName) return extractVideos(html);
    // Find the section header: <h4 class="title-h cor4">最新电影</h4>
    let start = html.indexOf('title-h cor4">' + sectionName);
    if (start < 0) start = html.indexOf('title-h cor4">  ' + sectionName);
    if (start < 0) return [];
    start += ('title-h cor4">' + sectionName).length;
    // Find next section header or end of video cards
    let end = html.indexOf('title-h cor4">', start);
    if (end < 0) end = html.indexOf('class="box-width wow fadeInUp"', start);
    if (end < 0) end = html.indexOf('class="footer"', start);
    if (end < 0) end = html.length;
    return extractVideos(html.substring(start, end));
}

async function getHomeHtml() {
    if (!homeHtml) {
        let resp = await req(host + '/', { headers: headers });
        homeHtml = resp.content;
    }
    return homeHtml;
}

// --- home: categories ---
async function home(filter) {
    return JSON.stringify({
        class: [
            { type_name: '电影', type_id: '1' },
            { type_name: '连续剧', type_id: '2' },
            { type_name: '综艺', type_id: '3' },
            { type_name: '动漫', type_id: '4' }
        ]
    });
}

// --- homeVod: homepage mixed content ---
async function homeVod() {
    let html = await getHomeHtml();
    let list = extractVideos(html);
    return JSON.stringify({ list: list.slice(0, 30) });
}

// --- category: extract from homepage section ---
async function category(tid, pg, filter, extend) {
    let html = await getHomeHtml();
    let list = extractSection(html, tid);
    return JSON.stringify({
        list: list,
        page: 1,
        pagecount: 1,
        limit: 30,
        total: list.length
    });
}

// --- detail: video info + episodes ---
async function detail(id) {
    let resp = await req(host + '/index.php/vod/detail/id/' + id + '.html', { headers: headers });
    let html = resp.content;

    // Basic info — extract name from <title> tag first (most reliable)
    let name = extract(html, /<title>([^<]+)<\/title>/i, 1);
    if (name) {
        let m = name.match(/《([^》]+)》/);
        if (m) name = m[1].trim();
        else name = name.replace(/-\s*[^-]*$/, '').trim();
    }
    if (!name || name.length > 50) name = extract(html, /class="[^"]*video-title[^"]*"[^>]*>([^<]+)</i, 1);
    if (!name) name = extract(html, /<h2[^>]*>([^<]+)<\/h2>/i, 1);
    if (!name) name = extract(html, /class="[^"]*\btitle\b[^"]*"[^>]*>([^<]+)</i, 1);
    let pic = extract(html, /class="detail-pic[^"]*"[^>]*<img[^>]*src="([^"]+)"/i, 1);
    if (!pic) pic = extract(html, /class="thumb"[^>]*<img[^>]*src="([^"]+)"/i, 1);
    let year = extract(html, /class="year"[^>]*>([^<]*)</i, 1);
    let area = extract(html, /class="area"[^>]*>([^<]*)</i, 1);
    let typeName = extract(html, /class="type"[^>]*>([^<]*)</i, 1);
    let actor = extract(html, /class="actor"[^>]*>([^<]*)</i, 1);
    let director = extract(html, /class="director"[^>]*>([^<]*)</i, 1);
    let content = extractBlock(html, /class="content"[^>]*>([\s\S]*?)<\/div>/i, 1);

    // Episode extraction
    let playFrom = [];
    let playUrl = [];
    let allEps = html.match(/<a[^>]*href="\/index\.php\/vod\/play\/id\/(\d+)\/sid\/(\d+)\/nid\/(\d+)\.html"[^>]*>([^<]*)<\/a>/g);
    if (allEps) {
        let sources = {};
        allEps.forEach(e => {
            let m = e.match(/href="\/index\.php\/vod\/play\/id\/(\d+)\/sid\/(\d+)\/nid\/(\d+)\.html"[^>]*>([^<]*)</);
            if (!m) return;
            let sid = m[2];
            let url = host + '/index.php/vod/play/id/' + m[1] + '/sid/' + m[2] + '/nid/' + m[3] + '.html';
            if (!sources[sid]) sources[sid] = [];
            sources[sid].push(m[4].trim() + '$' + url);
        });
        // Extract source names from badge tabs
        let sourceNames = [];
        let tabRegex = /<i class="fa[^"]*"><\/i>\s*&nbsp;([^<]+)<span class="badge">(\d+)<\/span>/g;
        let tm;
        while (tm = tabRegex.exec(html)) sourceNames.push(tm[1].trim());
        for (let sid in sources) {
            let idx = parseInt(sid) - 1;
            let sname = (idx >= 0 && idx < sourceNames.length) ? sourceNames[idx] : ('线路' + sid);
            playFrom.push(sname);
            playUrl.push(sources[sid].join('#'));
        }
    }

    return JSON.stringify({
        list: [{
            vod_id: id, vod_name: name || '', vod_pic: pic || '',
            vod_year: year || '', vod_area: area || '', type_name: typeName || '',
            vod_actor: actor || '', vod_director: director || '', vod_content: content || '',
            vod_play_from: playFrom.join('$$$') || '默认',
            vod_play_url: playUrl.join('$$$') || ''
        }]
    });
}

function extract(html, regex, group) {
    let m = html.match(regex);
    return m ? (m[group] || '').replace(/<[^>]*>/g, '').trim() : '';
}

function extractBlock(html, regex, group) {
    let m = html.match(regex);
    return m ? (m[group] || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';
}

// --- search ---
async function search(wd, quick, pg) {
    let page = pg || '1';
    let url = host + '/index.php/vod/search.html?wd=' + encodeURIComponent(wd) + '&page=' + page;
    let resp = await req(url, { headers: headers });
    let html = resp.content;
    let results = [];
    // Try card extraction first
    let cardRegex = /class="public-list-div[^"]*"\s*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g;
    let cm;
    while (cm = cardRegex.exec(html)) {
        let card = cm[0];
        let idm = card.match(/detail\/id\/(\d+)\.html/);
        let nm = card.match(/title="([^"]*)"/);
        let img = card.match(/data-src="([^"]*)"/);
        let remarks = card.match(/public-list-subtitle[^>]*>([^<]*)</);
        if (idm && nm) {
            results.push({ vod_id: idm[1], vod_name: nm[1], vod_pic: img ? img[1] : '', vod_remarks: remarks ? remarks[1].trim() : '' });
        }
    }
    // Fallback: link extraction
    if (results.length === 0) {
        let items = html.match(/<a[^>]*href="\/index\.php\/vod\/detail\/id\/(\d+)\.html"[^>]*title="([^"]*)"[^>]*>/g);
        if (items) {
            let seen = new Set();
            items.forEach(a => {
                let idm = a.match(/detail\/id\/(\d+)\.html/);
                let nm = a.match(/title="([^"]*)"/);
                if (idm && nm && !seen.has(idm[1])) { seen.add(idm[1]); results.push({ vod_id: idm[1], vod_name: nm[1], vod_pic: '', vod_remarks: '' }); }
            });
        }
    }
    return JSON.stringify({ list: results.slice(0, 30), page: page });
}

// --- play ---
async function play(flag, id, flags) {
    if (!id.startsWith('http')) return JSON.stringify({ parse: 0, url: id });
    let resp = await req(id, { headers: headers });
    let html = resp.content;
    let url = extract(html, /"url"\s*:\s*"([^"]+)"/i, 1);
    if (!url) url = extract(html, /mac_url\s*=\s*'([^']+)'/i, 1);
    if (!url) url = extract(html, /mac_url\s*=\s*"([^"]+)"/i, 1);
    if (url && url.startsWith('http')) {
        return JSON.stringify({ parse: 0, url: url, header: { 'Referer': host + '/' } });
    }
    return JSON.stringify({ parse: 1, url: id, header: { 'Referer': host + '/' } });
}

export default { init, home, homeVod, category, detail, search, play };
