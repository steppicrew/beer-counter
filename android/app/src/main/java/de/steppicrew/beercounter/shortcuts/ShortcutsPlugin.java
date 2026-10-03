package de.steppicrew.beercounter.shortcuts;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.util.Base64;

import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

import java.util.ArrayList;
import java.util.List;

import de.steppicrew.beercounter.MainActivity;

/**
 * The launcher's long-press menu: "+1 Beer" for the drinks tapped most, and a
 * way into "Start a new round?".
 *
 * The page decides everything — which drinks, in what order, their labels in
 * the app's language, and the icons, drawn by the page from the same drawings
 * as the rows. This side only hands the list to the launcher. Each shortcut
 * opens the app with a beercounter:// link, which @capacitor/app passes to
 * the page as appUrlOpen (or as the launch URL on a cold start); the counting
 * itself happens there, where the counts live.
 */
@CapacitorPlugin(name = "Shortcuts")
public class ShortcutsPlugin extends Plugin {

    @PluginMethod
    public void set(PluginCall call) {
        JSArray items = call.getArray("items");
        if (items == null) {
            call.reject("items missing");
            return;
        }
        Context context = getContext();
        List<ShortcutInfoCompat> shortcuts = new ArrayList<>();
        try {
            for (int i = 0; i < items.length(); i++) {
                JSObject item = JSObject.fromJSONObject(items.getJSONObject(i));
                String id = item.getString("id");
                String url = item.getString("url");
                if (id == null || url == null) continue;

                // Explicitly at our own activity: the link needs no intent
                // filter, so no other app can send one.
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        .setClass(context, MainActivity.class);

                ShortcutInfoCompat.Builder builder = new ShortcutInfoCompat.Builder(context, id)
                        .setShortLabel(item.getString("shortLabel", id))
                        .setLongLabel(item.getString("longLabel", item.getString("shortLabel", id)))
                        .setIntent(intent)
                        .setRank(i);

                Bitmap icon = decode(item.getString("icon"));
                if (icon != null) builder.setIcon(IconCompat.createWithAdaptiveBitmap(icon));

                shortcuts.add(builder.build());
            }
        } catch (JSONException e) {
            call.reject("bad items", e);
            return;
        }

        // Replaces the whole list: a drink that dropped out of the top or was
        // deleted disappears from the menu with it.
        boolean ok = ShortcutManagerCompat.setDynamicShortcuts(context, shortcuts);
        if (ok) call.resolve();
        else call.reject("rate-limited");
    }

    /** Lets the launcher learn which shortcuts are used, for its own suggestions. */
    @PluginMethod
    public void reportUsed(PluginCall call) {
        String id = call.getString("id");
        if (id != null) ShortcutManagerCompat.reportShortcutUsed(getContext(), id);
        call.resolve();
    }

    /** A PNG from the page, as base64 without the data: prefix. */
    private static Bitmap decode(String base64) {
        if (base64 == null || base64.isEmpty()) return null;
        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
