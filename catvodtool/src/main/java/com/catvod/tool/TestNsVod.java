package com.catvod.tool;

import java.util.HashMap;
import java.nio.file.Path;

public class TestNsVod {
    static String base = System.getProperty("user.dir");
    static String qjs = base + "/bin/qjs.exe";
    static String server = base + "/src/main/resources/server.js";
    static String jsDir = Path.of(base, "../js").normalize().toString();

    public static void main(String[] args) throws Exception {
        var bridge = new QuickJSBridge(qjs, server);
        var spider = new JsSpider(bridge, "file:///" + jsDir + "/nsvod_spider.js");
        spider.init("");

        // 1. search
        System.out.println("=== SEARCH: 低智商犯罪 ===");
        String sr = spider.searchContent("低智商犯罪", false);
        System.out.println(sr);
        System.out.println();

        // 2. category — 连续剧 (tid=2)
        System.out.println("=== CATEGORY: 连续剧 ===");
        String cr = spider.categoryContent("2", "1", false, new HashMap<>());
        System.out.println(cr);
        System.out.println();

        bridge.close();
    }
}
