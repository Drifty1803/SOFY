package io.github.toraburumeka.sofy;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FolderPickerPlugin.class);
        registerPlugin(NativeAudioPlugin.class);
        registerPlugin(DurationCachePlugin.class);
        super.onCreate(savedInstanceState);
    }
}