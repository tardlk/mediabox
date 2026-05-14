// Plex Spider for Fongmi TV
// ext format: {"host":"http://xxx:32400","token":"xxx"}
// Token: Plex account token or server token

const DEFAULT_CONFIG = { host: '', token: '', maxRetries: 2, retryDelay: 1000 };
let CONFIG = { ...DEFAULT_CONFIG };
let serverToken = null;

const getToken = () => serverToken || CONFIG.token;

const safeName = (name) => (name || '').replace(/#/g, '-').replace(/\$/g, '|').trim();

const request = async (url, options, retries = CONFIG.maxRetries) => {
    try {
        const resp = await req(url, options);
        if (resp?.content) return resp;
        if (resp?.code >= 400 && resp?.code < 500) return resp;
        throw new Error('Empty');
    } catch (e) {
        if (retries > 0) {
            await new Promise(r => setTimeout(r, CONFIG.retryDelay));
            return request(url, options, retries - 1);
        }
        throw e;
    }
};

const init = async (ext) => {
    if (ext) {
        try {
            const cfg = typeof ext === 'string' ? JSON.parse(ext) : ext;
            if (cfg.host || cfg.token) CONFIG = { ...DEFAULT_CONFIG };
            Object.assign(CONFIG, cfg);
        } catch(e) {}
    }
    if (!CONFIG.host || !CONFIG.token) throw new Error('Need host and token');
    if (serverToken) return;

    const keySuffix = CONFIG.token.substring(0, 8);
    const cached = local.get('plex', 'st_' + keySuffix);
    if (cached) { serverToken = cached; return; }

    // Step 1: Try account token on plex.tv to get server token
    try {
        const resp = await request(
            `https://plex.tv/api/v2/resources?X-Plex-Token=${CONFIG.token}&X-Plex-Client-Identifier=fongmi`,
            { headers: { 'Accept': 'application/json' } }
        );
        const data = JSON.parse(resp.content);
        if (Array.isArray(data)) {
            const server = data.find(s => s.provides === 'server' && s.publicAddress);
            if (server?.accessToken) {
                serverToken = server.accessToken;
                local.set('plex', 'st_' + keySuffix, serverToken);
                return;
            }
        }
    } catch(e) {}

    // Step 2: Try provided token as server token directly
    try {
        const r = await request(`${CONFIG.host}/library/sections?X-Plex-Token=${CONFIG.token}`, {});
        if (r?.code === 200) { serverToken = CONFIG.token; local.set('plex', 'st_' + keySuffix, serverToken); return; }
    } catch(e) {}

    // Step 3: Fallback — cache to avoid re-attempting plex.tv each init
    serverToken = CONFIG.token;
    local.set('plex', 'st_' + keySuffix, serverToken);
};

const getHeaders = () => ({
    'X-Plex-Token': getToken(),
    'Accept': 'application/json'
});

const buildUrl = (path) => `${CONFIG.host}${path}`;

const imgUrl = (path) => path ? `${CONFIG.host}/photo/:/transcode?X-Plex-Token=${getToken()}&width=300&height=450&url=${encodeURIComponent(path)}` : '';

const getJSON = async (path) => {
    const resp = await request(buildUrl(path), { headers: getHeaders() });
    return JSON.parse(resp.content);
};

const home = async () => {
    try {
        const data = await getJSON('/library/sections');
        const dirs = data.MediaContainer?.Directory || [];
        return JSON.stringify({
            class: dirs.map(d => ({ type_id: String(d.key), type_name: d.title })),
            filters: {}
        });
    } catch (e) { return JSON.stringify({ class: [], msg: '加载失败' }); }
};

const homeVod = async () => {
    try {
        const data = await getJSON('/library/sections');
        const dirs = data.MediaContainer?.Directory || [];
        const list = [];
        for (const d of dirs.slice(0, 2)) {
            const items = await getJSON(`/library/sections/${d.key}/all?X-Plex-Container-Start=0&X-Plex-Container-Size=15&sort=addedAt:desc`);
            const videos = items.MediaContainer?.Metadata || [];
            for (const v of videos) {
                list.push({
                    vod_id: String(v.ratingKey),
                    vod_name: v.title || '',
                    vod_pic: imgUrl(v.thumb),
                    vod_remarks: String(v.year || '')
                });
            }
        }
        return JSON.stringify({ list: list.slice(0, 30) });
    } catch (e) { return JSON.stringify({ list: [] }); }
};

const category = async (tid, pg) => {
    try {
        const start = (pg - 1) * 30;
        const data = await getJSON(`/library/sections/${tid}/all?X-Plex-Container-Start=${start}&X-Plex-Container-Size=30&sort=originallyAvailableAt:desc`);
        const mc = data.MediaContainer || {};
        const total = mc.totalSize || 0;
        const list = (mc.Metadata || []).map(v => ({
            vod_id: String(v.ratingKey),
            vod_name: v.title || '',
            vod_pic: imgUrl(v.thumb),
            vod_remarks: String(v.year || '')
        }));
        return JSON.stringify({ list, page: pg, pagecount: Math.ceil(total / 30), limit: 30, total });
    } catch (e) { return JSON.stringify({ list: [], page: pg, pagecount: 0 }); }
};

const detail = async (id) => {
    try {
        const data = await getJSON(`/library/metadata/${id}`);
        const mc = data.MediaContainer || {};
        const meta = mc.Metadata?.[0] || {};
        const type = meta.type || '';

        let vodPlayFrom = '默认', vodPlayUrl = '', vodNextEpisodeId = '';

        if (type === 'show') {
            // TV Show → fetch all seasons in parallel, then episodes per season in parallel
            const sData = await getJSON(`/library/metadata/${id}/children`);
            const seasons = sData.MediaContainer?.Metadata || [];
            const seasonResults = await Promise.all(seasons.map(async (s) => {
                const sKey = s.ratingKey;
                const epData = await getJSON(`/library/metadata/${sKey}/children`);
                const eps = epData.MediaContainer?.Metadata || [];
                const epUrls = eps.map(ep => {
                    const idx = ep.index || 0;
                    const n = idx < 10 ? '0' + idx : String(idx);
                    return `第${n}集 - ${safeName(ep.title || '')}$${ep.ratingKey}`;
                });
                return { title: safeName(s.title) || '未知季', urls: epUrls };
            }));
            const from = [], urls = [];
            for (const r of seasonResults) {
                if (r.urls.length) { from.push(r.title); urls.push(r.urls.join('#')); }
            }
            vodPlayFrom = from.join('$$$') || '默认';
            vodPlayUrl = urls.join('$$$');
        } else if (type === 'season') {
            const epData = await getJSON(`/library/metadata/${id}/children`);
            const eps = epData.MediaContainer?.Metadata || [];
            vodPlayUrl = eps.map(ep => {
                const idx = ep.index || 0;
                const n = idx < 10 ? '0' + idx : String(idx);
                return `第${n}集 - ${safeName(ep.title || '')}$${ep.ratingKey}`;
            }).join('#');
        } else {
            vodPlayUrl = `${safeName(meta.title || '')}$${id}`;
        }

        return JSON.stringify({ list: [{
            vod_id: id, vod_name: meta.title || '',
            vod_pic: imgUrl(meta.thumb), vod_content: meta.summary || '',
            vod_year: String(meta.year || ''), vod_play_from: vodPlayFrom, vod_play_url: vodPlayUrl,
            vod_next_episode_id: vodNextEpisodeId
        }] });
    } catch (e) { return JSON.stringify({ list: [] }); }
};

const search = async (wd) => {
    try {
        const data = await getJSON(`/hubs/search?query=${encodeURIComponent(wd)}&limit=30`);
        const hubs = data.MediaContainer?.Hub || [];
        const list = [];
        for (const hub of hubs) {
            const items = [...(hub.Metadata || []), ...(hub.Directory || [])];
            for (const item of items) {
                const id = item.ratingKey;
                if (!id) continue;
                list.push({
                    vod_id: String(id),
                    vod_name: item.title || '',
                    vod_pic: imgUrl(item.thumb),
                    vod_remarks: String(item.year || '')
                });
            }
        }
        return JSON.stringify({ list: list.slice(0, 50) });
    } catch (e) { return JSON.stringify({ list: [] }); }
};

const play = async (_, id) => {
    try {
        const data = await getJSON(`/library/metadata/${id}`);
        const media = data.MediaContainer?.Metadata?.[0]?.Media?.[0];
        const part = media?.Part?.[0];
        if (part?.key) {
            return JSON.stringify({ parse: 0, url: `${CONFIG.host}${part.key}?X-Plex-Token=${getToken()}`, header: { 'User-Agent': 'Mozilla/5.0' } });
        }
        return JSON.stringify({ parse: 0, url: `${CONFIG.host}/library/metadata/${id}/stream?X-Plex-Token=${getToken()}` });
    } catch (e) { return JSON.stringify({ parse: 1, msg: '无可用播放链接' }); }
};

export default { init, home, homeVod, category, detail, search, play };
