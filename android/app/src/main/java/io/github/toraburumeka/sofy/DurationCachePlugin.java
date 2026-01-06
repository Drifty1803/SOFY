package io.github.toraburumeka.sofy;

import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "DurationCache")
public class DurationCachePlugin extends Plugin {
    private static final String TAG = "DurationCachePlugin";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @Override
    public void load() {
        Log.d(TAG, "DurationCachePlugin loaded");
    }

    @PluginMethod
    public void getDurations(PluginCall call) {
        Log.d(TAG, "getDurations called");
        
        JSONArray tracksArray = call.getArray("tracks");
        String playlistId = call.getString("playlistId", "unknown");
        
        if (tracksArray == null) {
            Log.e(TAG, "No tracks provided");
            call.reject("No tracks provided");
            return;
        }

        final int totalTracks = tracksArray.length();
        Log.d(TAG, "Processing " + totalTracks + " tracks for playlist " + playlistId);

        executor.execute(() -> {
            JSArray durations = new JSArray();
            long totalDuration = 0;

            MediaMetadataRetriever retriever = new MediaMetadataRetriever();
            
            int lastReportedPercent = -1;

            for (int i = 0; i < totalTracks; i++) {
                long duration = 0;
                try {
                    String path = tracksArray.getString(i);
                    retriever.setDataSource(getContext(), Uri.parse(path));
                    String durationStr = retriever.extractMetadata(
                        MediaMetadataRetriever.METADATA_KEY_DURATION
                    );
                    if (durationStr != null) {
                        duration = Long.parseLong(durationStr);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Failed to get duration for track " + i + ": " + e.getMessage());
                }
                durations.put(duration);
                totalDuration += duration;

                int percent = (int) ((i + 1) * 100 / totalTracks);
                if (percent >= lastReportedPercent + 5 || i == totalTracks - 1) {
                    lastReportedPercent = percent;
                    
                    JSObject progressData = new JSObject();
                    progressData.put("playlistId", playlistId);
                    progressData.put("current", i + 1);
                    progressData.put("total", totalTracks);
                    progressData.put("percent", percent);
                    
                    notifyListeners("durationProgress", progressData);
                }
            }

            try {
                retriever.release();
            } catch (Exception e) {}

            JSObject result = new JSObject();
            result.put("durations", durations);
            result.put("totalDuration", totalDuration);

            Log.d(TAG, "Total duration calculated: " + totalDuration + "ms for " + totalTracks + " tracks");

            call.resolve(result);
        });
    }
}