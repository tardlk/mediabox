package com.catvod.tool;

import java.util.ArrayList;
import java.nio.file.Path;

public class Test {
    static String base = System.getProperty("user.dir");
    static String qjs = base + "/bin/qjs.exe";
    static String server = base + "/src/main/resources/server.js";
    static String jsDir = Path.of(base, "../js").normalize().toString();

    public static void main(String[] args) throws Exception {
        if (args.length == 0) {
            System.out.println("Usage: build.bat <url|name>");
            System.out.println("       build.bat ikanbot.js");
            System.out.println("       build.bat \"https://example.com/tvbox.json\"");
            return;
        }
        String arg = args[0];
        if (!arg.startsWith("http") && !arg.startsWith("file")) {
            arg = "file:///" + jsDir + "/" + arg;
        }
        System.out.println(testOne(arg, args.length > 1 ? args[1] : ""));
    }

    static String testOne(String api, String ext) {
        var module = new Module();
        try {
            String content = module.fetch(api);
            var spiders = new ArrayList<String[]>();
            if (content != null && content.trim().startsWith("{") && content.contains("\"sites\"")) {
                var cfg = new com.google.gson.Gson().fromJson(content, com.google.gson.JsonObject.class);
                for (var s : cfg.getAsJsonArray("sites")) {
                    var site = s.getAsJsonObject();
                    var t = site.has("type") ? site.get("type").getAsInt() : 0;
                    var a = site.has("api") ? site.get("api").getAsString() : "";
                    if (t == 3 && !a.startsWith("csp_") && !a.endsWith(".py"))
                        spiders.add(new String[]{a, site.has("ext") ? site.get("ext").getAsString() : ext, site.has("name") ? site.get("name").getAsString() : a});
                }
            }
            if (spiders.isEmpty()) spiders.add(new String[]{api, ext, api});

            for (var sp : spiders) {
                try {
                    var bridge = new QuickJSBridge(qjs, server);
                    var spider = new JsSpider(bridge, sp[0]);
                    spider.init(sp[1]);
                    String home = spider.homeContent(true);
                    boolean ok = home != null && home.contains("\"class\"");
                    bridge.close();
                    return (ok ? "PASS" : "WARN") + " | " + (home != null ? home.substring(0, Math.min(80, home.length())) : "null");
                } catch (Exception e) {
                    return "FAIL | " + e.getMessage().split("\n")[0];
                } finally { System.gc(); }
            }
        } catch (Exception e) {
            return "FAIL | " + e.getMessage().split("\n")[0];
        }
        return "FAIL";
    }
}
