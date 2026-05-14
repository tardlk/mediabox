package com.catvod.tool;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Downloads and caches JS source files (spider scripts + dependencies).
 */
public class Module {

    private static final int MAX_CACHE = 50;
    private static final OkHttpClient client = new OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .build();

    private final LinkedHashMap<String, String> cache = new LinkedHashMap<>() {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, String> eldest) {
            return size() > MAX_CACHE;
        }
    };

    public String fetch(String name) throws IOException {
        String content = cache.get(name);
        if (content != null) return content;

        if (name.startsWith("http://") || name.startsWith("https://")) {
            content = httpGet(name);
        } else if (name.startsWith("file://")) {
            String path = name.substring(7);
            if (path.startsWith("/") && path.length() > 2 && path.charAt(2) == ':')
                path = path.substring(1); // Windows: /D:/... → D:/...
            content = Files.readString(Path.of(path));
        } else {
            throw new IOException("Unsupported URL scheme: " + name);
        }

        cache.put(name, content);
        return content;
    }

    public void clear() {
        cache.clear();
    }

    private String httpGet(String url) throws IOException {
        Request req = new Request.Builder().url(url).get().build();
        try (Response res = client.newCall(req).execute()) {
            if (!res.isSuccessful()) throw new IOException("HTTP " + res.code() + " for " + url);
            String body = res.body() != null ? res.body().string() : "";
            // Handle charset if specified
            var contentType = res.header("Content-Type");
            if (contentType != null && body != null) {
                for (String part : contentType.split(";")) {
                    if (part.trim().startsWith("charset=")) {
                        String charset = part.split("=")[1].trim();
                        if (!"UTF-8".equalsIgnoreCase(charset) && !"utf-8".equalsIgnoreCase(charset)) {
                            body = new String(body.getBytes(charset), "UTF-8");
                        }
                    }
                }
            }
            return body;
        }
    }
}
