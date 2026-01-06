package io.github.toraburumeka.sofy;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Binder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Base64;
import android.util.Log;
import android.view.KeyEvent;

import androidx.annotation.Nullable;
import androidx.annotation.OptIn;
import androidx.core.app.NotificationCompat;
import androidx.media.session.MediaButtonReceiver;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;

public class NativeAudioService extends Service {
    private static final String TAG = "NativeAudioService";
    private static final String CHANNEL_ID = "native_audio_channel";
    private static final int NOTIFICATION_ID = 2;

    public static final String ACTION_LOAD_PLAYLIST = "io.github.toraburumeka.sofy.LOAD_PLAYLIST";
    public static final String ACTION_PLAY = "io.github.toraburumeka.sofy.PLAY";
    public static final String ACTION_PAUSE = "io.github.toraburumeka.sofy.PAUSE";
    public static final String ACTION_STOP = "io.github.toraburumeka.sofy.STOP";
    public static final String ACTION_NEXT = "io.github.toraburumeka.sofy.NEXT";

    private ExoPlayer player;
    private MediaSessionCompat mediaSession;
    private final IBinder binder = new LocalBinder();
    private Handler mainHandler;
    private Runnable progressRunnable;

    private static final int FADE_DURATION_MS = 800;
    private static final int FADE_STEPS = 20;
    private float targetVolume = 1.0f;
    private Runnable fadeRunnable;
    private boolean isFadingOut = false;

    private static final int TRACK_GAP_MS = 2000;
    private Runnable nextTrackRunnable;

    private List<String> playlist = new ArrayList<>();
    private Set<Integer> playedIndices = new HashSet<>();
    private int currentTrackIndex = -1;
    private String playlistTitle = "VNL Player";
    private String coverUri = "";
    private Bitmap coverBitmap = null;

    private long[] trackDurations;
    private long totalPlaylistDuration = 0;

    private static NativeAudioPlugin pluginInstance;

    public static void setPlugin(NativeAudioPlugin plugin) {
        pluginInstance = plugin;
    }

    public class LocalBinder extends Binder {
        NativeAudioService getService() {
            return NativeAudioService.this;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Service onCreate");

        mainHandler = new Handler(Looper.getMainLooper());
        createNotificationChannel();
        initMediaSession();
        initPlayer();
    }

    private void initMediaSession() {
        mediaSession = new MediaSessionCompat(this, "VNLNativePlayer");

        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                Log.d(TAG, "MediaSession: onPlay");
                play();
            }

            @Override
            public void onPause() {
                Log.d(TAG, "MediaSession: onPause");
                pause();
            }

            @Override
            public void onStop() {
                Log.d(TAG, "MediaSession: onStop");
                stop();
            }

