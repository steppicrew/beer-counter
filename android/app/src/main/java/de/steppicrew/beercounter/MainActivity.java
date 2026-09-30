package de.steppicrew.beercounter;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import de.steppicrew.beercounter.datafile.DataFilePlugin;
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
        super.onCreate(savedInstanceState);
    }
}
