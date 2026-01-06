package io.github.toraburumeka.sofy;

import android.content.Intent;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

import org.json.JSONArray;
import org.json.JSONException;

@CapacitorPlugin(name = "NativeAudio")
public class NativeAudioPlugin extends Plugin {
    private static final String TAG = "NativeAudioPlugin";

    @Override
    public void load() {
        super.load();
        NativeAudioService.setPlugin(this);
        Log.d(TAG, "NativeAudioPlugin loaded and registered in Service");
    }

    @PluginMethod
    public void loadPlaylist(PluginCall call) {
        try {
            List<String> tracks = new ArrayList<>();
            JSONArray tracksArray = call.getArray("tracks");
            if (tracksArray != null) {
                for (int i = 0; i < tracksArray.length(); i++) {
                    tracks.add(tracksArray.getString(i));
                }
            }

            String title = call.getString("title", "Unknown Playlist");
            String cover = call.getString("cover", "");
            
            long totalDuration = 0;
            Long totalDurationObj = call.getLong("totalDuration");
            if (totalDurationObj != null) {
                totalDuration = totalDurationObj.longValue();
            } else {
                Double totalDurationDbl = call.getDouble("totalDuration");
                if (totalDurationDbl != null) {
                    totalDuration = totalDurationDbl.longValue();
                } else {
                     Integer totalDurationInt = call.getInt("totalDuration");
                     if (totalDurationInt != null) {
                         totalDuration = totalDurationInt.longValue();
                     }
                }
            }

            long[] durations = new long[tracks.size()];
            JSONArray durationsArray = call.getArray("durations");
            if (durationsArray != null) {
                for (int i = 0; i < durationsArray.length(); i++) {
                    Object val = durationsArray.get(i);
                    if (val instanceof Number) {
                        durations[i] = ((Number) val).longValue();
                    }
                }
            }

            Intent intent = new Intent(getContext(), NativeAudioService.class);
            intent.setAction(NativeAudioService.ACTION_LOAD_PLAYLIST);
            intent.putStringArrayListExtra("tracks", (ArrayList<String>) tracks);
            intent.putExtra("title", title);
            intent.putExtra("cover", cover);
            intent.putExtra("durations", durations);
            intent.putExtra("totalDuration", totalDuration);

            getContext().startService(intent);
            call.resolve();
        } catch (JSONException e) {
            call.reject("Failed to parse playlist: " + e.getMessage());
        }
    }

    @PluginMethod
    public void play(PluginCall call) {
        Intent intent = new Intent(getContext(), NativeAudioService.class);
        intent.setAction(NativeAudioService.ACTION_PLAY);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        Intent intent = new Intent(getContext(), NativeAudioService.class);
        intent.setAction(NativeAudioService.ACTION_PAUSE);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), NativeAudioService.class);
        intent.setAction(NativeAudioService.ACTION_STOP);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void next(PluginCall call) {
        Intent intent = new Intent(getContext(), NativeAudioService.class);
        intent.setAction(NativeAudioService.ACTION_NEXT);
        getContext().startService(intent);
        call.resolve();
    }

    public void notifyPlayState(boolean isPlaying) {
        JSObject ret = new JSObject();
        ret.put("isPlaying", isPlaying);
        notifyListeners("playStateChanged", ret);
    }

    public void notifyProgress(long position, long duration) {
        JSObject ret = new JSObject();
        ret.put("position", position);
        ret.put("duration", duration);
        notifyListeners("progressChanged", ret);
    }
    
    public void notifyMetadata(String base64) {
        JSObject ret = new JSObject();
        ret.put("cover", base64); 
        notifyListeners("metadataChanged", ret);
    }
}