            @Override
            public boolean onMediaButtonEvent(Intent mediaButtonEvent) {
                KeyEvent keyEvent = mediaButtonEvent.getParcelableExtra(Intent.EXTRA_KEY_EVENT);
                if (keyEvent != null && keyEvent.getAction() == KeyEvent.ACTION_DOWN) {
                    int keyCode = keyEvent.getKeyCode();
                    Log.d(TAG, "MediaButton keyCode: " + keyCode);

                    switch (keyCode) {
                        case KeyEvent.KEYCODE_MEDIA_PLAY:
                            play();
                            return true;
                        case KeyEvent.KEYCODE_MEDIA_PAUSE:
                            pause();
                            return true;
                        case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
                        case KeyEvent.KEYCODE_HEADSETHOOK:
                            if (isPlaying()) {
                                pause();
                            } else {
                                play();
                            }
                            return true;
                        case KeyEvent.KEYCODE_MEDIA_STOP:
                            stop();
                            return true;
                        case KeyEvent.KEYCODE_MEDIA_NEXT:
                        case KeyEvent.KEYCODE_MEDIA_PREVIOUS:
                            return true;
                    }
                }
                return super.onMediaButtonEvent(mediaButtonEvent);
            }
        });

        mediaSession.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
            MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );

        mediaSession.setActive(true);
        Log.d(TAG, "MediaSession initialized");
    }

    @OptIn(markerClass = UnstableApi.class)
    private void initPlayer() {
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build();

        player = new ExoPlayer.Builder(this)
            .setAudioAttributes(audioAttributes, true)
            .setHandleAudioBecomingNoisy(true)
            .build();

        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_ENDED) {
                    scheduleNextTrack();
                }
                updatePlaybackState();
            }

            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                Log.d(TAG, "isPlaying: " + isPlaying);
                updateNotification();
                updatePlaybackState();

                if (!isFadingOut) {
                    notifyPlayState(isPlaying);
                }

                if (isPlaying) {
                    startProgressUpdates();
                } else {
                    stopProgressUpdates();
                }
            }
        });

        Log.d(TAG, "ExoPlayer initialized");
    }

    private void scheduleNextTrack() {
        if (nextTrackRunnable != null) {
            mainHandler.removeCallbacks(nextTrackRunnable);
        }
        
        nextTrackRunnable = new Runnable() {
            @Override
            public void run() {
                playNext();
            }
        };
        
        mainHandler.postDelayed(nextTrackRunnable, TRACK_GAP_MS);
    }

    private void cancelScheduledNextTrack() {
        if (nextTrackRunnable != null) {
            mainHandler.removeCallbacks(nextTrackRunnable);
            nextTrackRunnable = null;
        }
    }



    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            return START_STICKY;
        }

        String action = intent.getAction();
        Log.d(TAG, "onStartCommand: " + action);

        if (Intent.ACTION_MEDIA_BUTTON.equals(action)) {
            MediaButtonReceiver.handleIntent(mediaSession, intent);
            return START_STICKY;
        }

        if (ACTION_LOAD_PLAYLIST.equals(action)) {
            cancelScheduledNextTrack(); 
            ArrayList<String> tracks = intent.getStringArrayListExtra("tracks");
            String title = intent.getStringExtra("title");
            String cover = intent.getStringExtra("cover");
            long[] durations = intent.getLongArrayExtra("durations");
            long totalDuration = intent.getLongExtra("totalDuration", 0L);

            if (tracks != null && !tracks.isEmpty()) {
                loadPlaylist(tracks, title, cover, durations, totalDuration);
            }
        } else if (ACTION_PLAY.equals(action)) {
            play();
        } else if (ACTION_PAUSE.equals(action)) {
            pause();
        } else if (ACTION_STOP.equals(action)) {
            stop();
        } else if (ACTION_NEXT.equals(action)) {
            cancelScheduledNextTrack();
            playNextWithFade();
        }

        return START_STICKY;
    }

    private void loadPlaylist(List<String> tracks, String title, String cover, 
                              long[] durations, long totalDuration) {
        Log.d(TAG, "Loading playlist: " + title + ", tracks: " + tracks.size() + 
              ", totalDuration: " + totalDuration);

        this.playlist = new ArrayList<>(tracks);
        this.playlistTitle = title != null ? title : "VNL Player";
        this.coverUri = cover != null ? cover : "";
        this.playedIndices.clear();
        this.currentTrackIndex = -1;

        if (durations != null && durations.length == tracks.size()) {
            this.trackDurations = durations;
            this.totalPlaylistDuration = totalDuration;
        } else {
            this.trackDurations = new long[tracks.size()];
            this.totalPlaylistDuration = 0;
        }

        if (!coverUri.isEmpty()) {
            loadCoverAsync(coverUri);
        } else {
            coverBitmap = null;
        }

        updateMediaSessionMetadata();
        playNext();
    }

    private void loadCoverAsync(String uri) {
        new Thread(() -> {
            try {
                if (uri.startsWith("content://") || uri.startsWith("file://")) {
                    InputStream inputStream = getContentResolver().openInputStream(Uri.parse(uri));
                    coverBitmap = BitmapFactory.decodeStream(inputStream);
                    if (inputStream != null) inputStream.close();
                }
                mainHandler.post(() -> {
                    updateNotification();
                    updateMediaSessionMetadata();
                });
            } catch (Exception e) {
                Log.e(TAG, "Failed to load cover: " + e.getMessage());
                coverBitmap = null;
            }
        }).start();
    }

    private void playTrack(int index) {
        cancelScheduledNextTrack();
        if (index < 0 || index >= playlist.size()) {
            Log.w(TAG, "Invalid track index: " + index);
            return;
        }

        currentTrackIndex = index;
        playedIndices.add(index);

        String path = playlist.get(index);
        Log.d(TAG, "Playing track " + index + ": " + path);

        Uri uri = Uri.parse(path);
        MediaItem mediaItem = MediaItem.fromUri(uri);

        player.setVolume(0f);
        player.setMediaItem(mediaItem);
        player.prepare();
        player.play();

        fadeIn();
        updateNotification();
        extractAndNotifyCover(path);
    }

    private void extractAndNotifyCover(String path) {
        new Thread(() -> {
            MediaMetadataRetriever mmr = null;
            try {
                mmr = new MediaMetadataRetriever();
 
                if (path.startsWith("content://") || path.startsWith("file://")) {
                    mmr.setDataSource(this, Uri.parse(path));
                } else {
                    try {
                        mmr.setDataSource(path);
                    } catch (Exception e1) {
                         mmr.setDataSource(this, Uri.parse("file://" + path));
                    }
                }
                
                byte[] data = mmr.getEmbeddedPicture();
                
                if (data != null) {
                    String base64 = Base64.encodeToString(data, Base64.NO_WRAP);
                    mainHandler.post(() -> notifyMetadata(base64));
                } else {
                    mainHandler.post(() -> notifyMetadata(null));
                }
            } catch (Exception e) {
                Log.e(TAG, "Error extracting cover: " + e.getMessage());
                mainHandler.post(() -> notifyMetadata(null));
            } finally {
                if (mmr != null) {
                    try {
                        mmr.release();
                    } catch (Exception ignored) {}
                }
            }
        }).start();
    }

    private void notifyMetadata(String base64) {
        if (pluginInstance != null) {
            pluginInstance.notifyMetadata(base64);
        }
    }


    private long getPlaylistPosition() {
        long position = 0;

        for (int idx : playedIndices) {
            if (idx != currentTrackIndex && idx < trackDurations.length) {
                position += trackDurations[idx];
            }
        }

        if (player != null) {
            position += player.getCurrentPosition();
        }

        return position;
    }

    private void fadeIn() {
        cancelFade();
        isFadingOut = false;

        final float startVolume = 0f;
        final float endVolume = targetVolume;
        final float step = (endVolume - startVolume) / FADE_STEPS;
        final int stepDuration = FADE_DURATION_MS / FADE_STEPS;

        fadeRunnable = new Runnable() {
            float currentVolume = startVolume;
            int currentStep = 0;

            @Override
            public void run() {
                if (player == null || currentStep >= FADE_STEPS) {
                    if (player != null) player.setVolume(endVolume);
                    return;
                }

                currentVolume += step;
                player.setVolume(Math.min(currentVolume, endVolume));
                currentStep++;
                mainHandler.postDelayed(this, stepDuration);
            }
        };

        mainHandler.post(fadeRunnable);
    }

    private void fadeOut(Runnable onComplete) {
        cancelFade();
        isFadingOut = true;

        if (player == null || !player.isPlaying()) {
            isFadingOut = false;
            if (onComplete != null) onComplete.run();
            return;
        }

        final float startVolume = player.getVolume();
        final float step = startVolume / FADE_STEPS;
        final int stepDuration = (FADE_DURATION_MS / 2) / FADE_STEPS;

        fadeRunnable = new Runnable() {
            float currentVolume = startVolume;
            int currentStep = 0;

            @Override
            public void run() {
                if (player == null || currentStep >= FADE_STEPS) {
                    if (player != null) player.setVolume(0f);
                    isFadingOut = false;
                    if (onComplete != null) onComplete.run();
                    return;
                }

                currentVolume -= step;
                player.setVolume(Math.max(currentVolume, 0f));
                currentStep++;
                mainHandler.postDelayed(this, stepDuration);
            }
        };

        mainHandler.post(fadeRunnable);
    }

    private void cancelFade() {
        if (fadeRunnable != null) {
            mainHandler.removeCallbacks(fadeRunnable);
            fadeRunnable = null;
        }
    }

    public void play() {
        Log.d(TAG, "play()");
        if (player != null) {
            if (currentTrackIndex < 0 && !playlist.isEmpty()) {
                playNext();
            } else {
                player.play();
                fadeIn();
            }
        }
    }

    public void pause() {
        Log.d(TAG, "pause()");
        if (player != null && player.isPlaying()) {
            fadeOut(() -> {
                if (player != null) {
                    player.pause();
                    notifyPlayState(false);
                }
            });
        }
    }

    public void stop() {
        Log.d(TAG, "stop()");
        cancelFade();
        stopProgressUpdates();
        if (player != null) {
            player.stop();
        }
        if (mediaSession != null) {
            mediaSession.setActive(false);
        }
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    public void playNext() {
        if (playlist.isEmpty()) {
            Log.w(TAG, "Playlist is empty");
            return;
        }

        if (playedIndices.size() >= playlist.size()) {
            Log.d(TAG, "All tracks played, resetting shuffle");
            playedIndices.clear();
        }

        List<Integer> available = new ArrayList<>();
        for (int i = 0; i < playlist.size(); i++) {
            if (!playedIndices.contains(i)) {
                available.add(i);
            }
        }

        Random random = new Random();
        int nextIndex = available.get(random.nextInt(available.size()));

        Log.d(TAG, "Next track: " + nextIndex + ", played: " + playedIndices.size() + "/" + playlist.size());
        playTrack(nextIndex);
    }

    private void playNextWithFade() {
        if (player != null && player.isPlaying()) {
            fadeOut(this::playNext);
        } else {
            playNext();
        }
    }

    public boolean isPlaying() {
        return player != null && player.isPlaying();
    }

    private void startProgressUpdates() {
        stopProgressUpdates();
        progressRunnable = new Runnable() {
            @Override
            public void run() {
                if (player != null && player.isPlaying()) {
                    long playlistPosition = getPlaylistPosition();
                    notifyProgress(playlistPosition, totalPlaylistDuration);
                    updatePlaybackState();
                    mainHandler.postDelayed(this, 1000);
                }
            }
        };
        mainHandler.post(progressRunnable);
    }

    private void stopProgressUpdates() {
        if (progressRunnable != null) {
            mainHandler.removeCallbacks(progressRunnable);
            progressRunnable = null;
        }
    }

    private void notifyPlayState(boolean isPlaying) {
        if (pluginInstance != null) {
            pluginInstance.notifyPlayState(isPlaying);
        }
    }

    private void notifyProgress(long position, long duration) {
        if (pluginInstance != null) {
            pluginInstance.notifyProgress(position, duration);
        }
    }

    private void updatePlaybackState() {
        if (mediaSession == null || player == null) return;

        long actions = PlaybackStateCompat.ACTION_PLAY
            | PlaybackStateCompat.ACTION_PAUSE
            | PlaybackStateCompat.ACTION_PLAY_PAUSE
            | PlaybackStateCompat.ACTION_STOP;

        int state = isPlaying() ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
        float speed = isPlaying() ? 1.0f : 0f;

        long playlistPosition = getPlaylistPosition();

        PlaybackStateCompat.Builder builder = new PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(state, playlistPosition, speed);

        mediaSession.setPlaybackState(builder.build());
    }

    private void updateMediaSessionMetadata() {
        if (mediaSession == null) return;

        MediaMetadataCompat.Builder builder = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, playlistTitle)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, totalPlaylistDuration);

        if (coverBitmap != null) {
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, coverBitmap);
        }

        mediaSession.setMetadata(builder.build());
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Audio Playback",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Audio playback controls");
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void updateNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(playlistTitle)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(contentIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(isPlaying())
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView()
            );

        if (coverBitmap != null) {
            builder.setLargeIcon(coverBitmap);
        }

        Notification notification = builder.build();
        startForeground(NOTIFICATION_ID, notification);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "Service onDestroy");
        cancelFade();
        stopProgressUpdates();

        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }

        if (player != null) {
            player.release();
            player = null;
        }

        super.onDestroy();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Log.d(TAG, "onTaskRemoved - keeping service alive");
        super.onTaskRemoved(rootIntent);
    }
}