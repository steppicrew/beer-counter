package de.steppicrew.beercounter.statemirror;

import android.util.AtomicFile;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.Locale;

/**
 * A second copy of the stored state, outside the WebView.
 *
 * Everything the app knows lives in the WebView's local storage, and the
 * WebView can lose it without a word — a database it finds damaged is
 * deleted and started afresh. The page then looks like a new install, and
 * its next save makes the loss permanent. Cloud backup is off on purpose,
 * so these files in the app's own storage are what bring the data back.
 *
 * The mirror follows every save. Beside it sit daily snapshots — the state
 * as it was when each day's first save came in — so a save that is readable
 * but wrong (a bug, a bad migration) cannot take the only copy with it.
 *
 * Only "clear data" in Android's settings removes them, as it should.
 *
 * Plugin calls run one after another on Capacitor's plugin thread, so the
 * writes land in the order the page made them.
 */
@CapacitorPlugin(name = "StateMirror")
public class StateMirrorPlugin extends Plugin {

    /** What the release build reports in logcat: `adb logcat -s BeerCounter`. */
    private static final String TAG = "BeerCounter";

    private static final String MIRROR = "state-mirror.json";
    private static final String SNAPSHOT_PREFIX = "state-snapshot-";
    /** Days with a save, not calendar days: a month off loses nothing. */
    private static final int SNAPSHOTS_KEPT = 14;

    private File dir() {
        return getContext().getFilesDir();
    }

    private AtomicFile mirror() {
        return new AtomicFile(new File(dir(), MIRROR));
    }

    /** Newest first. The date in the name sorts as the date. */
    private File[] snapshots() {
        File[] found = dir().listFiles(
            (d, name) -> name.startsWith(SNAPSHOT_PREFIX) && name.endsWith(".json"));
        if (found == null) return new File[0];
        Arrays.sort(found, (a, b) -> b.getName().compareTo(a.getName()));
        return found;
    }

    private static void writeAtomically(AtomicFile file, byte[] bytes) throws Exception {
        // Written aside and renamed into place: a kill mid-write leaves the
        // previous copy, never half of one.
        FileOutputStream out = null;
        try {
            out = file.startWrite();
            out.write(bytes);
            file.finishWrite(out);
        } catch (Exception e) {
            if (out != null) file.failWrite(out);
            throw e;
        }
    }

    /** Before the day's first save replaces the mirror, keep what it held. */
    private void snapshotOnce() {
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(new Date());
        File target = new File(dir(), SNAPSHOT_PREFIX + today + ".json");
        if (target.exists()) return;
        try {
            writeAtomically(new AtomicFile(target), mirror().readFully());
        } catch (FileNotFoundException e) {
            return; // No mirror yet, nothing to keep.
        } catch (Exception e) {
            Log.w(TAG, "State snapshot not written", e);
            return;
        }
        File[] all = snapshots();
        for (int i = SNAPSHOTS_KEPT; i < all.length; i++) {
            if (!all[i].delete()) Log.w(TAG, "Old snapshot not deleted: " + all[i].getName());
        }
    }

    @PluginMethod
    public void write(PluginCall call) {
        String content = call.getString("content");
        if (content == null) {
            call.reject("Nothing to write");
            return;
        }
        snapshotOnce();
        try {
            writeAtomically(mirror(), content.getBytes(StandardCharsets.UTF_8));
            call.resolve();
        } catch (Exception e) {
            Log.w(TAG, "State mirror not written", e);
            call.reject("Could not write the mirror", e);
        }
    }

    /**
     * Every copy there is, newest first: the mirror, then the snapshots. The
     * page takes the first it can read. Rejected when a copy exists but none
     * could be read — the page must not take that for a new install.
     */
    @PluginMethod
    public void read(PluginCall call) {
        JSArray copies = new JSArray();
        boolean failed = false;
        AtomicFile mirror = mirror();
        try {
            copies.put(new String(mirror.readFully(), StandardCharsets.UTF_8));
        } catch (FileNotFoundException e) {
            // No mirror yet: nothing was saved since it was introduced. Also
            // what a denied open throws, so only a missing file counts.
            if (mirror.getBaseFile().exists()) {
                Log.w(TAG, "State mirror not readable", e);
                failed = true;
            }
        } catch (Exception e) {
            Log.w(TAG, "State mirror not readable", e);
            failed = true;
        }
        for (File snapshot : snapshots()) {
            try {
                copies.put(new String(new AtomicFile(snapshot).readFully(), StandardCharsets.UTF_8));
            } catch (Exception e) {
                Log.w(TAG, "State snapshot not readable: " + snapshot.getName(), e);
                failed = true;
            }
        }
        if (failed && copies.length() == 0) {
            call.reject("No copy of the state could be read");
            return;
        }
        JSObject result = new JSObject();
        result.put("copies", copies);
        call.resolve(result);
    }

    /** One line in logcat, so a lost state leaves a trace even in release. */
    @PluginMethod
    public void note(PluginCall call) {
        Log.i(TAG, call.getString("message", ""));
        call.resolve();
    }
}
