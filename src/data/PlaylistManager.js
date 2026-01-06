import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { LinksStore } from './LinksStore.js';
import { LocalStorage } from '../utils/LocalStorage.js';
import { StateManager } from './StateManager.js';
import { DurationCache } from '../audio/DurationCache.js';

export class PlaylistManager {
  
  static async processNativeFolder(folderName, files) {
    const playlistId = `local_${Date.now()}`;
    StateManager.addLoadingPlaylist(playlistId, folderName);
    return this.processScannedFolder(playlistId, folderName, files);
  }

  static async processScannedFolder(playlistId, folderName, files) {
    try {
      StateManager.updateLoadingProgress(playlistId, 5, 'scanning');
      const audioFiles = [];
      let coverUri = null;

      for (const f of files) {
        if (/\.(mp3|ogg|m4a|wav|flac|aac)$/i.test(f.name)) audioFiles.push(f.uri);
        else if (/\.(png|jpg|jpeg|webp)$/i.test(f.name) && !coverUri) coverUri = f.uri;
      }

      if (audioFiles.length === 0) throw new Error("No music files");
      if (!coverUri) throw new Error("No cover found");

      StateManager.updateLoadingProgress(playlistId, 15, 'preview');
      const previewReadResult = await Filesystem.readFile({ path: coverUri });
      
      StateManager.emit('previewReadyForBlur', { id: playlistId, base64: previewReadResult.data });
      StateManager.updateLoadingProgress(playlistId, 30, 'duration');
      
      const durationResult = await DurationCache.calculateAndCacheDurations(playlistId, audioFiles);
      StateManager.updateLoadingProgress(playlistId, 70, 'cover');

      const cachedCoverName = `cover_${playlistId}.png`;
      await Filesystem.writeFile({ path: cachedCoverName, data: previewReadResult.data, directory: Directory.Data });
      const uriResult = await Filesystem.getUri({ path: cachedCoverName, directory: Directory.Data });
      const coverWebUrl = Capacitor.convertFileSrc(uriResult.uri);

      StateManager.updateLoadingProgress(playlistId, 85, 'saving');

      const playlistObj = {
        id: playlistId,
        title: folderName,
        coverPath: coverUri,
        trackPaths: audioFiles,
        createdAt: Date.now(),
        isLocal: true,
        totalDuration: durationResult.totalDuration
      };

      await LocalStorage.savePlaylist(playlistObj);
      await LinksStore.setLocalPaths(playlistId, audioFiles);

      StateManager.updateLoadingProgress(playlistId, 95, 'finalizing');
      
      StateManager.emit('playlistReadyForTexture', {
        id: playlistId,
        title: folderName,
        coverUrl: coverWebUrl,
        trackPaths: audioFiles,
        coverBase64: previewReadResult.data
      });
      
      return folderName;
    } catch (e) {
      StateManager.cancelLoadingPlaylist(playlistId);
      throw e;
    }
  }

  static async updatePlaylist(playlistId, updates) {
    try {
        const playlists = StateManager.getPlaylists(); 
        const index = playlists.findIndex(p => p.id === playlistId);
        
        if (index !== -1) {
            const allSaved = await LocalStorage.getAllPlaylists();
            const savedIndex = allSaved.findIndex(p => p.id === playlistId);
            if (savedIndex !== -1) {
                allSaved[savedIndex] = { ...allSaved[savedIndex], ...updates };
                await LocalStorage.saveAllPlaylists(allSaved);
                return true;
            }
        }
        return false;
    } catch (e) {
        return false;
    }
  }

  static async getCoverBase64(playlistId) {
    try {
      const file = await Filesystem.readFile({ path: `cover_${playlistId}.png`, directory: Directory.Data });
      return file.data;
    } catch (e) { return null; }
  }

  static async loadSavedPlaylists() {
    try {
      const playlists = await LocalStorage.getAllPlaylists();

      for (const pl of playlists) {
        if (pl.isLocal) {
          await LinksStore.setLocalPaths(pl.id, pl.trackPaths);
          StateManager.addLocalPlaylistToState({
            id: pl.id,
            title: pl.title,
            coverUrl: pl.coverUrl,
            isLocal: true,
            trackPaths: pl.trackPaths,
            colorData: pl.colorData 
          });
        }
      }
    } catch (e) {
    }
  }

  static async loadInitialData() {
    await this.loadSavedPlaylists();
  }
}