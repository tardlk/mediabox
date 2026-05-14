package com.catvod.tool;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import okhttp3.*;
import okhttp3.Request.Builder;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

public class QuickJSBridge implements AutoCloseable {

    private static final Gson gson = new Gson();
    private static final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS).readTimeout(30, TimeUnit.SECONDS)
            .followRedirects(true).followSslRedirects(true).build();

    public interface LogListener { void onLog(String line); }
    private final Process process;
    private final BufferedReader stdout;
    private final OutputStream stdin;
    private final AtomicInteger idCounter = new AtomicInteger(1);
    private LogListener logListener;
    public void setLogListener(LogListener l) { this.logListener = l; }

    public QuickJSBridge(String qjsPath, String serverPath) throws IOException {
        this(qjsPath, serverPath, false);
    }

    /** Module mode: qjs --std --module file.js (with working dir) */
    public QuickJSBridge(String qjsPath, String serverPath, boolean moduleMode) throws IOException {
        this(qjsPath, serverPath, moduleMode, null);
    }

    public QuickJSBridge(String qjsPath, String serverPath, boolean moduleMode, Path workDir) throws IOException {
        var args = new java.util.ArrayList<String>();
        args.add(qjsPath); args.add("--std");
        if (moduleMode) args.add("--module");
        args.add(serverPath);
        ProcessBuilder pb = new ProcessBuilder(args);
        if (workDir != null) pb.directory(workDir.toFile());
        process = pb.start();
        stdout = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8));
        stdin = process.getOutputStream();

        // Stderr reader daemon thread
        var errIn = new BufferedReader(new InputStreamReader(process.getErrorStream(), StandardCharsets.UTF_8));
        Thread errThread = new Thread(() -> {
            try {
                String line;
                while ((line = errIn.readLine()) != null) {
                    if (logListener != null) logListener.onLog("[spider] " + line);
                    else System.err.println(line);
                }
            } catch (IOException ignored) {}
        }, "qjs-err");
        errThread.setDaemon(true);
        errThread.start();

        // Wait for ready signal
        String ready = stdout.readLine();
        if (ready == null || !ready.contains("ready")) throw new IOException("Unexpected startup: " + ready);
    }

    /** Initialize spider with JS source and optional lib scripts */
    public void init(String content, Map<String, String> libs) throws Exception {
        JsonObject cmd = new JsonObject();
        cmd.addProperty("id", nextId());
        cmd.addProperty("method", "init");
        cmd.addProperty("content", content);
        if (libs != null && !libs.isEmpty()) {
            JsonObject libsObj = new JsonObject();
            for (var e : libs.entrySet()) libsObj.addProperty(e.getKey(), e.getValue());
            cmd.add("libs", libsObj);
        }
        JsonObject resp = sendAndWait(cmd);
        if (resp.has("error")) throw new Exception(resp.get("error").getAsString());
    }

    /** Call a function on the spider */
    public String call(String func, Object... args) throws Exception {
        JsonObject cmd = new JsonObject();
        cmd.addProperty("id", nextId());
        cmd.addProperty("method", "call");
        if (func != null) cmd.addProperty("func", func);
        JsonArray arr = new JsonArray();
        for (Object a : args) {
            if (a == null) arr.add((JsonObject) null);
            else if (a instanceof Boolean) arr.add((Boolean) a);
            else if (a instanceof Number) arr.add((Number) a);
            else if (a instanceof String) arr.add((String) a);
            else arr.add(gson.toJsonTree(a));
        }
        cmd.add("args", arr);
        JsonObject resp = sendAndWait(cmd);
        if (resp.has("error")) throw new Exception(resp.get("error").getAsString());
        if (resp.get("result") == null || resp.get("result").isJsonNull()) return null;
        return resp.get("result").isJsonPrimitive() ? resp.get("result").getAsString() : resp.get("result").toString();
    }

    @Override
    public void close() {
        try {
            JsonObject cmd = new JsonObject();
            cmd.addProperty("id", nextId());
            cmd.addProperty("method", "shutdown");
            send(cmd);
        } catch (Exception ignored) {}
        try { stdin.close(); } catch (IOException ignored) {}
        try { stdout.close(); } catch (IOException ignored) {}
        process.destroy();
    }

    // ---- internal ----

    private int nextId() { return idCounter.getAndIncrement(); }

    private void send(JsonObject msg) throws IOException {
        stdin.write((gson.toJson(msg) + "\n").getBytes(StandardCharsets.UTF_8));
        stdin.flush();
    }

    JsonObject sendAndWait(JsonObject cmd) throws Exception {
        send(cmd);
        while (true) {
            String line = stdout.readLine();
            if (line == null) throw new IOException("stdout closed");
            JsonObject resp = gson.fromJson(line, JsonObject.class);
            if (resp.has("http") && resp.get("http").getAsBoolean()) {
                handleHttpRequest(resp);
                continue;
            }
            if (resp.has("crypto") && resp.get("crypto").getAsBoolean()) {
                handleCryptoRequest(resp);
                continue;
            }
            if (resp.has("id") && resp.get("id").getAsInt() == cmd.get("id").getAsInt()) return resp;
        }
    }

    private void handleHttpRequest(JsonObject req) throws IOException {
        int id = req.get("id").getAsInt();
        String url = req.get("url").getAsString();
        String optsStr = req.has("options") ? req.get("options").getAsString() : "{}";
        JsonObject opts;
        try { opts = gson.fromJson(optsStr, JsonObject.class); } catch (Exception e) { opts = new JsonObject(); }
        if (opts == null) opts = new JsonObject();

        String method = opts.has("method") ? opts.get("method").getAsString().toUpperCase() : "GET";
        int timeout = opts.has("timeout") ? opts.get("timeout").getAsInt() * 1000 : 15000;

        OkHttpClient client = timeout != 15000
                ? httpClient.newBuilder().readTimeout(timeout, TimeUnit.MILLISECONDS).build()
                : httpClient;

        JsonObject resp = new JsonObject();
        resp.addProperty("id", id);
        try {
            Builder rb = new Builder().url(url);
            if (opts.has("headers")) {
                var headers = opts.getAsJsonObject("headers");
                for (var e : headers.entrySet()) rb.addHeader(e.getKey(), e.getValue().getAsString());
            }
            if ("POST".equals(method) || "PUT".equals(method)) {
                String body = opts.has("body") ? opts.get("body").getAsString() : "";
                String ct = "application/json";
                rb.method(method, RequestBody.create(body, MediaType.parse(ct)));
            }
            try (Response res = client.newCall(rb.build()).execute()) {
                resp.addProperty("status", res.code());
                resp.addProperty("ok", res.isSuccessful());
                resp.addProperty("body", res.body() != null ? res.body().string() : "");
                JsonObject h = new JsonObject();
                for (var e : res.headers().toMultimap().entrySet())
                    if (e.getValue().size() == 1) h.addProperty(e.getKey(), e.getValue().get(0));
                resp.add("headers", h);
            }
        } catch (Exception e) {
            resp.addProperty("error", e.getMessage());
        }
        send(resp);
    }

    private void handleCryptoRequest(JsonObject req) throws IOException {
        int id = req.get("id").getAsInt();
        String type = req.get("type").getAsString();
        JsonArray args = req.getAsJsonArray("args");
        JsonObject resp = new JsonObject();
        resp.addProperty("crypto", true);
        resp.addProperty("id", id);
        try {
            switch (type) {
                case "md5" -> resp.addProperty("result", Crypto.md5(args.get(0).getAsString()));
                case "aes" -> resp.addProperty("result", Crypto.aes(
                        args.get(0).getAsString(), args.get(1).getAsBoolean(),
                        args.get(2).getAsString(), args.get(3).getAsBoolean(),
                        args.get(4).getAsString(), args.get(5).isJsonNull() ? null : args.get(5).getAsString(),
                        args.get(6).getAsBoolean()));
                case "rsa" -> resp.addProperty("result", Crypto.rsa(
                        args.get(0).getAsString(), args.get(1).getAsBoolean(),
                        args.get(2).getAsBoolean(), args.get(3).getAsString(),
                        args.get(4).getAsBoolean(), args.get(5).getAsString(),
                        args.get(6).getAsBoolean()));
                case "s2t" -> resp.addProperty("result", Crypto.s2t(args.get(0).getAsString()));
                case "t2s" -> resp.addProperty("result", Crypto.t2s(args.get(0).getAsString()));
                default -> resp.addProperty("error", "Unknown crypto type: " + type);
            }
        } catch (Exception e) {
            resp.addProperty("error", e.getMessage());
        }
        send(resp);
    }
}
