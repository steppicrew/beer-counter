package de.steppicrew.beercounter;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import de.steppicrew.beercounter.datafile.DataFilePlugin;
import de.steppicrew.beercounter.shortcuts.ShortcutsPlugin;
import de.steppicrew.beercounter.systembars.SystemBarsPlugin;
import de.steppicrew.beercounter.tips.TipsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins are not found by `cap sync`; they must be registered
        // before the bridge starts.
        registerPlugin(TipsPlugin.class);
        registerPlugin(DataFilePlugin.class);
        registerPlugin(SystemBarsPlugin.class);
        registerPlugin(ShortcutsPlugin.class);
        dropReplayedShortcut(savedInstanceState);
        super.onCreate(savedInstanceState);
    }

    /**
     * A launcher shortcut opens the app with a beercounter:// link that counts
     * a drink. Android replays a task's first intent: reopened from recent
     * apps after the process was killed, or restored after Android reclaimed
     * it, the app would get "+1 Beer" again and count a drink nobody ordered.
     * Only a fresh tap may count, so a replayed link is dropped before the
     * bridge reads it.
     */
    private void dropReplayedShortcut(Bundle savedInstanceState) {
        Intent intent = getIntent();
        Uri data = intent == null ? null : intent.getData();
        if (data == null || !"beercounter".equals(data.getScheme())) return;
        boolean replayed = savedInstanceState != null
                || (intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0;
        if (replayed) setIntent(new Intent(intent).setData(null));
    }
}
