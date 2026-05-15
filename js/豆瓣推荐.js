var HOST = 'https://m.douban.com';
var REXXAR = 'https://m.douban.com/rexxar/api/v2';
var HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://movie.douban.com/'
};

var CLASSES = [
    { type_id: 'movie', type_name: '热门电影' },
    { type_id: 'tv', type_name: '热播剧集' },
    { type_id: 'show', type_name: '热播综艺' },
    { type_id: 'movie_filter', type_name: '电影筛选' },
    { type_id: 'tv_filter', type_name: '电视剧筛选' },
    { type_id: 'show_filter', type_name: '综艺筛选' },
];

var FILTERS = {
    movie: [
        { key: 'category', name: '分类', value: [
            { n: '热门', v: '热门' }, { n: '最新', v: '最新' },
            { n: '豆瓣高分', v: '豆瓣高分' }, { n: '冷门佳片', v: '冷门佳片' }
        ]},
        { key: 'type', name: '地区', value: [
            { n: '全部', v: '全部' }, { n: '华语', v: '华语' },
            { n: '欧美', v: '欧美' }, { n: '韩国', v: '韩国' }, { n: '日本', v: '日本' }
        ]}
    ],
    tv: [
        { key: 'type', name: '类型', value: [
            { n: '综合', v: 'tv' }, { n: '国产剧', v: 'tv_domestic' },
            { n: '欧美剧', v: 'tv_american' }, { n: '日剧', v: 'tv_japanese' },
            { n: '韩剧', v: 'tv_korean' }, { n: '动漫', v: 'tv_animation' },
            { n: '纪录片', v: 'tv_documentary' }
        ]}
    ],
    show: [
        { key: 'type', name: '类型', value: [
            { n: '综合', v: 'show' }, { n: '国内', v: 'show_domestic' },
            { n: '国外', v: 'show_foreign' }
        ]}
    ],
    movie_filter: [
        { key: 'genre', name: '类型', value: [
            { n: '全部', v: '' }, { n: '喜剧', v: '喜剧' }, { n: '爱情', v: '爱情' },
            { n: '动作', v: '动作' }, { n: '科幻', v: '科幻' }, { n: '动画', v: '动画' },
            { n: '悬疑', v: '悬疑' }, { n: '犯罪', v: '犯罪' }, { n: '惊悚', v: '惊悚' },
            { n: '冒险', v: '冒险' }, { n: '奇幻', v: '奇幻' }, { n: '战争', v: '战争' },
            { n: '恐怖', v: '恐怖' }, { n: '纪录片', v: '纪录片' }
        ]},
        { key: 'region', name: '地区', value: [
            { n: '全部', v: '' }, { n: '华语', v: '华语' }, { n: '欧美', v: '欧美' },
            { n: '韩国', v: '韩国' }, { n: '日本', v: '日本' }
        ]},
        { key: 'year', name: '年代', value: [
            { n: '全部', v: '' }, { n: '2026', v: '2026' }, { n: '2025', v: '2025' },
            { n: '2024', v: '2024' }, { n: '2023', v: '2023' }, { n: '2020年代', v: '2020年代' },
            { n: '2010年代', v: '2010年代' }, { n: '2000年代', v: '2000年代' },
            { n: '90年代', v: '90年代' }, { n: '80年代', v: '80年代' }, { n: '更早', v: '更早' }
        ]},
        { key: 'sort', name: '排序', value: [
            { n: '热度', v: 'U' }, { n: '评分', v: 'S' }, { n: '时间', v: 'R' }
        ]}
    ],
    tv_filter: [
        { key: 'genre', name: '类型', value: [
            { n: '全部', v: '' }, { n: '喜剧', v: '喜剧' }, { n: '爱情', v: '爱情' },
            { n: '悬疑', v: '悬疑' }, { n: '剧情', v: '剧情' }, { n: '动作', v: '动作' },
            { n: '科幻', v: '科幻' }, { n: '古装', v: '古装' }, { n: '犯罪', v: '犯罪' }
        ]},
        { key: 'region', name: '地区', value: [
            { n: '全部', v: '' }, { n: '华语', v: '华语' }, { n: '欧美', v: '欧美' },
            { n: '韩国', v: '韩国' }, { n: '日本', v: '日本' }, { n: '中国大陆', v: '中国大陆' },
            { n: '美国', v: '美国' }, { n: '英国', v: '英国' }
        ]},
        { key: 'year', name: '年代', value: [
            { n: '全部', v: '' }, { n: '2026', v: '2026' }, { n: '2025', v: '2025' },
            { n: '2024', v: '2024' }, { n: '2023', v: '2023' }, { n: '2020年代', v: '2020年代' },
            { n: '2010年代', v: '2010年代' }, { n: '2000年代', v: '2000年代' }
        ]},
        { key: 'sort', name: '排序', value: [
            { n: '热度', v: 'U' }, { n: '评分', v: 'S' }, { n: '时间', v: 'R' }
        ]}
    ],
    show_filter: [
        { key: 'genre', name: '类型', value: [
            { n: '全部', v: '' }, { n: '真人秀', v: '真人秀' },
            { n: '脱口秀', v: '脱口秀' }, { n: '音乐', v: '音乐' }
        ]},
        { key: 'sort', name: '排序', value: [
            { n: '热度', v: 'U' }, { n: '评分', v: 'S' }, { n: '时间', v: 'R' }
        ]}
    ]
};

