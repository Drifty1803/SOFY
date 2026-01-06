class LinksStoreClass {
  constructor() {
    this.localPaths = {};
  }

  getLocalPaths(playlistId) {
    return this.localPaths[playlistId] || [];
  }

  setLocalPaths(playlistId, paths) {
    if (!Array.isArray(paths)) {
      return;
    }

    this.localPaths[playlistId] = paths.filter(p => 
      typeof p === 'string' && p.length > 0 && (p.startsWith('content://') || p.startsWith('file://') || p.startsWith('http'))
    );
    
  }

  getPlaylistIds() {
    return Object.keys(this.localPaths);
  }

  getTotalTracks() {
    return Object.values(this.localPaths).reduce((sum, paths) => sum + paths.length, 0);
  }

  clearAll() {
    this.localPaths = {};
  }
}

export const LinksStore = new LinksStoreClass();