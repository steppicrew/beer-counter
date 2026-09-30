package de.steppicrew.beercounter.datafile;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Export and import through the system's own "Save as" and "Open" dialogs
 * (the Storage Access Framework). The user picks the place — Downloads, a USB
 * stick, a cloud drive app they chose themselves — and the app writes or reads
 * that one document. No storage permission, no network, no copy kept.
 *
 * A WebView cannot follow a download link, which is why the web's plain
 * download needs this counterpart in the app.
 */
@CapacitorPlugin(name = "DataFile")
public class DataFilePlugin extends Plugin {

    /** An export is a few hundred KB after years; anything far larger is not one. */
    private static final int MAX_BYTES = 20 * 1024 * 1024;

    @PluginMethod
    public void save(PluginCall call) {
        if (call.getString("content") == null) {
            call.reject("Nothing to save");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType("application/json")
            .putExtra(Intent.EXTRA_TITLE, call.getString("filename", "beer-counter.json"));
        startActivityForResult(call, intent, "saved");
    }

    @ActivityCallback
    private void saved(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = documentOf(result);
        if (uri == null) {
            call.resolve(status(false));
            return;
        }
        // "wt" truncates: overwriting an older, longer export must not leave
        // its tail behind as trailing garbage.
        try (OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
            if (out == null) throw new IllegalStateException("No stream for " + uri);
            out.write(call.getString("content").getBytes(StandardCharsets.UTF_8));
            call.resolve(status(true));
        } catch (Exception e) {
            call.reject("Could not write the file", e);
        }
    }

    @PluginMethod
    public void open(PluginCall call) {
        // File managers disagree on what a .json is, so offer the likely
        // types; the content is validated on the JS side either way.
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType("*/*")
            .putExtra(Intent.EXTRA_MIME_TYPES,
                new String[] {"application/json", "text/plain", "application/octet-stream"});
        startActivityForResult(call, intent, "opened");
    }

    @ActivityCallback
    private void opened(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = documentOf(result);
        if (uri == null) {
            call.resolve(new JSObject());
            return;
        }
        try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
            if (in == null) throw new IllegalStateException("No stream for " + uri);
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[16 * 1024];
            int read;
            while ((read = in.read(chunk)) != -1) {
                buffer.write(chunk, 0, read);
                if (buffer.size() > MAX_BYTES) throw new IllegalStateException("File too large");
            }
            JSObject out = new JSObject();
            out.put("content", buffer.toString(StandardCharsets.UTF_8.name()));
            call.resolve(out);
        } catch (Exception e) {
            call.reject("Could not read the file", e);
        }
    }

    /** The chosen document, or null when the dialog was cancelled. */
    private static Uri documentOf(ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) return null;
        return result.getData().getData();
    }

    private static JSObject status(boolean saved) {
        JSObject out = new JSObject();
        out.put("saved", saved);
        return out;
    }
}
