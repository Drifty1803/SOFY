import { Capacitor, registerPlugin } from '@capacitor/core';
import { DurationCache } from './DurationCache.js';
import { StateManager } from '../data/StateManager.js';

let NativeAudio = null;

if (Capacitor.isNativePlatform()) {
  NativeAudio = registerPlugin('NativeAudio');
}

export class NativeAudioBridge {
  constructor() {
    this.listeners = {
      playStateChanged: [],
      progressChanged: []
    };
    this._setupListeners();
  }

  async _setupListeners() {
    if (!NativeAudio) return;
    try {
      await NativeAudio.addListener('playStateChanged', (data) => {
        this.listeners.playStateChanged.forEach(cb => cb(data.isPlaying));
      });

      await NativeAudio.addListener('progressChanged', (data) => {
        this.listeners.progressChanged.forEach(cb => cb(data.position, data.duration));
      });

      await NativeAudio.addListener('metadataChanged', (data) => {
          StateManager.emit('trackMetadataLoaded', { cover: data.cover });
      });

    } catch (e) {}
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  async loadPlaylist(playlistId, tracks, title, coverUri) {
    if (!NativeAudio) {
      return false;
    }
    try {
      const durationData = await DurationCache.getDurationsForPlaylist(playlistId, tracks);
      const durations = durationData.durations || [];
      const totalDuration = durationData.totalDuration || 0;

      await NativeAudio.loadPlaylist({
        tracks,
        durations,
        totalDuration,
        title,
        cover: coverUri || ''
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  async play() {
    if (!NativeAudio) return;
    try {
      await NativeAudio.play();
    } catch (e) {
    }
  }

  async pause() {
    if (!NativeAudio) return;
    try {
      await NativeAudio.pause();
    } catch (e) {
    }
  }

  async stop() {
    if (!NativeAudio) return;
    try {
      await NativeAudio.stop();
    } catch (e) {
    }
  }

  async next() {
    if (!NativeAudio) return;
    try {
      await NativeAudio.next();
    } catch (e) {
    }
  }

  isAvailable() {
    return NativeAudio !== null;
  }
}