package com.catvod.tool;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.regex.*;

public class JsSpider extends Spider {

    static final Pattern IMPORT_PAT = Pattern.compile(
            "import\\s*(?:(?:\\*\\s+as\\s+[\\p{L}\\w]+)|\\{[^}]*\\}|[\\p{L}\\w]+)?\\s*(?:from\\s*)?\"([^\"]+)\"\\s*;?",
            Pattern.UNICODE_CHARACTER_CLASS);

    private static final String[] BUILTIN_LIBS = {"http.js", "cheerio.min.js", "crypto-js.js", "gbk.js", "similarity.js", "cat.js"};
    // Default Drpy engine + deps bundled in resources/drpy/
    private static final String[] DEFAULT_DRPY_DEPS = {
        "cheerio.min.js", "crypto-js.js", "template.js", "gbk.js",
        "node-rsa.js", "pako.min.js", "jinja.js", "sortName.js",
        "mod.js", "json5.js"
    };

    private QuickJSBridge bridge;
    private final Module module;
    private final String api;
    private String qjsPath;
    private String scriptServerPath;
    private Path drpyWorkDir; // tracked for cleanup

    public JsSpider(QuickJSBridge bridge, String api) {
        this.bridge = bridge;
        this.api = api;
        this.module = new Module();
        String base = System.getProperty("user.dir");
        this.qjsPath = findPath(base, "bin/qjs.exe", "src/main/resources/bin/qjs.exe");
        this.scriptServerPath = findPath(base, "resources/server.js", "src/main/resources/server.js");
    }

    public void setPaths(String qjs, String server) { this.qjsPath = qjs; this.scriptServerPath = server; }

    private static String findPath(String base, String... paths) {
        for (String p : paths) { var f = Path.of(base, p); if (Files.exists(f)) return f.toString(); }
        return Path.of(base, paths[0]).toString();
    }

    @Override
    public void init(String extend) throws Exception {
        String content = module.fetch(api);

        // --- Detect type ---
        boolean hasDrpyEngine = content.contains("var _pdfh") || content.contains("cheerio.jp")
                || (content.contains("var vercode") && content.contains("const VERSION"));
        boolean hasRule = content.trim().startsWith("var rule") || content.contains("\nvar rule=");
        boolean hasExport = content.contains("export default");

        if (hasExport && !hasDrpyEngine) {
            // Standalone spider (emby.js, apple.js, …)
            initStandalone(content, extend);
        } else if (hasDrpyEngine && hasExport) {
            // api IS a Drpy engine (drpy2.min.js) — use it + its own imports
            initDrpyEngine(content, api, extend);
        } else if (hasRule && !hasDrpyEngine) {
            // api is a Drpy rule — need default engine
            initDrpyRule(content, extend);
        } else {
            // Unclear — try standalone first, then default engine
            try {
                initStandalone(content, extend);
            } catch (Exception e) {
                System.out.println("[info] Standalone failed, trying Drpy: " + e.getMessage());
                initDrpyRule(content, extend);
            }
        }
    }

    // ==== Drpy: api IS the engine, ext is the rule ====

    private void initDrpyEngine(String engineCode, String engineUrl, String ruleUrl) throws Exception {
        drpyWorkDir = Files.createTempDirectory("drpy_");
        Path dir = drpyWorkDir;
        // Download all imports from engine's base URL
        var nameMap = downloadEngineImports(engineCode, engineUrl, dir);
        // Write engine itself (with paths rewritten to local)
        engineCode = rewriteImportPaths(engineCode, nameMap);
        Files.writeString(dir.resolve("_engine.js"), engineCode);
        // Write pdfh shim
        Files.writeString(dir.resolve("_pdfh_shim.js"),
            "globalThis.pdfh=function(h,p){if(!h||!p)return '';try{return cheerio.jp(p,h)||''}catch(e){return ''}};" +
            "globalThis.pdfa=function(h,p){if(!h||!p)return[];try{var r=cheerio.jp(p,h);return Array.isArray(r)?r:(r?[r]:[])}catch(e){return[]}};" +
            "globalThis.pd=function(h,p){return pdfh(h,p)};");
        // Write DrPy globals
        writeDrpyGlobals(dir);
        // Download and write rule
        if (ruleUrl != null && !ruleUrl.isEmpty()) {
            String rule = module.fetch(ruleUrl);
            Files.writeString(dir.resolve("_rule.js"), rule);
        } else {
            Files.writeString(dir.resolve("_rule.js"), "var rule={};");
        }
        // Engine imports its own deps — wrapper only imports bridge files
        String wrapper = generateWrapper(List.of(), ruleUrl != null);
        Path wrapperPath = dir.resolve("_wrapper.mjs");
        Files.writeString(wrapperPath, wrapper);

        bridge.close();
        bridge = new QuickJSBridge(qjsPath, wrapperPath.toString(), true, dir);
        sendDrpyInit("");
    }

