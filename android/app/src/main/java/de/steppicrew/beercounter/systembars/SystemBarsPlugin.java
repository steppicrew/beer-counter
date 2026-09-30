package de.steppicrew.beercounter.systembars;

import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Sets the system bar icons to match the theme the app is actually showing.
 *
 * Edge-to-edge (API 35+) makes the bars transparent over the page, and the
 * theme's windowLight*Bar flags pick their icon colour from the *phone's*
 * dark mode (values vs values-night). With the phone dark and the app set to
 * Light, that left white navigation icons on the pale page. The app knows
 * which theme it resolved to, so it says so directly whenever that changes.
 */
@CapacitorPlugin(name = "SystemBars")
public class SystemBarsPlugin extends Plugin {

    @PluginMethod
    public void setStyle(PluginCall call) {
        boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", false));
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(window, window.getDecorView());
            // "Light" bars means dark icons, for a light background.
            bars.setAppearanceLightStatusBars(!dark);
            bars.setAppearanceLightNavigationBars(!dark);
            call.resolve();
        });
    }
}
