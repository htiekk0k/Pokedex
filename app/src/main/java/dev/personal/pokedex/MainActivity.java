package dev.personal.pokedex;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Hosts the Pokédex UI (assets/www) in a WebView and gives it the phone's
 * native abilities: a caching network proxy, text-to-speech, voice search,
 * camera/gallery text recognition (on-device, ML Kit) and share intents.
 */
public class MainActivity extends Activity {

    static final String HOST = "appassets.androidplatform.net";
    static final String ORIGIN = "https://" + HOST;

    private static final int REQ_CAMERA = 11;
    private static final int REQ_GALLERY = 12;
    private static final int REQ_VOICE = 13;
    private static final int REQ_LENS_CAMERA = 14;
    private static final int REQ_LENS_GALLERY = 15;

    private static final String GOOGLE_APP = "com.google.android.googlequicksearchbox";
    private static final String LENS_APP = "com.google.ar.lens";

    /** When we handed a picture to Google Lens; on return we look at the clipboard. */
    private long lensSentAt = 0;
    private String clipBeforeLens = null;

    private WebView web;
    private NetCache net;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private boolean jsReady = false;
    private final List<String> pending = new ArrayList<>();
    private Uri photoUri;
    private TextRecognizer recognizer;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        net = new NetCache(this);

        web = new WebView(this);
        web.setBackgroundColor(0xFFC4161C);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.setWebViewClient(new Client());
        web.addJavascriptInterface(new Bridge(), "Native");
        setContentView(web);

        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int r = tts.setLanguage(Locale.US);
                ttsReady = r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED;
                if (!ttsReady) { tts.setLanguage(Locale.getDefault()); ttsReady = true; }
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) { emit(evt("tts").put2("state", "start")); }
                    @Override public void onDone(String id) { emit(evt("tts").put2("state", "done")); }
                    @Override public void onError(String id) { emit(evt("tts").put2("state", "done")); }
                });
            }
        });

        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(ORIGIN + "/index.html");
        }
        handleIntent(getIntent());
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Back from Google Lens: pick up a copied Pokémon name. (Android only lets an
        // app read the clipboard while it is in focus, which is now.)
        if (hasFocus && lensSentAt > 0) {
            if (System.currentTimeMillis() - lensSentAt > 15 * 60 * 1000L) { lensSentAt = 0; return; }
            String clip = readClipboard();
            if (clip != null && !clip.trim().isEmpty() && !clip.equals(clipBeforeLens)) {
                lensSentAt = 0;
                emit(evt("text").put2("source", "lens").put2("text", clip));
            } else {
                emit(evt("lensBack"));
            }
        }
    }

    private String readClipboard() {
        try {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm == null || !cm.hasPrimaryClip()) return null;
            ClipData c = cm.getPrimaryClip();
            if (c == null || c.getItemCount() == 0) return null;
            CharSequence t = c.getItemAt(0).coerceToText(this);
            return t == null ? null : t.toString();
        } catch (Exception e) {
            return null;
        }
    }

    /** Copies the picture into our own files so Google Lens is allowed to open it, then sends it there. */
    private void sendToLens(Uri source) {
        File dir = new File(getCacheDir(), "photos");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        File f = new File(dir, "lens.jpg");
        Uri uri;
        try {
            try (InputStream in = getContentResolver().openInputStream(source);
                 java.io.FileOutputStream out = new java.io.FileOutputStream(f)) {
                if (in == null) throw new IOException("no stream");
                byte[] buf = new byte[16384];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            }
            uri = FileProvider.getUriForFile(this, getPackageName() + ".files", f);
        } catch (IOException e) {
            emit(evt("error").put2("message", "Couldn't open that picture."));
            return;
        }
        clipBeforeLens = readClipboard();
        String[] targets = {GOOGLE_APP, LENS_APP};
        for (String pkg : targets) {
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("image/jpeg");
            i.putExtra(Intent.EXTRA_STREAM, uri);
            i.setClipData(ClipData.newRawUri("photo", uri));
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            i.setPackage(pkg);
            try {
                grantUriPermission(pkg, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivity(i);
                lensSentAt = System.currentTimeMillis();
                emit(evt("cancel"));
                return;
            } catch (ActivityNotFoundException | SecurityException ignored) { }
        }
        emit(evt("error").put2("message", "Google Lens isn't available. Install or update the Google app."));
    }

    private File photoFile() { return new File(new File(getCacheDir(), "photos"), "scan.jpg"); }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (tts != null) { tts.stop(); tts.shutdown(); }
        if (recognizer != null) recognizer.close();
        super.onDestroy();
    }

    // ---------------------------------------------------------------- intents

    private void handleIntent(Intent i) {
        if (i == null || i.getAction() == null) return;
        String action = i.getAction();
        if (Intent.ACTION_SEND.equals(action)) {
            String type = i.getType();
            if (type != null && type.startsWith("image/")) {
                Uri u = i.getParcelableExtra(Intent.EXTRA_STREAM);
                if (u != null) runOcr(u, "share");
            } else {
                String subject = i.getStringExtra(Intent.EXTRA_SUBJECT);
                CharSequence text = i.getCharSequenceExtra(Intent.EXTRA_TEXT);
                String all = (subject == null ? "" : subject + "\n") + (text == null ? "" : text);
                lensSentAt = 0;
                emit(evt("text").put2("source", "share").put2("text", all));
            }
            i.setAction(null);
        } else if (Intent.ACTION_PROCESS_TEXT.equals(action)) {
            lensSentAt = 0;
            CharSequence text = i.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT);
            if (text != null) emit(evt("text").put2("source", "select").put2("text", text.toString()));
            i.setAction(null);
        }
    }

    @Override
    protected void onActivityResult(int req, int result, Intent data) {
        super.onActivityResult(req, result, data);
        if (result != RESULT_OK) {
            emit(evt("cancel"));
            return;
        }
        if (req == REQ_LENS_CAMERA && photoUri != null) {
            sendToLens(photoUri);
        } else if (req == REQ_LENS_GALLERY && data != null && data.getData() != null) {
            sendToLens(data.getData());
        } else if (req == REQ_CAMERA && photoUri != null) {
            runOcr(photoUri, "camera");
        } else if (req == REQ_GALLERY && data != null && data.getData() != null) {
            runOcr(data.getData(), "gallery");
        } else if (req == REQ_VOICE && data != null) {
            ArrayList<String> heard = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            JSONArray arr = new JSONArray();
            if (heard != null) for (String h : heard) arr.put(h);
            emit(evt("voice").put2("results", arr));
        }
    }

    // -------------------------------------------------------------------- OCR

    private void runOcr(Uri uri, String source) {
        emit(evt("busy").put2("label", "Reading the picture…"));
        InputImage image;
        try {
            image = InputImage.fromFilePath(this, uri);
        } catch (IOException e) {
            emit(evt("error").put2("message", "Couldn't open that picture."));
            return;
        }
        if (recognizer == null) recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        recognizer.process(image)
                .addOnSuccessListener(text -> {
                    JSONArray lines = new JSONArray();
                    for (Text.TextBlock block : text.getTextBlocks()) {
                        for (Text.Line line : block.getLines()) {
                            Rect box = line.getBoundingBox();
                            JSONObject o = new JSONObject();
                            try {
                                o.put("t", line.getText());
                                o.put("h", box == null ? 0 : box.height());
                                o.put("y", box == null ? 0 : box.top);
                            } catch (JSONException ignored) { }
                            lines.put(o);
                        }
                    }
                    emit(evt("ocr").put2("source", source).put2("lines", lines));
                })
                .addOnFailureListener(e ->
                        emit(evt("error").put2("message", "Couldn't read text in that picture.")));
    }

    // ----------------------------------------------------------- JS plumbing

    /** JSONObject with a chaining put that never throws. */
    static class J extends JSONObject {
        J put2(String k, Object v) {
            try { put(k, v); } catch (JSONException ignored) { }
            return this;
        }
    }

    private J evt(String type) { return new J().put2("type", type); }

    private void emit(JSONObject obj) {
        final String js = "window.onNative&&window.onNative(" + obj.toString() + ")";
        runOnUiThread(() -> {
            if (!jsReady) { pending.add(js); return; }
            web.evaluateJavascript(js, null);
        });
    }

    private void toast(String msg) {
        runOnUiThread(() -> Toast.makeText(this, msg, Toast.LENGTH_SHORT).show());
    }

    /** Methods callable from JavaScript as window.Native.* */
    class Bridge {
        @JavascriptInterface
        public void ready() {
            runOnUiThread(() -> {
                jsReady = true;
                for (String js : pending) web.evaluateJavascript(js, null);
                pending.clear();
            });
        }

        @JavascriptInterface
        public boolean speak(String text, float rate, float pitch) {
            if (!ttsReady) { toast("Voice is still loading. Try again in a second."); return false; }
            tts.setSpeechRate(rate);
            tts.setPitch(pitch);
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "dex");
            return true;
        }

        @JavascriptInterface
        public void stopSpeaking() {
            if (tts != null) tts.stop();
            emit(evt("tts").put2("state", "done"));
        }

        @JavascriptInterface
        public void listen() {
            runOnUiThread(() -> {
                Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US");
                i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
                i.putExtra(RecognizerIntent.EXTRA_PROMPT, "Say a Pokémon name or number");
                try { startActivityForResult(i, REQ_VOICE); }
                catch (ActivityNotFoundException e) { toast("No voice input app found on this phone."); }
            });
        }

        /** source: camera | gallery (read the name on it) or lens-camera | lens-gallery (send to Google Lens). */
        @JavascriptInterface
        public void scan(String source) {
            final boolean lens = source != null && source.startsWith("lens");
            final boolean gallery = source != null && source.endsWith("gallery");
            runOnUiThread(() -> {
                try {
                    if (gallery) {
                        Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                        i.setType("image/*");
                        i.addCategory(Intent.CATEGORY_OPENABLE);
                        startActivityForResult(Intent.createChooser(i, "Pick a picture"), lens ? REQ_LENS_GALLERY : REQ_GALLERY);
                    } else {
                        File f = photoFile();
                        //noinspection ResultOfMethodCallIgnored
                        f.getParentFile().mkdirs();
                        photoUri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".files", f);
                        Intent i = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                        i.putExtra(MediaStore.EXTRA_OUTPUT, photoUri);
                        i.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        i.setClipData(ClipData.newRawUri("photo", photoUri));
                        startActivityForResult(i, lens ? REQ_LENS_CAMERA : REQ_CAMERA);
                    }
                } catch (ActivityNotFoundException e) {
                    toast("No camera or gallery app found.");
                }
            });
        }

        /** "Check again" after coming back from Lens. */
        @JavascriptInterface
        public void checkClipboard() {
            runOnUiThread(() -> {
                String clip = readClipboard();
                if (clip != null && !clip.trim().isEmpty()) {
                    lensSentAt = 0;
                    emit(evt("text").put2("source", "lens").put2("text", clip));
                } else {
                    emit(evt("lensBack"));
                }
            });
        }

        @JavascriptInterface
        public void stopLensWatch() { lensSentAt = 0; }

        @JavascriptInterface
        public void openUrl(String url) {
            runOnUiThread(() -> {
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
                catch (ActivityNotFoundException e) { toast("No browser found."); }
            });
        }

        @JavascriptInterface
        public void openLens() {
            runOnUiThread(() -> {
                Intent i = getPackageManager().getLaunchIntentForPackage("com.google.ar.lens");
                if (i == null) {
                    i = new Intent(Intent.ACTION_VIEW, Uri.parse("googleapp://lens"));
                }
                try { startActivity(i); }
                catch (ActivityNotFoundException e) {
                    toast("Open Google Lens or Circle to Search, then share the result to Pokédex.");
                }
            });
        }

        @JavascriptInterface
        public void copy(String text) {
            runOnUiThread(() -> {
                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("Pokédex", text));
                if (Build.VERSION.SDK_INT < 33) toast("Copied");
            });
        }

        @JavascriptInterface
        public void toast(String msg) { MainActivity.this.toast(msg); }

        @JavascriptInterface
        public String clearCache() {
            long freed = net.clear();
            runOnUiThread(() -> web.clearCache(true));
            return String.valueOf(freed);
        }

        @JavascriptInterface
        public String cacheSize() { return String.valueOf(net.size()); }

        @JavascriptInterface
        public String version() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; }
            catch (Exception e) { return "?"; }
        }
    }

    // ------------------------------------------------------------- WebView

    class Client extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (!HOST.equals(u.getHost())) return null;
            String path = u.getPath() == null ? "/" : u.getPath();
            if (path.equals("/net")) {
                String target = u.getQueryParameter("u");
                long ttl = parseLong(u.getQueryParameter("ttl"), 7L * 24 * 3600);
                return net.fetch(target, ttl);
            }
            String asset = path.equals("/") ? "index.html" : path.substring(1);
            try {
                InputStream in = getAssets().open("www/" + asset);
                return new WebResourceResponse(NetCache.mimeFor(asset), "utf-8", in);
            } catch (IOException e) {
                return NetCache.error(404, "Not found");
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (HOST.equals(u.getHost())) return false;
            try { startActivity(new Intent(Intent.ACTION_VIEW, u)); }
            catch (ActivityNotFoundException ignored) { }
            return true;
        }
    }

    static long parseLong(String s, long def) {
        if (s == null) return def;
        try { return Long.parseLong(s); } catch (NumberFormatException e) { return def; }
    }
}