function fixPic(url) {
    return url ? url + '@Referer=https://movie.douban.com' : '';
}

function getPic(item) {
    if (!item || !item.pic) return '';
    return item.pic.large || item.pic.normal || item.pic.medium || item.pic.small || '';
}

function makeVodList(items, typeId) {
    var list = [];
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var cardSubtitle = item.card_subtitle || '';
        var yearMatch = cardSubtitle.match(/^(\d{4})/);
        var vodYear = yearMatch ? yearMatch[1] : '';
        var vodRemarks = '';
        if (item.episodes_info && item.episodes_info.trim()) {
            vodRemarks = item.episodes_info.trim();
        } else if (item.is_new) {
            vodRemarks = typeId === 'movie' ? '新片' : '新剧';
        }
        list.push({
            vod_id: 'msearch:' + (item.title || ''),
            vod_name: item.title || '',
            vod_pic: fixPic(getPic(item)),
            vod_remarks: vodRemarks || '',
            vod_year: vodYear || '',
            vod_douban_score: item.rating && item.rating.value ? String(item.rating.value) : ''
        });
    }
    return list;
}

function makeSearchVodList(items) {
    var list = [];
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var rating = item.rating ? item.rating.value || item.rating : '';
        list.push({
            vod_id: 'msearch:' + (item.title || ''),
            vod_name: item.title || '',
            vod_pic: fixPic(getPic(item)),
            vod_remarks: rating ? '评分:' + rating : ''
        });
    }
    return list;
}

async function init(cfg) {
}

async function home(filter) {
    return JSON.stringify({ class: CLASSES, filters: FILTERS });
}

async function homeVod() {
    var url = REXXAR + '/subject/recent_hot/tv?start=0&limit=20&category=tv&type=tv';
    var resp = req(url, { headers: HEADERS });
    var data = JSON.parse(resp.content);
    var list = [];
    if (data.items) {
        list = makeVodList(data.items, 'tv');
    }
    return JSON.stringify({ list: list });
}

async function category(tid, pg, filter, extend) {
    var page = parseInt(pg) || 1;
    var limit = 20;
    var start = (page - 1) * limit;
    var url = '';
    var referer = 'https://movie.douban.com/';

    if (tid === 'movie') {
        var cat = '热门';
        var type = '全部';
        if (extend && extend.category) cat = extend.category;
        if (extend && extend.type) type = extend.type;
        url = REXXAR + '/subject/recent_hot/movie?start=' + start + '&limit=' + limit + '&category=' + encodeURIComponent(cat) + '&type=' + encodeURIComponent(type);
    } else if (tid === 'tv' || tid === 'show') {
        var stype = tid === 'tv' ? 'tv_domestic' : 'show';
        if (extend && extend.type) stype = extend.type;
        url = REXXAR + '/subject/recent_hot/tv?start=' + start + '&limit=' + limit + '&category=' + tid + '&type=' + encodeURIComponent(stype);
    } else if (tid === 'movie_filter') {
        var genre = (extend && extend.genre) || '';
        var region = (extend && extend.region) || '';
        var year = (extend && extend.year) || '';
        var sort = (extend && extend.sort) || 'U';
        var selectedCategories = {};
        if (genre) selectedCategories['类型'] = genre;
        if (region) selectedCategories['地区'] = region;
        var tags = [genre, region, year].filter(function(x) { return x; }).join(',');
        url = REXXAR + '/movie/recommend?refresh=0&start=' + start + '&count=' + limit + '&selected_categories=' + encodeURIComponent(JSON.stringify(selectedCategories)) + '&uncollect=false&score_range=0,10&tags=' + encodeURIComponent(tags) + '&sort=' + sort;
    } else if (tid === 'tv_filter') {
        var genre = (extend && extend.genre) || '';
        var region = (extend && extend.region) || '';
        var year = (extend && extend.year) || '';
        var sort = (extend && extend.sort) || 'U';
        var selectedCategories = { '形式': '电视剧' };
        if (genre) selectedCategories['类型'] = genre;
        if (region) selectedCategories['地区'] = region;
        var tags = [genre, region, year].filter(function(x) { return x; }).join(',');
        url = REXXAR + '/tv/recommend?refresh=0&start=' + start + '&count=' + limit + '&selected_categories=' + encodeURIComponent(JSON.stringify(selectedCategories)) + '&uncollect=false&score_range=0,10&tags=' + encodeURIComponent(tags) + '&sort=' + sort;
    } else if (tid === 'show_filter') {
        var genre = (extend && extend.genre) || '';
        var sort = (extend && extend.sort) || 'U';
        var selectedCategories = { '形式': '综艺' };
        if (genre) selectedCategories['类型'] = genre;
        var tags = genre || '';
        url = REXXAR + '/tv/recommend?refresh=0&start=' + start + '&count=' + limit + '&selected_categories=' + encodeURIComponent(JSON.stringify(selectedCategories)) + '&uncollect=false&score_range=0,10&tags=' + encodeURIComponent(tags) + '&sort=' + sort;
    } else {
        return JSON.stringify({ page: page, pagecount: 0, total: 0, list: [] });
    }

    try {
        var resp = req(url, { headers: HEADERS });
        var data = JSON.parse(resp.content);
        if (!data.items || !Array.isArray(data.items)) {
            return JSON.stringify({ page: page, pagecount: 0, total: 0, list: [] });
        }
        var list = makeVodList(data.items, tid);
        var total = data.total || data.count || list.length;
        var pagecount = Math.ceil(total / limit);
        return JSON.stringify({ page: page, pagecount: pagecount, limit: limit, total: total, list: list });
    } catch (e) {
        return JSON.stringify({ page: page, pagecount: 0, total: 0, list: [] });
    }
}

