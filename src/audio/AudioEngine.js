import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { LinksStore } from '../data/LinksStore.js';
import { StateManager } from '../data/StateManager.js';
import { Logger } from '../utils/Logger.js';
import { NativeAudioBridge } from './NativeAudioBridge.js';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { AudioPlayer } from './AudioPlayer.js';

export class AudioEngine {
  constructor() {
    this.playlistId = null;
    this.isNative = Capacitor.isNativePlatform();

    if (this.isNative) {
      this.nativeBridge = new NativeAudioBridge();
      this._setupNativeListeners();
    } else {
      this.currentPlayer = null;
      this.currentTrackIndex = 0;
      this.playedIndices = new Set();
      this.trackDurations = [];
      this.progressInterval = null;
    }
  }

  _setupNativeListeners() {
    this.nativeBridge.on('playStateChanged', (isPlaying) => {
      Logger.info('AudioEngine', `Native playStateChanged: ${isPlaying}`);
      StateManager.setPlayState(isPlaying);
    });

    this.nativeBridge.on('progressChanged', (position, duration) => {
      StateManager.emit('progressChanged', { position, duration });
    });
  }

  async loadPlaylist(playlistId) {
    this.destroy();
    this.playlistId = playlistId;

    const localPaths = LinksStore.getLocalPaths(playlistId);
    if (!localPaths || !localPaths.length) {
      Logger.warn('AudioEngine', `No tracks found for playlist: ${playlistId}`);
      return false;
    }

    const playlists = StateManager.getPlaylists();
    const currentPlaylist = playlists.find(p => p.id === playlistId);
    const playlistName = currentPlaylist ? currentPlaylist.title : 'VNL Folder';

    let coverUri = '';
    try {
      const cachedCoverName = `cover_${playlistId}.png`;
      const uriResult = await Filesystem.getUri({
        path: cachedCoverName,
        directory: Directory.Data
      });
      coverUri = uriResult.uri;
    } catch (e) {}

    if (this.isNative) {
      try { await KeepAwake.keepAwake(); } catch(e) {}
      return await this.nativeBridge.loadPlaylist(playlistId, localPaths, playlistName, coverUri);
    } else {
      this.playedIndices.clear();
      this.trackDurations = new Array(localPaths.length).fill(0);
      this.currentTrackIndex = Math.floor(Math.random() * localPaths.length);
      await this._webPrepareAndPlayTrack(this.currentTrackIndex, false);
      return true;
    }
  }

  play() {
    if (this.isNative) {
      this.nativeBridge.play();
    } else {
      if (this.currentPlayer) this.currentPlayer.play();
    }
  }

  pause() {
    if (this.isNative) {
      this.nativeBridge.pause();
    } else {
      if (this.currentPlayer) this.currentPlayer.pause();
    }
  }

  stop() {
    if (this.isNative) {
      this.nativeBridge.stop();
    } else {
      if (this.currentPlayer) {
        this.currentPlayer.stop();
        StateManager.setPlayState(false);
      }
      this._webStopProgressUpdates();
    }
    try { KeepAwake.allowSleep(); } catch(e) {}
  }

  playNext() {
    Logger.info('AudioEngine', 'playNext()');
    if (this.isNative) {
      this.nativeBridge.next();
    } else {
      this._webPlayNext();
    }
  }

  destroy() {
    this._webStopProgressUpdates();
    if (this.currentPlayer) {
      this.currentPlayer.destroy();
      this.currentPlayer = null;
    }
    this.playedIndices?.clear();
    this.trackDurations = [];
    try { KeepAwake.allowSleep(); } catch(e) {}
    this.playlistId = null;
  }

  async _webPrepareAndPlayTrack(index, autoPlay = true) {
    const localPaths = LinksStore.getLocalPaths(this.playlistId);
    if (!localPaths || !localPaths.length) return;

    this.playedIndices.add(index);
    const localPath = localPaths[index];

    let fileName = localPath.split('/').pop();
    try { fileName = decodeURIComponent(fileName); } catch(e) {}

    const playlists = StateManager.getPlaylists();
    const currentPlaylist = playlists.find(p => p.id === this.playlistId);
    const playlistName = currentPlaylist ? currentPlaylist.title : 'VNL Folder';

    let artworkSrc = 'assets/icons/icon.png';
    if (currentPlaylist && currentPlaylist.coverUrl) {
      artworkSrc = Capacitor.convertFileSrc(currentPlaylist.coverUrl);
    }

    try {
      if (this.currentPlayer) {
        this.currentPlayer.destroy();
        this.currentPlayer = null;
      }

      this.currentPlayer = new AudioPlayer(localPath, {
        title: fileName,
        artist: playlistName,
        album: '',
        artwork: artworkSrc
      });

      this._webSetupPlayerEvents(autoPlay);
      await this.currentPlayer.load();
    } catch (e) {
      setTimeout(() => this._webPlayNext(), 500);
    }
  }

  _webSetupPlayerEvents(autoPlay) {
    if (!this.currentPlayer) return;

    this.currentPlayer.on('ready', () => {
      if (autoPlay) this.currentPlayer.play();
    });

    this.currentPlayer.on('play', () => {
      StateManager.setPlayState(true);
      this._webStartProgressUpdates();
    });

    this.currentPlayer.on('pause', () => {
      StateManager.setPlayState(false);
      this._webStopProgressUpdates();
    });

    this.currentPlayer.on('ended', () => {
      this._webStopProgressUpdates();
      this._webPlayNext();
    });

    this.currentPlayer.on('error', () => {
      this._webStopProgressUpdates();
      this._webPlayNext();
    });

    this.currentPlayer.on('durationReady', (duration) => {
      this.trackDurations[this.currentTrackIndex] = duration;
    });
  }

  _webPlayNext() {
    const localPaths = LinksStore.getLocalPaths(this.playlistId);
    if (!localPaths || !localPaths.length) return;

    if (this.playedIndices.size >= localPaths.length) {
      this.playedIndices.clear();
      this.trackDurations = new Array(localPaths.length).fill(0);
    }

    const availableIndices = [];
    for (let i = 0; i < localPaths.length; i++) {
      if (!this.playedIndices.has(i)) {
        availableIndices.push(i);
      }
    }

    const nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.currentTrackIndex = nextIndex;
    this._webPrepareAndPlayTrack(nextIndex, true);
  }

  _webStartProgressUpdates() {
    this._webStopProgressUpdates();
    this.progressInterval = setInterval(() => {
      if (this.currentPlayer && this.currentPlayer.audio) {
        const position = this.currentPlayer.audio.currentTime * 1000;
        const duration = this.currentPlayer.audio.duration * 1000;
        StateManager.emit('progressChanged', { position, duration });
      }
    }, 1000);
  }

  _webStopProgressUpdates() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }
}