import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { StateManager } from '../data/StateManager.js';

let DurationCachePlugin = null;

DurationCachePlugin = registerPlugin('DurationCache');
DurationCachePlugin.addListener('durationProgress', (data) => {
  StateManager.emit('durationProgress', data);
});

const CACHE_KEY_PREFIX = 'duration_cache_';

export class DurationCache {
  static async getCachedDurations(playlistId) {
    try {
      const { value } = await Preferences.get({ key: CACHE_KEY_PREFIX + playlistId });
      if (value) {
        const data = JSON.parse(value);
        return data;
      }
    } catch (e) {}
    return null;
  }

  static async saveDurations(playlistId, durations, totalDuration) {
    try {
      const data = { durations, totalDuration, timestamp: Date.now() };
      await Preferences.set({
        key: CACHE_KEY_PREFIX + playlistId,
        value: JSON.stringify(data)
      });
    } catch (e) {}
  }

  static async calculateAndCacheDurations(playlistId, tracks) {
    if (!Capacitor.isNativePlatform() || !DurationCachePlugin) {
      return { durations: [], totalDuration: 0 };
    }
    try {
      const result = await DurationCachePlugin.getDurations({ 
        tracks,
        playlistId 
      });
      await this.saveDurations(playlistId, result.durations, result.totalDuration);
      return {
        durations: result.durations,
        totalDuration: result.totalDuration
      };
    } catch (e) {
      return { durations: [], totalDuration: 0 };
    }
  }

  static async getDurationsForPlaylist(playlistId, tracks) {
    const cached = await this.getCachedDurations(playlistId);
    if (cached && cached.durations && cached.durations.length === tracks.length) {
      return cached;
    }
    return await this.calculateAndCacheDurations(playlistId, tracks);
  }

  static async clearCache(playlistId) {
    try {
      await Preferences.remove({ key: CACHE_KEY_PREFIX + playlistId });
    } catch (e) {}
  }
}