async function detail(ids) {
    if (!ids || ids.length === 0) {
        return JSON.stringify({ list: [] });
    }
    var idStr = ids[0];
    var doubanId = idStr;
    var vodName = '';

    if (idStr.indexOf('|||') > -1) {
        var parts = idStr.split('|||');
        doubanId = parts[0];
        vodName = parts[1] || '';
    }

    if (doubanId.indexOf('msearch:') === 0) {
        return JSON.stringify({
            list: [{
                vod_id: idStr,
                vod_name: doubanId.replace('msearch:', ''),
                vod_pic: '',
                vod_content: ''
            }]
        });
    }

    try {
        var detailUrl = REXXAR + '/subject/' + doubanId;
        var resp = req(detailUrl, { headers: HEADERS });
        var data = JSON.parse(resp.content);

        var name = data.title || vodName;
        var pic = data.cover_url || data.img || '';
        if (!pic) pic = getPic(data);
        pic = fixPic(pic);
        var year = data.year || '';
        var area = data.regions ? data.regions.join(' / ') : (data.countries ? data.countries.join(' / ') : '');
        var genre = data.genres ? data.genres.join(' / ') : (data.types ? data.types.join(' / ') : '');
        var actors = '';
        if (data.actors) {
            actors = data.actors.map(function(a) { return a.name || a; }).join(' / ');
        } else if (data.celebrity_list) {
            actors = data.celebrity_list.slice(0, 5).map(function(c) { return c.name || ''; }).join(' / ');
        }
        var director = '';
        if (data.directors) {
            director = data.directors.map(function(d) { return d.name || d; }).join(' / ');
        }
        var rating = data.rating ? (data.rating.value || data.rating.average || '') : '';
        var content = data.intro || data.summary || data.card_subtitle || '';

        return JSON.stringify({
            list: [{
                vod_id: 'msearch:' + name,
                vod_name: name,
                vod_pic: pic,
                vod_year: String(year || ''),
                vod_area: area || '',
                vod_actor: actors || '',
                vod_director: director || '',
                vod_content: content || (genre ? '类型: ' + genre : ''),
                vod_remarks: rating ? '评分: ' + rating : '',
                vod_douban_score: String(rating || '')
            }]
        });
    } catch (e) {
        return JSON.stringify({
            list: [{
                vod_id: 'msearch:' + vodName,
                vod_name: vodName || doubanId,
                vod_pic: '',
                vod_content: ''
            }]
        });
    }
}

function doubanSearch(key, pg) {
    var page = parseInt(pg) || 1;
    var start = (page - 1) * 20;
    var url = REXXAR + '/search?q=' + encodeURIComponent(key) + '&start=' + start;
    try {
        var resp = req(url, { headers: HEADERS });
        var data = JSON.parse(resp.content);
        var items = [];
        if (data.items && Array.isArray(data.items)) {
            items = data.items;
        } else if (data.subjects && Array.isArray(data.subjects)) {
            items = data.subjects;
        } else if (data.result && data.result.subjects) {
            items = data.result.subjects;
        }
        return makeSearchVodList(items);
    } catch (e) {
        return [];
    }
}

async function search(wd, quick, pg) {
    var list = doubanSearch(wd, pg);
    return JSON.stringify({ list: list });
}

async function play(flag, id, vipFlags) {
    if (id && id.indexOf('msearch:') === 0) {
        return JSON.stringify({ parse: 0, url: id });
    }
    return JSON.stringify({ parse: 0, url: '' });
}

export default { init: init, home: home, homeVod: homeVod, category: category, detail: detail, search: search, play: play };
