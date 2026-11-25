package dev.personal.pokedex;

import android.content.Context;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;

/**
 * Fetches https resources for the web UI and keeps a copy on the phone, so
 * every Pokémon you've opened works offline afterwards.
 *  ttl  > 0 : refetch when the copy is older than ttl seconds (falls back to the copy offline)
 *  ttl <= 0 : keep forever
 */
class NetCache {
    private final File dir;

    NetCache(Context ctx) {
        dir = new File(ctx.getFilesDir(), "net");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
    }

    WebResourceResponse fetch(String url, long ttlSeconds) {
        if (url == null || !url.startsWith("https://")) return error(400, "Bad url");
        String key = sha1(url);
        File body = new File(dir, key);
        File meta = new File(dir, key + ".type");

        boolean have = body.exists() && meta.exists();
        if (have) {
            long age = System.currentTimeMillis() - body.lastModified();
            if (ttlSeconds <= 0 || age < ttlSeconds * 1000L) return serve(body, meta);
        }

        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(15000);
            c.setReadTimeout(45000);
            c.setInstanceFollowRedirects(true);
            c.setRequestProperty("User-Agent", "PersonalPokedexApp/1.0 (Android)");
            int code = c.getResponseCode();
            if (code != 200) {
                if (have) return serve(body, meta);
                return error(code == 404 ? 404 : 502, "HTTP " + code);
            }
            String type = c.getContentType();
            if (type == null) type = mimeFor(url);
            File tmp = File.createTempFile(key, ".part", dir);
            try (InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(tmp)) {
                byte[] buf = new byte[16384];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            }
            try (FileOutputStream out = new FileOutputStream(meta)) {
                out.write(type.getBytes(StandardCharsets.UTF_8));
            }
            if (body.exists()) //noinspection ResultOfMethodCallIgnored
                body.delete();
            if (!tmp.renameTo(body)) return error(500, "Cache write failed");
            return serve(body, meta);
        } catch (IOException e) {
            if (have) return serve(body, meta);
            return error(504, "Offline");
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private WebResourceResponse serve(File body, File meta) {
        try {
            String type = readSmall(meta);
            String mime = type;
            String enc = null;
            int semi = type.indexOf(';');
            if (semi >= 0) {
                mime = type.substring(0, semi).trim();
                int cs = type.toLowerCase().indexOf("charset=");
                if (cs >= 0) enc = type.substring(cs + 8).trim();
            }
            if (enc == null && (mime.contains("json") || mime.startsWith("text"))) enc = "utf-8";
            Map<String, String> h = new HashMap<>();
            h.put("Access-Control-Allow-Origin", "*");
            h.put("Cache-Control", "no-store");
            return new WebResourceResponse(mime, enc, 200, "OK", h, new FileInputStream(body));
        } catch (IOException e) {
            return error(500, "Cache read failed");
        }
    }

    static WebResourceResponse error(int code, String msg) {
        Map<String, String> h = new HashMap<>();
        h.put("Access-Control-Allow-Origin", "*");
        return new WebResourceResponse("text/plain", "utf-8", code, msg.isEmpty() ? "Error" : msg, h,
                new ByteArrayInputStream(msg.getBytes(StandardCharsets.UTF_8)));
    }

    long clear() {
        long freed = 0;
        File[] files = dir.listFiles();
        if (files != null) for (File f : files) { freed += f.length(); //noinspection ResultOfMethodCallIgnored
            f.delete(); }
        return freed;
    }

    long size() {
        long total = 0;
        File[] files = dir.listFiles();
        if (files != null) for (File f : files) total += f.length();
        return total;
    }

    static String mimeFor(String path) {
        String p = path.toLowerCase();
        int q = p.indexOf('?');
        if (q >= 0) p = p.substring(0, q);
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".gif")) return "image/gif";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    private static String readSmall(File f) throws IOException {
        try (FileInputStream in = new FileInputStream(f)) {
            byte[] b = new byte[(int) Math.min(f.length(), 512)];
            int n = in.read(b);
            return new String(b, 0, Math.max(n, 0), StandardCharsets.UTF_8);
        }
    }

    private static String sha1(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            byte[] d = md.digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte x : d) sb.append(String.format("%02x", x));
            return sb.toString();
        } catch (Exception e) {
            return Integer.toHexString(s.hashCode());
        }
    }
}
