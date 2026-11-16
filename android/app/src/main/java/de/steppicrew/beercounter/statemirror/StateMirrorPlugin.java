package de.steppicrew.beercounter.statemirror;

import android.util.AtomicFile;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

/**
 * A second copy of the stored state, outside the WebView.
 *
 * Everything the app knows lives in the WebView's local storage, and the
 * WebView can lose it without a word — a database it finds damaged is
 * deleted and started afresh. The page then looks like a new install, and
 * its next save makes the loss permanent. Cloud backup is off on purpose,
 * so this file in the app's own storage is what brings the data back.
 *
 * Only "clear data" in Android's settings removes it, as it should.
 *
 * Plugin calls run one after another on Capacitor's plugin thread, so the
 * writes land in the order the page made them.
 */
@CapacitorPlugin(name = "StateMirror")
public class StateMirrorPlugin extends Plugin {

    /** What the release build reports in logcat: `adb logcat -s BeerCounter`. */
    private static final String TAG = "BeerCounter";

    private AtomicFile file() {
        return new AtomicFile(new File(getContext().getFilesDir(), "state-mirror.json"));
    }

    @PluginMethod
    public void write(PluginCall call) {
        String content = call.getString("content");
        if (content == null) {
            call.reject("Nothing to write");
            return;
        }
        // Written aside and renamed into place: a kill mid-write leaves the
        // previous copy, never half of one.
        AtomicFile file = file();
        FileOutputStream out = null;
        try {
            out = file.startWrite();
            out.write(content.getBytes(StandardCharsets.UTF_8));
            file.finishWrite(out);
            call.resolve();
        } catch (Exception e) {
            if (out != null) file.failWrite(out);
            Log.w(TAG, "State mirror not written", e);
            call.reject("Could not write the mirror", e);
        }
    }

    @PluginMethod
    public void read(PluginCall call) {
        JSObject result = new JSObject();
        try {
            result.put("content", new String(file().readFully(), StandardCharsets.UTF_8));
        } catch (FileNotFoundException e) {
            // No mirror yet: nothing was saved since it was introduced.
        } catch (Exception e) {
            Log.w(TAG, "State mirror not readable", e);
        }
        call.resolve(result);
    }

    /** One line in logcat, so a lost state leaves a trace even in release. */
    @PluginMethod
    public void note(PluginCall call) {
        Log.i(TAG, call.getString("message", ""));
        call.resolve();
    }
}
