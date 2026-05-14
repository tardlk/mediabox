package com.catvod.tool;
import java.nio.file.*;
public class CopyPassed {
    static String base = System.getProperty("user.dir");
    static String qjs = base + "/bin/qjs.exe";
    static String server = base + "/src/main/resources/server.js";
    public static void main(String[] a) throws Exception {
        var src = Path.of(base, "js");
        var dst = Path.of(base, "js-passed");
        Files.createDirectories(dst);
        int pass = 0, fail = 0;
        for (var f : Files.newDirectoryStream(src, "*.js")) {
            try {
                var b = new QuickJSBridge(qjs, server);
                var s = new JsSpider(b, "file:///" + f.toAbsolutePath().toString().replace('\\', '/'));
                s.init(""); var h = s.homeContent(true); b.close();
                if (h != null && h.contains("\"class\"")) {
                    Files.copy(f, dst.resolve(f.getFileName()), StandardCopyOption.REPLACE_EXISTING);
                    pass++;
                } else fail++;
            } catch (Exception e) { fail++; }
            System.gc();
        }
        System.out.println("Copied " + pass + " passed, skipped " + fail + " failed");
    }
}
