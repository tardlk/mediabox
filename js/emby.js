// ===================================================================
// 🔧 配置（通过 ext 参数传入，不在代码里硬编码密码）
// ===================================================================
// ext 格式（JSON）：
//   {"host":"http://xxx:8096","username":"your_user","password":"your_pass"}
// 在 fongmi 站点配置的 ext 字段填入上述 JSON 即可
const CONFIG = {
    host: '',
    username: '',
    password: '',
    deviceId: 'ea27caf7-9a51-4209-b1a5-374bf30c2ffd',
    clientVersion: '4.9.0.31',
    isJellyfin: false,  // 设为 true 兼容 Jellyfin（去掉 /emby 前缀）
    maxRetries: 2,
    retryDelay: 1000
};
// ===================================================================

let authCache = null;

// 安全 URL 编码（避免 # $ 等字符破坏播放）
const safeName = (name) => (name || '').replace(/#/g, '-').replace(/\$/g, '|').trim();

// 通用请求封装（带重试）
const request = async (url, options, retries = CONFIG.maxRetries) => {
    try {
        const resp = await req(url, options);
        if (resp?.content) return resp;
        if (resp?.code >= 400 && resp?.code < 500) return resp;
        throw new Error('Empty response');
    } catch (error) {
        if (retries > 0) {
            await new Promise(r => setTimeout(r, CONFIG.retryDelay));
            return request(url, options, retries - 1);
        }
        throw error;
    }
};

// 初始化：认证（带缓存）
const init = async (ext) => {
    if (ext) {
        try {
            const cfg = typeof ext === 'string' ? JSON.parse(ext) : ext;
            Object.assign(CONFIG, cfg);
        } catch(e) {}
    }
    if (!CONFIG.host || !CONFIG.username) {
        throw new Error('请在 ext 中配置 host/username/password');
    }
    if (authCache) return;
    const authPath = CONFIG.isJellyfin ? '/Users/AuthenticateByName' : '/emby/Users/AuthenticateByName';
    const url = CONFIG.host + authPath;
    // Jellyfin 10.9+ requires X-Emby-Authorization header; Emby accepts both formats
    const authHeader = `MediaBrowser Client="Emby Web", Device="Android WebView Android", DeviceId="${CONFIG.deviceId}", Version="${CONFIG.clientVersion}"`;
    const headers = {
        'X-Emby-Authorization': authHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
    };
    const body = JSON.stringify({ Username: CONFIG.username, Pw: CONFIG.password });
    const resp = await request(url, { method: 'POST', headers, body });
    const data = JSON.parse(resp.content);
    authCache = {
        userId: data.User.Id,
        token: data.AccessToken,
        serverType: CONFIG.isJellyfin ? 'jellyfin' : 'emby'
    };
};

// 获取带认证的请求头
const getHeaders = (extra = {}) => ({
    'X-Emby-Token': authCache.token,
    'X-Emby-Device-Id': CONFIG.deviceId,
    'X-Emby-Client': 'Emby Web',
    'X-Emby-Device-Name': 'Android WebView Android',
    'X-Emby-Client-Version': CONFIG.clientVersion,
    'User-Agent': 'Mozilla/5.0',
    'Referer': CONFIG.host + '/',
    ...extra
});

// 构建 API URL
const buildUrl = (path, params = {}) => {
    const prefix = CONFIG.isJellyfin ? '' : '/emby';
    const baseParams = {
        'X-Emby-Token': authCache.token,
        'X-Emby-Device-Id': CONFIG.deviceId,
        'X-Emby-Client-Version': CONFIG.clientVersion,
        'X-Emby-Language': 'zh-cn',
        ...params
    };
    const qs = Object.entries(baseParams)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
    return `${CONFIG.host}${prefix}${path}${path.includes('?') ? '&' : '?'}${qs}`;
};

// 获取图片 URL（兼容 Emby / Jellyfin）
const getImageUrl = (itemId, imageTag) =>
    imageTag ? `${CONFIG.host}${CONFIG.isJellyfin ? '' : '/emby'}/Items/${itemId}/Images/Primary?maxWidth=400&tag=${imageTag}&quality=90` : '';

// 获取视图（媒体库）
const fetchViews = async () => {
    if (!authCache) await init();
    const url = buildUrl(`/Users/${authCache.userId}/Views`);
    const resp = await request(url, { headers: getHeaders() });
    return JSON.parse(resp.content);
};

// 首页分类（电影/剧集/合集）
const home = async () => {
    try {
        const json = await fetchViews();
        const classes = json.Items
            .filter(i => i.CollectionType === 'movies' || i.CollectionType === 'tvshows' || i.CollectionType === 'boxsets')
            .map(i => ({ type_id: i.Id, type_name: i.Name }));
        return JSON.stringify({ class: classes, filters: {} });
    } catch (e) {
        return JSON.stringify({ class: [], filters: {}, msg: '加载分类失败' });
    }
};

// 首页推荐：最近添加
const homeVod = async () => {
    try {
        if (!authCache) await init();
        const url = buildUrl(`/Users/${authCache.userId}/Items`, {
            SortBy: 'DateCreated',
            SortOrder: 'Descending',
            IncludeItemTypes: 'Movie,Series',
            Recursive: 'true',
            Fields: 'PrimaryImageAspectRatio,ProductionYear',
            EnableImageTypes: 'Primary',
            ImageTypeLimit: 1,
            Limit: 30
        });
        const resp = await request(url, { headers: getHeaders() });
        const json = JSON.parse(resp.content);
        return JSON.stringify({ list: extractVideos(json) });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
};

// 提取视频列表
const extractVideos = (data) => (data?.Items || []).map(i => ({
    vod_id: i.Id,
    vod_name: i.Name || '',
    vod_pic: getImageUrl(i.Id, i.ImageTags?.Primary),
    vod_remarks: i.ProductionYear?.toString() || ''
}));

// 分类列表
const category = async (tid, pg) => {
    if (!authCache) await init();
    const start = (pg - 1) * 30;
    const url = buildUrl(`/Users/${authCache.userId}/Items`, {
        SortBy: 'PremiereDate,ProductionYear,SortName',
        SortOrder: 'Descending',
        IncludeItemTypes: 'Movie,Series',
        Recursive: 'true',
        Fields: 'BasicSyncInfo,CanDelete,Container,PrimaryImageAspectRatio,ProductionYear,CommunityRating,Status,CriticRating,EndDate,Path',
        StartIndex: start,
        ParentId: tid,
        EnableImageTypes: 'Primary,Backdrop,Thumb,Banner',
        ImageTypeLimit: 1,
        Limit: 30,
        EnableUserData: 'true'
    });
    const resp = await request(url, { headers: getHeaders() });
    const json = JSON.parse(resp.content);
    const list = extractVideos(json);
    const total = json.TotalRecordCount || 0;
    const pagecount = Math.ceil(total / 30);
    return JSON.stringify({ list, page: pg, pagecount, limit: 30, total });
};

// 格式化集数：显示第几集
const formatEpNum = (idx) => {
    const n = idx || 0;
    return n < 10 ? '第0' + n + '集' : '第' + n + '集';
};

// 获取剧集播放列表（按季分组）
const getPlayUrlForFolder = async (id, info) => {
    try {
        const fromList = [];
        const urlList = [];
        if (info.Type === 'Series') {
            const seasonsUrl = buildUrl(`/Shows/${id}/Seasons`, { UserId: authCache.userId });
            const seasonsResp = await request(seasonsUrl, { headers: getHeaders() });
            const seasons = JSON.parse(seasonsResp.content).Items || [];
            const seasonResults = await Promise.all(seasons.map(async (season) => {
                const seasonName = safeName(season.Name) || '未知季';
                const episodesUrl = buildUrl(`/Shows/${id}/Episodes`, {
                    SeasonId: season.Id,
                    UserId: authCache.userId,
                    Limit: 1000
                });
                const episodesResp = await request(episodesUrl, { headers: getHeaders() });
                const episodes = JSON.parse(episodesResp.content).Items || [];
                const urls = episodes.map(episode => {
                    const epNum = formatEpNum(episode.IndexNumber);
                    const epName = safeName(episode.Name) || '';
                    const label = epName ? `${epNum} - ${epName}` : epNum;
                    return `${label}$${episode.Id}`;
                });
                return { title: seasonName, urls };
            }));
            for (const r of seasonResults) {
                if (r.urls.length) { fromList.push(r.title); urlList.push(r.urls.join('#')); }
            }
        } else {
            const itemsUrl = buildUrl(`/Users/${authCache.userId}/Items`, { ParentId: id });
            const itemsResp = await request(itemsUrl, { headers: getHeaders() });
            const items = JSON.parse(itemsResp.content);
            const urls = [];
            for (const item of (items.Items || [])) {
                const idx = item.IndexNumber;
                const label = idx ? formatEpNum(idx) + ' - ' + safeName(item.Name) : safeName(item.Name);
                urls.push(`${label}$${item.Id}`);
            }
            if (urls.length > 0) {
                fromList.push('默认');
                urlList.push(urls.join('#'));
            }
        }
        return {
            vod_play_from: fromList.join('$$$') || 'EMBY',
            vod_play_url: urlList.join('$$$') || ''
        };
    } catch (e) { return { vod_play_from: 'EMBY', vod_play_url: '' }; }
};

// 详情页
const detail = async (id) => {
    if (!authCache) await init();
    const url = buildUrl(`/Users/${authCache.userId}/Items/${id}`);
    const resp = await request(url, { headers: getHeaders() });
    const info = JSON.parse(resp.content);

    let nextEpisodeId = '', vodPlayFrom = 'EMBY', vodPlayUrl = '';
    if (!info.IsFolder) {
        const idx = info.IndexNumber;
        const label = idx ? formatEpNum(idx) + ' - ' + safeName(info.Name) : safeName(info.Name);
        vodPlayUrl = `${label}$${info.Id}`;
        vodPlayFrom = '默认';
        if (info.Type === 'Episode' && info.SeriesId && info.SeasonId && info.IndexNumber) {
            const nextEpUrl = buildUrl(`/Shows/${info.SeriesId}/Episodes`, {
                UserId: authCache.userId,
                SeasonId: info.SeasonId,
                StartIndex: 0,
                Limit: 500
            });
            const nextResp = await request(nextEpUrl, { headers: getHeaders() });
            const episodes = JSON.parse(nextResp.content).Items || [];
            const nextEp = episodes
                .filter(e => e.IndexNumber > info.IndexNumber)
                .sort((a, b) => a.IndexNumber - b.IndexNumber)[0];
            if (nextEp) nextEpisodeId = nextEp.Id;
        }
    } else {
        const result = await getPlayUrlForFolder(id, info);
        vodPlayFrom = result.vod_play_from;
        vodPlayUrl = result.vod_play_url;
    }

    return JSON.stringify({
        list: [{
            vod_id: id,
            vod_name: info.Name || '',
            vod_pic: getImageUrl(id, info.ImageTags?.Primary),
            vod_content: (info.Overview || '').replace(/\xa0/g, ' ').replace(/\n\n/g, '\n').trim() || '暂无简介',
            vod_year: info.ProductionYear?.toString() || '',
            vod_type: (info.Genres || []).join(' / ') || '',
            vod_play_from: vodPlayFrom,
            vod_play_url: vodPlayUrl,
            vod_next_episode_id: nextEpisodeId
        }]
    });
};

// 搜索
const search = async (wd, _, pg = 1) => {
    try {
        if (!authCache) await init();
        const url = buildUrl(`/Users/${authCache.userId}/Items`, {
            SortBy: 'SortName',
            SortOrder: 'Ascending',
            Fields: 'BasicSyncInfo,CanDelete,Container,PrimaryImageAspectRatio,ProductionYear,Status,EndDate',
            StartIndex: (pg - 1) * 50,
            EnableImageTypes: 'Primary,Backdrop,Thumb',
            ImageTypeLimit: 1,
            Recursive: 'true',
            SearchTerm: wd,
            GroupProgramsBySeries: 'true',
            Limit: 50
        });
        const resp = await request(url, { headers: getHeaders() });
        const json = JSON.parse(resp.content);
        return JSON.stringify({ list: extractVideos(json) });
    } catch (e) { return JSON.stringify({ list: [] }); }
};

// 播放
const play = async (_, id) => {
    if (!authCache) await init();
    const url = buildUrl(`/Items/${id}/PlaybackInfo`, {
        UserId: authCache.userId,
        IsPlayback: 'true',
        AutoOpenLiveStream: 'false',
        StartTimeTicks: 0,
        MaxStreamingBitrate: 140000000
    });
    const headers = getHeaders({ 'Content-Type': 'application/json' });
    const resp = await request(url, { method: 'POST', headers, body: JSON.stringify(deviceProfile) });
    const json = JSON.parse(resp.content);
    const mediaSource = json.MediaSources?.[0];
    if (!mediaSource) {
        return JSON.stringify({ parse: 1, msg: '无可用媒体源' });
    }

    // 强制使用公网 host，防止内网链接
    const getPublicUrl = (originalUrl) => {
        if (!originalUrl) return '';
        const cleanPath = originalUrl.replace(/^https?:\/\/[^\/]+/i, '');
        return CONFIG.host + cleanPath;
    };

    let playUrl = mediaSource.DirectStreamUrl || mediaSource.DirectPlayUrl || mediaSource.TranscodingUrl || '';
    if (!playUrl && mediaSource.Path) {
        // Fallback: construct stream URL from path
        const itemId = id || mediaSource.Id;
        playUrl = `/Videos/${itemId}/stream?Static=true&MediaSourceId=${mediaSource.Id}&api_key=${authCache.token}`;
    }
    if (!playUrl) {
        return JSON.stringify({ parse: 1, msg: '无可用播放链接' });
    }
    playUrl = getPublicUrl(playUrl);

    return JSON.stringify({
        parse: 0,
        url: playUrl,
        header: {
            'X-Emby-Client': 'Emby Web',
            'X-Emby-Device-Name': 'Android WebView Android',
            'X-Emby-Device-Id': CONFIG.deviceId,
            'X-Emby-Client-Version': CONFIG.clientVersion,
            'X-Emby-Token': authCache.token
        }
    });
};

// DeviceProfile：优先直通，超高码率避免转码
const deviceProfile = {
    DeviceProfile: {
        MaxStaticBitrate: 140000000,
        MaxStreamingBitrate: 140000000,
        DirectPlayProfiles: [
            { Container: "mp4,mkv,webm,avi,ts,mov,wmv,flv", Type: "Video", VideoCodec: "h264,h265,hevc,av1,vp9,mpeg4,mpeg2video", AudioCodec: "aac,mp3,ac3,opus,flac,dts,eac3,truehd" },
            { Container: "mp3,aac,flac,opus,ogg,wav", Type: "Audio" }
        ],
        TranscodingProfiles: [
            { Container: "ts", Type: "Video", VideoCodec: "h264", AudioCodec: "aac,mp3", Context: "Streaming", Protocol: "hls" }
        ],
        SubtitleProfiles: [{ Format: "srt,ass,ssa,vtt,sub,pgs", Method: "External" }],
        CodecProfiles: [],
        BreakOnNonKeyFrames: false
    }
};

export default { init, home, homeVod, category, detail, search, play };