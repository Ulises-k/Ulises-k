package com.mauli.cotizador;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Contenedor nativo del Cotizador: carga la app web desde los assets del APK
 * y le da acceso a galería, cámara, guardar en Descargas y compartir.
 */
public class MainActivity extends Activity {

    private static final int REQ_FILES = 41;
    /** Origen https propio: localStorage estable y contexto seguro. */
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/index.html";

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private File cameraFile;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);

        web.setWebViewClient(new LocalClient());
        web.setWebChromeClient(new Chrome());
        web.addJavascriptInterface(new Bridge(), "AndroidApp");

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            web.loadUrl(START_URL);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    // ------------------------------------------------------------ Archivos de la app
    private class LocalClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (!HOST.equals(u.getHost())) return null;
            String path = u.getPath();
            if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
            if (path.contains("..")) return notFound();
            try {
                InputStream in = getAssets().open("www" + path);
                String mime = mimeFor(path);
                String enc = mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") ? "utf-8" : null;
                return new WebResourceResponse(mime, enc, in);
            } catch (IOException e) {
                return notFound();
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (HOST.equals(u.getHost())) return false;
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, u));
            } catch (ActivityNotFoundException ignored) { }
            return true;
        }
    }

    private static WebResourceResponse notFound() {
        WebResourceResponse r = new WebResourceResponse("text/plain", "utf-8", null);
        r.setStatusCodeAndReasonPhrase(404, "Not Found");
        return r;
    }

    private static String mimeFor(String p) {
        p = p.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json") || p.endsWith(".webmanifest")) return "application/json";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".svg")) return "image/svg+xml";
        return "application/octet-stream";
    }

    // ------------------------------------------------------------ Galería / cámara
    private class Chrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;

            Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
            pick.addCategory(Intent.CATEGORY_OPENABLE);
            pick.setType("image/*");
            pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);

            Intent chooser = Intent.createChooser(pick, "Agregar foto");

            // Opción de cámara: la foto se guarda en un archivo propio (no requiere permisos).
            cameraFile = null;
            try {
                cameraFile = FilesProvider.newFile(MainActivity.this, "foto_" + System.currentTimeMillis() + ".jpg");
                Uri out = FilesProvider.uriFor(cameraFile);
                Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                cam.putExtra(MediaStore.EXTRA_OUTPUT, out);
                cam.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cam});
            } catch (Exception e) {
                cameraFile = null;
            }

            try {
                startActivityForResult(chooser, REQ_FILES);
            } catch (ActivityNotFoundException e) {
                fileCallback = null;
                toast("No hay una galería disponible");
                return false;
            }
            return true;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_FILES || fileCallback == null) return;

        List<Uri> uris = new ArrayList<>();
        if (resultCode == RESULT_OK) {
            if (data != null && data.getClipData() != null) {
                for (int i = 0; i < data.getClipData().getItemCount(); i++) {
                    uris.add(data.getClipData().getItemAt(i).getUri());
                }
            } else if (data != null && data.getData() != null) {
                uris.add(data.getData());
            } else if (cameraFile != null && cameraFile.length() > 0) {
                uris.add(FilesProvider.uriFor(cameraFile));
            }
        }
        fileCallback.onReceiveValue(uris.isEmpty() ? null : uris.toArray(new Uri[0]));
        fileCallback = null;
    }

    // ------------------------------------------------------------ Puente con la app web
    private class Bridge {
        /** Guarda el archivo en Descargas/Cotizaciones y lo abre. Devuelve "ok" o un mensaje de error. */
        @JavascriptInterface
        public String saveFile(String base64, String name, String mime) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                String safe = clean(name);
                Uri saved;
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, safe);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Cotizaciones");
                    saved = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (saved == null) return "No se pudo crear el archivo";
                    try (OutputStream o = getContentResolver().openOutputStream(saved)) {
                        if (o == null) return "No se pudo escribir el archivo";
                        o.write(bytes);
                    }
                } else {
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (dir != null) {
                        dir.mkdirs();
                        try (FileOutputStream o = new FileOutputStream(new File(dir, safe))) { o.write(bytes); }
                    }
                    File f = FilesProvider.newFile(MainActivity.this, safe);
                    try (FileOutputStream o = new FileOutputStream(f)) { o.write(bytes); }
                    saved = FilesProvider.uriFor(f);
                }
                final Uri open = saved;
                runOnUiThread(() -> {
                    if (mime.equals("application/pdf")) {
                        Intent view = new Intent(Intent.ACTION_VIEW);
                        view.setDataAndType(open, mime);
                        view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        try { startActivity(view); } catch (ActivityNotFoundException ignored) { }
                    }
                });
                return "ok";
            } catch (Exception e) {
                return "Error: " + e.getMessage();
            }
        }

        /** Abre el menú de compartir (WhatsApp, correo…) con el archivo. */
        @JavascriptInterface
        public String shareFile(String base64, String name, String mime, String title) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                File f = FilesProvider.newFile(MainActivity.this, clean(name));
                try (FileOutputStream o = new FileOutputStream(f)) { o.write(bytes); }
                Uri uri = FilesProvider.uriFor(f);
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType(mime);
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.putExtra(Intent.EXTRA_SUBJECT, title);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                runOnUiThread(() -> startActivity(Intent.createChooser(send, "Enviar cotización")));
                return "ok";
            } catch (Exception e) {
                return "Error: " + e.getMessage();
            }
        }

        @JavascriptInterface
        public boolean isApp() { return true; }
    }

    private static String clean(String name) {
        String n = name == null ? "archivo" : name.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        return n.isEmpty() ? "archivo" : n;
    }

    private void toast(String msg) {
        Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
    }
}
