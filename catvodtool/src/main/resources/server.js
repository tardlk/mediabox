// server.js — QuickJS bridge (quickjs-ng, blocking I/O)
// Spider code is pre-transformed to sync CommonJS by Java.
// Protocol: newline-delimited JSON over stdin/stdout.

var _nextId = 1;
var _jsObject = null;

function send(msg) {
    std.out.puts(JSON.stringify(msg) + '\n');
    std.out.flush();
}

function readLine() {
    // std.in.getline() reads a line, blocks until data + LF
    var line = std.in.getline();
    return line; // null on EOF
}

// ---- HTTP bridge (sync, blocking) ----

function httpBridge(url, options) {
    var obj = {};
    if (options) {
        try { obj = typeof options === 'string' ? JSON.parse(options) : options; }
        catch(e) {}
    }
    var id = _nextId++;
    send({http:true, id:id, url:url, options:JSON.stringify(obj)});
    var resp = JSON.parse(std.in.getline());
    if (resp.error) throw new Error(resp.error);
    return {
        code: resp.status || 0,
        content: resp.body || '',
        headers: resp.headers || {},
        ok: !!resp.ok,
        status: resp.status || 0,
        url: url
    };
}

// crypto/trans bridge (sync, blocking — same pattern as httpBridge)
function cryptoBridge(type, args) {
    var id = _nextId++;
    send({crypto:true, id:id, type:type, args:args});
    var resp = JSON.parse(std.in.getline());
    if (resp.error) throw new Error(resp.error);
    return resp.result;
}

globalThis.console = {
    log: function() {
        var a = Array.prototype.slice.call(arguments).map(function(x) {
            try { return typeof x === 'string' ? x : JSON.stringify(x); } catch(e) { return String(x); }
        });
        std.err.puts('[JS] ' + a.join(' ') + '\n');
    },
    error: function() {
        var a = Array.prototype.slice.call(arguments).map(function(x) {
            try { return typeof x === 'string' ? x : JSON.stringify(x); } catch(e) { return String(x); }
        });
        std.err.puts('[JS:error] ' + a.join(' ') + '\n');
    }
};

globalThis.local = { _d:{}, get:function(r,k){return this._d[k]||'';}, set:function(r,k,v){this._d[k]=v;}, delete:function(r,k){delete this._d[k];} };

// ---- createFun equivalent ----

globalThis._http = function(url, options) { return httpBridge(url, options); };
globalThis.req   = function(url, options) { return httpBridge(url, options); };
globalThis.http  = function(url, options) { return httpBridge(url, options); };
globalThis.getProxy = function() { return ''; };
globalThis.getPort  = function() { return 0; };
globalThis.setTimeout = function(func, delay) { try { os.sleep(delay||0); func(); } catch(e){} };
globalThis.joinUrl = function(p, c) {
    if (!c) return p;
    if (c.startsWith('http')) return c;
    if (c.startsWith('/')) { var m = p.match(/^(https?:\/\/[^\/]+)/); return m ? m[1]+c : p+c; }
    var i = p.lastIndexOf('/');
    return i >= 8 ? p.substring(0, i+1)+c : p+'/'+c;
};
globalThis.js2Proxy = function() { return ''; };
globalThis.md5X  = function(t)            { return cryptoBridge('md5', [t]); };
globalThis.aesX  = function(m,e,i,b,k,v,o) { return cryptoBridge('aes', [m,e,i,b,k,v,o]); };
globalThis.rsaX  = function(m,p,e,i,b,k,o) { return cryptoBridge('rsa', [m,p,e,i,b,k,o]); };
globalThis.s2t   = function(t)            { return cryptoBridge('s2t', [t]); };
globalThis.t2s   = function(t)            { return cryptoBridge('t2s', [t]); };

// ---- Spider init (createObj + spider.js equivalent) ----

function initSpider(spiderCode, libs) {
    // Load built-in libs at global scope (matches Android ctx.evaluate)
    var libOrder = ['http.js', 'cheerio.min.js', 'crypto-js.js', 'gbk.js', 'similarity.js', 'cat.js'];
    for (var i = 0; i < libOrder.length; i++) {
        var name = libOrder[i];
        if (libs && libs[name]) {
            try { (0, eval)(libs[name]); }
            catch(e) { std.err.puts('[JS] lib ' + name + ': ' + e.message + '\n'); }
        }
    }

    // Load import dependencies with module.exports wrapping
    for (var key in libs) {
        if (!libs.hasOwnProperty(key)) continue;
        if (key.indexOf('import:') !== 0) continue;
        try {
            var m = { exports: {} };
            var fn = new Function('module', 'exports', libs[key]);
            fn(m, m.exports);
        } catch(e) {
            std.err.puts('[JS] dep ' + key + ': ' + e.message + '\n');
        }
    }

    // Reset previous spider
    delete globalThis.__JS_SPIDER__;
    _jsObject = null;

    // __JS_SPIDER__ token → globalThis.__JS_SPIDER__ (cat.js compat)
    spiderCode = spiderCode.split('__JS_SPIDER__').join('globalThis.__JS_SPIDER__');

    // Evaluate spider code (pre-transformed to sync CommonJS by Java)
    var m = { exports: {} };
    var fn = new Function('module', 'exports', spiderCode);
    fn(m, m.exports);
    var mod = m.exports;

    // spider.js equivalent
    if (!globalThis.__JS_SPIDER__) {
        if (mod.__jsEvalReturn) {
            if (typeof http === 'function') globalThis.req = http;
            globalThis.__JS_SPIDER__ = mod.__jsEvalReturn();
        } else if (mod.default) {
            var d = mod.default;
            globalThis.__JS_SPIDER__ = typeof d === 'function' ? d() : d;
        } else {
            globalThis.__JS_SPIDER__ = mod;
        }
    }
    _jsObject = globalThis.__JS_SPIDER__;
}

// ---- Main command loop ----

function main() {
    send({ready:true});

    while (true) {
        var line = readLine();
        if (!line) break;
        var cmd = JSON.parse(line);

        if (cmd.method === 'init') {
            try {
                initSpider(cmd.content, cmd.libs);
                send({id:cmd.id, result:'ok'});
            } catch(e) {
                send({id:cmd.id, error: e.message + '\n' + (e.stack || '')});
            }
        } else if (cmd.method === 'call') {
            try {
                var inst = _jsObject;
                if (!inst) throw new Error('Spider not initialized');
                var func = inst[cmd.func];
                if (cmd.func === 'init' && !func) { send({id:cmd.id, result:null}); continue; }
                if (typeof func !== 'function')
                    throw new Error('Not found: ' + cmd.func + '. Keys: ' + JSON.stringify(Object.keys(inst)));
                var result = func.apply(inst, cmd.args || []);
                send({id:cmd.id, result:result});
            } catch(e) {
                send({id:cmd.id, error: e.message + '\n' + (e.stack || '')});
            }
        } else if (cmd.method === 'shutdown') {
            send({id:cmd.id, result:'ok'});
            break;
        }
    }
}

main();
