package de.steppicrew.beercounter;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import de.steppicrew.beercounter.tips.TipsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins are not found by `cap sync`; they must be registered
        // before the bridge starts.
        registerPlugin(TipsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