    // ==== Drpy: api is a rule, use default engine ====

    private void initDrpyRule(String ruleCode, String extend) throws Exception {
        drpyWorkDir = Files.createTempDirectory("drpy_");
        Path dir = drpyWorkDir;
        // Copy default engine deps from resources
        for (String dep : DEFAULT_DRPY_DEPS) {
            try {
                Files.writeString(dir.resolve(dep), readLib("drpy/" + dep));
            } catch (Exception e) { /* optional */ }
        }
        Files.writeString(dir.resolve("_pdfh_shim.js"), readLib("drpy/pdfh_shim.js"));
        writeDrpyGlobals(dir);
        // Rewrite engine paths for default engine
        String engine = readLib("drpy/drpy2.min.js")
            .replace("assets://js/lib/cheerio.min.js", "./cheerio.min.js")
            .replace("assets://js/lib/crypto-js.js", "./crypto-js.js");
        Files.writeString(dir.resolve("_engine.js"), engine);
        // Write rule
        Files.writeString(dir.resolve("_spider.js"), ruleCode);
        // Generate wrapper
        var allDeps = new ArrayList<>(Arrays.asList(DEFAULT_DRPY_DEPS));
        String wrapper = generateWrapper(allDeps, false);
        Path wrapperPath = dir.resolve("_wrapper.mjs");
        Files.writeString(wrapperPath, wrapper);

        bridge.close();
        bridge = new QuickJSBridge(qjsPath, wrapperPath.toString(), true, dir);
        sendDrpyInit(extend != null ? extend : "");
    }

    // ==== Standalone ====

    private void initStandalone(String content, String extend) throws Exception {
        Map<String, String> libs = new LinkedHashMap<>();
        for (String lib : BUILTIN_LIBS) {
            try { libs.put(lib, transformLib(readLib(lib))); } catch (Exception ignored) {}
        }
        // Handle any imports in the spider code
        Matcher m = Pattern.compile("import\\s*(?:[^\"']*?from\\s*)?\"([^\"]+)\"").matcher(content);
        Set<String> seen = new LinkedHashSet<>();
        while (m.find()) {
            String spec = m.group(1);
            if (seen.contains(spec)) continue; seen.add(spec);
            String depUrl = resolveUrl(spec, api), depCode;
            if (spec.startsWith("assets://")) {
                String name = spec.replace("assets://js/lib/", "");
                // Try built-in lib first, then default drpy dep
                try { depCode = readLib(name); }
                catch (Exception e1) { try { depCode = readLib("drpy/" + name); } catch (Exception e2) { continue; } }
            } else {
                System.out.println("[import] " + depUrl);
                depCode = module.fetch(depUrl);
            }
            depCode = transformLib(depCode);
            depCode = stripAsyncAwait(depCode);
            libs.put("dep:" + depUrl, depCode);
        }
        content = IMPORT_PAT.matcher(content).replaceAll("");
        content = stripAsyncAwait(content);
        content = content.replaceAll("export\\s*default\\s*\\{", "module.exports = {");
        bridge.init(content, libs);
        if (extend != null && !extend.isEmpty()) bridge.call("init", extend);
    }

    // ==== Helpers ====

    /** Download all imports from engine's base URL, write to dir, return name mapping */
    private Map<String, String> downloadEngineImports(String engineCode, String engineUrl, Path dir) throws Exception {
        Map<String, String> nameMap = new LinkedHashMap<>(); // specifier → local filename
        int idx = 0;
        Matcher m = IMPORT_PAT.matcher(engineCode);
        while (m.find()) {
            String spec = m.group(1);
            if (nameMap.containsKey(spec)) continue;
            String name = spec.contains("/") ? spec.substring(spec.lastIndexOf('/') + 1) : spec;
            if (name.isEmpty() || !name.endsWith(".js") || name.matches(".*[^\\x00-\\x7F].*"))
                name = "dep_" + (idx++) + ".js";
            try {
                String depUrl = resolveUrl(spec, engineUrl);
                String code;
                if (depUrl.startsWith("assets://")) {
                    String libName = spec.replace("assets://js/lib/", "");
                    code = readLib("drpy/" + libName);
                } else {
                    System.out.println("[engine] " + depUrl);
                    code = module.fetch(depUrl);
                }
                Files.writeString(dir.resolve(name), code);
                nameMap.put(spec, name);
            } catch (Exception e) {
                System.err.println("[engine] skip dep: " + spec + " (" + e.getMessage() + ")");
            }
        }
        return nameMap;
    }

