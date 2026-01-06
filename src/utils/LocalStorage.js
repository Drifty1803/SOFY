import { Preferences } from '@capacitor/preferences';

export class LocalStorage {
  static KEY_PLAYLISTS = 'custom_playlists_meta';

  static async savePlaylist(playlistObj) {
    const current = await this.getAllPlaylists();
    const existingIndex = current.findIndex(p => p.id === playlistObj.id);
    
    if (existingIndex !== -1) {
        current[existingIndex] = { ...current[existingIndex], ...playlistObj };
    } else {
        current.push(playlistObj);
    }
    
    await this.saveAllPlaylists(current);
  }

   static async saveAllPlaylists(playlists) {
    try {
        const dataToSave = playlists.map(p => ({
          id: p.id,
          title: p.title,
          coverUrl: p.coverUrl || p.coverPath,
          trackPaths: p.trackPaths || [],
          isLocal: !!p.isLocal, 
          createdAt: p.createdAt || Date.now(),
          colorData: p.colorData || null 
        }));

        await Preferences.set({
          key: this.KEY_PLAYLISTS,
          value: JSON.stringify(dataToSave)
        });
        
    } catch (e) {
        console.error('LocalStorage', 'Failed to save playlists', e);
    }
  }

  static async getAllPlaylists() {
    const { value } = await Preferences.get({ key: this.KEY_PLAYLISTS });
    if (!value) return [];
    try {
      return JSON.parse(value);
    } catch (e) {
      return [];
    }
  }

  static async removePlaylist(id) {
    let current = await this.getAllPlaylists();
    current = current.filter(p => p.id !== id);
    await Preferences.set({
      key: this.KEY_PLAYLISTS,
      value: JSON.stringify(current),
    });
  }

  static async clearAll() {
    await Preferences.remove({ key: this.KEY_PLAYLISTS });
  }
}