    /** Rewrite import paths using nameMap from download step */
    private String rewriteImportPaths(String code, Map<String, String> nameMap) {
        for (var e : nameMap.entrySet()) {
            code = code.replace("\"" + e.getKey() + "\"", "\"./" + e.getValue() + "\"");
        }
        return code;
    }

    private String generateWrapper(List<String> extraDeps, boolean hasRule) {
        StringBuilder sb = new StringBuilder();
        sb.append("// DrPy wrapper\n");
        // Extra deps (only for default engine mode where engine doesn't import them)
        for (String dep : extraDeps) {
            if (dep.equals("cheerio.min.js"))
                sb.append("import cheerio from './cheerio.min.js';\n");
            else if (dep.equals("template.js"))
                sb.append("import 模板 from './template.js';\n");
            else
                sb.append("import './").append(dep).append("';\n");
        }
        sb.append("import './_pdfh_shim.js';\n");
        // Drpy globals — as separate module to beat import hoisting
        sb.append("import './_drpy_globals.js';\n");
        if (hasRule) sb.append("import './_rule.js';\n");
        else sb.append("import './_spider.js';\n");
        sb.append("import * as _drpy_mod from './_engine.js';\n");
        sb.append("var _drpy = _drpy_mod.default || _drpy_mod;\n");
        sb.append("for (var _k in _drpy) { if (typeof _drpy[_k] === 'function') globalThis[_k] = _drpy[_k]; }\n");
        sb.append("""
            var _nextId = 1;
            function send(msg) { std.out.puts(JSON.stringify(msg) + '\\n'); std.out.flush(); }
            function httpBridge(url, options) {
                var obj = {}; if (options) { try { obj = typeof options === 'string' ? JSON.parse(options) : options; } catch(e) {} }
                var id = _nextId++; send({http:true, id:id, url:url, options:JSON.stringify(obj)});
                var resp = JSON.parse(std.in.getline()); if (resp.error) throw new Error(resp.error);
                return { code: resp.status || 0, content: resp.body || '', headers: resp.headers || {}, ok: !!resp.ok, status: resp.status || 0, url: url };
            }
            globalThis._http = function(u,o) { return httpBridge(u,o); };
            globalThis.req   = function(u,o) { return httpBridge(u,o); };
            globalThis.http  = function(u,o) { return httpBridge(u,o); };
            globalThis.console = { log: function() { var a = Array.prototype.slice.call(arguments).map(function(x) { try { return typeof x === 'string' ? x : JSON.stringify(x); } catch(e) { return String(x); } }); std.err.puts('[JS] ' + a.join(' ') + '\\n'); }, error: function() { var a = Array.prototype.slice.call(arguments).map(function(x) { try { return typeof x === 'string' ? x : JSON.stringify(x); } catch(e) { return String(x); } }); std.err.puts('[JS:error] ' + a.join(' ') + '\\n'); } };
            globalThis.getProxy = function() { return ''; }; globalThis.getPort = function() { return 0; };
            globalThis.setTimeout = function(fn, d) { try { os.sleep(d||0); fn(); } catch(e) {} };
            globalThis.joinUrl = function(p, c) { if (!c) return p; if (c.startsWith('http')) return c; if (c.startsWith('/')) { var m = p.match(/^(https?:\\/\\/[^\\/]+)/); return m ? m[1]+c : p+c; } var i = p.lastIndexOf('/'); return i >= 8 ? p.substring(0,i+1)+c : p+'/'+c; };
            globalThis.md5X = function(t) { return t; }; globalThis.aesX = function() { return ''; }; globalThis.rsaX = function() { return ''; };
            globalThis.s2t = function(t) { return t; }; globalThis.t2s = function(t) { return t; };
            send({ready:true});
            while (true) {
                var line = std.in.getline(); if (!line) break;
                var cmd = JSON.parse(line);
                if (cmd.method === 'init') {
                    try { if (typeof init === 'function') init(cmd.content || ''); send({id:cmd.id, result:'ok'}); }
                    catch(e) { send({id:cmd.id, error: e.message + '\\n' + (e.stack||'')}); }
                } else if (cmd.method === 'call') {
                    try {
                        var fn = cmd.func;
                        if (typeof globalThis[fn] === 'function') {
                            var r = globalThis[fn].apply(null, cmd.args || []);
                            send({id:cmd.id, result:r});
                        } else { throw new Error('Not found: ' + fn); }
                    } catch(e) { send({id:cmd.id, error: e.message + '\\n' + (e.stack||'')}); }
                } else if (cmd.method === 'shutdown') { send({id:cmd.id, result:'ok'}); break; }
            }
            """);
        return sb.toString();
    }

    private void writeDrpyGlobals(Path dir) throws Exception {
        // Build muban from raw 模板.js (eval at global scope like Drpy does)
        String templateJs = readLib("drpy/template.js");
        templateJs = templateJs.replace("export default {muban,getMubans};", "globalThis.muban = muban;");
        Files.writeString(dir.resolve("_drpy_globals.js"),
            "globalThis.PC_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.54 Safari/537.36';\n" +
            "globalThis.MOBILE_UA = 'Mozilla/5.0 (Linux; Android 11; wv) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36';\n" +
            "globalThis.UC_UA = 'Mozilla/5.0 (Linux; U; Android 9; zh-CN; MI 9) AppleWebKit/537.36';\n" +
            "globalThis.IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';\n" +
            templateJs);  // defines globalThis.muban
    }

    private void sendDrpyInit(String ext) throws Exception {
        var cmd = new com.google.gson.JsonObject();
        cmd.addProperty("id", 1);
        cmd.addProperty("method", "init");
        cmd.addProperty("content", ext);
        var resp = bridge.sendAndWait(cmd);
        if (resp.has("error")) throw new Exception(resp.get("error").getAsString());
    }

    private String resolveUrl(String spec, String baseUrl) {
        if (spec.startsWith("http") || spec.startsWith("assets://")) return spec;
        try {
            URI base = URI.create(baseUrl);
            // Encode non-ASCII path segments
            StringBuilder sb = new StringBuilder();
            for (char c : spec.toCharArray()) {
                if (c > 127) for (byte b : String.valueOf(c).getBytes(StandardCharsets.UTF_8)) sb.append(String.format("%%%02X", b & 0xff));
                else sb.append(c);
            }
            return base.resolve(sb.toString()).toString();
        } catch (Exception e) { return spec; }
    }

    // ---- method dispatch ----

    @Override public String homeContent(boolean f) throws Exception    { return bridge.call("home", f); }
    @Override public String homeVideoContent() throws Exception       { return bridge.call("homeVod"); }
    @Override public String categoryContent(String t, String p, boolean f, HashMap<String,String> e) throws Exception
        { return bridge.call("category", t, p, f, e != null ? e.toString() : "{}"); }
    @Override public String detailContent(List<String> ids) throws Exception { return bridge.call("detail", ids.isEmpty() ? "" : ids.get(0)); }
    @Override public String searchContent(String k, boolean q) throws Exception { return bridge.call("search", k, q); }
    @Override public String searchContent(String k, boolean q, String p) throws Exception { return bridge.call("search", k, q, p); }
    @Override public String playerContent(String fl, String id, List<String> vf) throws Exception
        { return bridge.call("play", fl, id, vf != null ? vf.toString() : "[]"); }
    @Override public String liveContent(String url) throws Exception   { return bridge.call("live", url); }
    @Override public boolean manualVideoCheck() throws Exception       { return Boolean.parseBoolean(bridge.call("sniffer")); }
    @Override public boolean isVideoFormat(String url) throws Exception { return Boolean.parseBoolean(bridge.call("isVideo", url)); }
    @Override public String action(String a) throws Exception          { return bridge.call("action", a); }
    @Override public void destroy() {
        try { bridge.call("destroy"); } catch(Exception e){}
        bridge.close();
        if (drpyWorkDir != null) {
            try { deleteDir(drpyWorkDir.toFile()); } catch(Exception ignored){}
        }
    }

    private static void deleteDir(java.io.File dir) {
        if (dir.isDirectory()) for (var f : dir.listFiles()) deleteDir(f);
        dir.delete();
    }

    // ---- transforms ----

    static String transformLib(String code) {
        code = code.replaceAll("\\bexport\\s*\\{\\s*[^}]*\\}\\s*;?", ";");
        code = code.replaceAll("\\bexport\\s+default\\s+\\{", ";");
        code = code.replaceAll("\\bexport\\s+default\\s+", ";");
        code = code.replaceAll("\\bexport\\s+(?=function|var|let|const|class)", "");
        return code;
    }

    static String stripAsyncAwait(String code) {
        code = code.replaceAll("\\basync\\s+function\\b", "function");
        code = code.replaceAll("(?<![a-zA-Z_$])async\\s*\\(", "(");
        code = code.replaceAll("(?<![a-zA-Z_$])await\\s+", "");
        return code;
    }

    private String readLib(String name) throws Exception {
        var is = getClass().getClassLoader().getResourceAsStream(name);
        if (is == null) throw new Exception("Not found: " + name);
        return new String(is.readAllBytes());
    }
}
