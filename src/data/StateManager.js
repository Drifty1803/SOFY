import Phaser from 'phaser';
import { ColorExtractor } from '../utils/ColorExtractor.js';
import { LocalStorage } from '../utils/LocalStorage.js';

class StateManagerClass extends Phaser.Events.EventEmitter {
  constructor() {
    super();
    
    this.playlists = [];
    this.addButtonIndex = -1;
    this.colorDataMap = {}; 
    
    this.centerIndex = 0;
    this.selectedPlaylist = null;
    this.isPlaying = false;
    this.selectionMode = true;
    this.bubbleRenderer = null;
    this.isAddingPlaylist = false;
    
    this.tempPaletteColors = null;

    this.loadingPlaylists = new Map(); 
    this.on('playlistReadyForColors', this.onPlaylistReadyForColors, this);
  }
  
  addLoadingPlaylist(id, title) {
    const loadingData = {
      progress: 0,
      stage: 'scanning',
      title: title
    };
    this.loadingPlaylists.set(id, loadingData);
    
    this.playlists.push({
      id: id,
      title: title,
      available: false,
      isLocal: true,
      isLoading: true,
      coverUrl: null,
      trackPaths: []
    });
    
    const newPlaylistIndex = this.playlists.length - 1;
    this.addButtonIndex = -1;
    this.centerIndex = newPlaylistIndex;
    
    this.emit('playlistLoading', { id, ...loadingData });
    this.emit('playlistsChanged');
    this.emit('centerIndexChanged', newPlaylistIndex);
    
    return id;
  }
  
  updateLoadingProgress(id, progress, stage) {
    const data = this.loadingPlaylists.get(id);
    if (data) {
      data.progress = progress;
      data.stage = stage;
      this.emit('playlistLoadingProgress', { id, progress, stage });
    }
  }
  
  finishLoadingPlaylist(id, playlistData) {
    this.loadingPlaylists.delete(id);
    
    const index = this.playlists.findIndex(p => p.id === id);
    if (index !== -1) {
      this.playlists[index] = {
        ...this.playlists[index],
        ...playlistData,
        isLoading: false,
        available: true
      };
    }
    
    if (playlistData.colorData) {
      this.setColorData(id, playlistData.colorData);
    }
    
    this.emit('playlistLoadingComplete', { id });
    this.emit('playlistsChanged');
    
    if (this.playlists[this.centerIndex]?.id === id) {
      this.applyColorsForPlaylist(id);
      this.forceRefreshColors();
    }
  }
  
  cancelLoadingPlaylist(id) {
    this.loadingPlaylists.delete(id);
    
    const index = this.playlists.findIndex(p => p.id === id);
    if (index !== -1) {
      this.playlists.splice(index, 1);
      
      if (this.centerIndex >= this.playlists.length) {
        this.centerIndex = Math.max(0, this.playlists.length - 1);
      }
    }
    
    this.emit('playlistLoadingCancelled', { id });
    this.emit('playlistsChanged');
    this.emit('centerIndexChanged', this.centerIndex);
  }
  
  isPlaylistLoading(id) { return this.loadingPlaylists.has(id); }
  getLoadingProgress(id) { return this.loadingPlaylists.get(id) || null; }

  async reorderPlaylist(direction) {
    if (this.isAddButtonSelected()) return;
    
    const currentPlaylist = this.playlists[this.centerIndex];
    if (currentPlaylist?.isLoading) return;

    const currentIndex = this.centerIndex;
    const newIndex = currentIndex + direction;

    if (newIndex < 0 || newIndex >= this.playlists.length) return;
    if (this.playlists[newIndex]?.isLoading) return;

    const temp = this.playlists[currentIndex];
    this.playlists[currentIndex] = this.playlists[newIndex];
    this.playlists[newIndex] = temp;

    this.centerIndex = newIndex;

    await LocalStorage.saveAllPlaylists(this.playlists.filter(p => !p.isLoading));
    this.emit('playlistOrderChanged');
  }

  async deletePlaylist(id) {
    if (this.isAddButtonSelected()) return;
    
    const playlist = this.playlists.find(p => p.id === id);
    if (playlist?.isLoading) {
      this.cancelLoadingPlaylist(id);
      return;
    }

    const index = this.playlists.findIndex(p => p.id === id);
    if (index === -1) return;

    this.playlists.splice(index, 1);
    await LocalStorage.saveAllPlaylists(this.playlists.filter(p => !p.isLoading));
    
    if (this.centerIndex >= this.playlists.length) {
        this.centerIndex = Math.max(0, this.playlists.length - 1);
    }

    this.emit('playlistRemoved', id);
    this.emit('centerIndexChanged', this.centerIndex);
    this.forceRefreshColors();
  }

  setAddButtonIndex(index) {
    this.addButtonIndex = index;
    this.centerIndex = -1; 
    this.emit('centerIndexChanged', index);
    this.applyAddButtonColors();
  }
  
  getAddButtonIndex() { return this.addButtonIndex; }
  isAddButtonSelected() { return this.addButtonIndex >= 0; }
  getTotalItems() { return this.playlists.length + 1; }
  
  getCenterIndex() {
    if (this.isAddButtonSelected()) return this.addButtonIndex;
    return this.centerIndex;
  }
  
  getPlaylists() { return this.playlists; }

  setCenterIndex(index) {
    if (index === this.centerIndex) return;
    
    this.centerIndex = index;
    this.addButtonIndex = -1;
    
    this.emit('centerIndexChanged', index);

    if (this.isAddButtonSelected()) {
      this.applyColorsForPlaylist('add-button');
    } else {
      const playlist = this.playlists[index];
      if (playlist) {
        if (playlist.isLoading) {
          this.applyColorsForPlaylist('loading-placeholder');
        } else {
          this.applyColorsForPlaylist(playlist.id);
        }
      }
    }
  }

  applyAddButtonColors() {
    const grayData = ColorExtractor.getAddButtonColors();
    this.setColorData('add-button', grayData);
    this.applyColorsForPlaylist('add-button');
  }

  setColorData(playlistId, data) {
    if (!data) {
      return;
    }
    this.colorDataMap[playlistId] = data;
    const pl = this.playlists.find(p => p.id === playlistId);
    if (pl) pl.colorData = data;
  }

  getBubbleColors(playlistId) { return this.colorDataMap[playlistId]?.bubbles || null; }
  getPixelCoords(playlistId) { return this.colorDataMap[playlistId]?.coords || null; }

  applyColorsForPlaylist(playlistId) {
    if (!this.bubbleRenderer) return;

    let data = this.colorDataMap[playlistId];

    if (!data || !data.bubbles || data.bubbles.length < 2) {
      data = ColorExtractor.getFallbackColors(); 
    }

    this.bubbleRenderer.transitionToColors(data.bubbles);

    if (data.background) {
      this.emit('backgroundColorChanged', data.background);
    }
  }

  onPlaylistReadyForColors({ id }) {
    if (this.centerIndex >= 0 && this.playlists[this.centerIndex]?.id === id) {
      this.applyColorsForPlaylist(id);
    }
  }

  applyColorData(data) {
    if (!data?.background) return;
    this.emit('backgroundColorChanged', data.background);
  }

  initTempPalette(playlistId) {
    const data = this.colorDataMap[playlistId];
    if (data && data.bubbles) {
        this.tempPaletteColors = [...data.bubbles];
    } else {
        this.tempPaletteColors = [0x888888, 0x888888, 0x888888, 0x888888];
    }
  }
  
  updateLiveColor(index, colorInt, colorObj) {
    if (!this.bubbleRenderer) return;
    
    if (index === 4) { 
        document.body.style.transition = 'none'; 
        document.body.style.backgroundColor = `rgb(${colorObj.r}, ${colorObj.g}, ${colorObj.b})`;
    } else if (index < 4) { 
        if (!this.tempPaletteColors) {
            this.tempPaletteColors = [0,0,0,0]; 
        }
        this.tempPaletteColors[index] = colorInt;
        this.bubbleRenderer.setColors(this.tempPaletteColors); 
    }
  }

  savePalette(playlistId, coords) {
    if (!coords || coords.length < 6) return;

    const bubbles = coords.slice(0, 4).map(c => (c.r << 16) | (c.g << 8) | c.b);
    const bgC = coords[4];
    const background = { r: bgC.r, g: bgC.g, b: bgC.b };
    const iconC = coords[5];
    const icons = (iconC.r << 16) | (iconC.g << 8) | iconC.b;
    
    const newData = {
        bubbles,
        background,
        icons,
        coords
    };
    
    this.setColorData(playlistId, newData);
    
    const playlist = this.playlists.find(p => p.id === playlistId);
    if (playlist) {
        playlist.colorData = newData;
        LocalStorage.saveAllPlaylists(this.playlists.filter(p => !p.isLoading));
    }
  }

  getIconColor(playlistId) {
      const data = this.colorDataMap[playlistId];
      if (data?.icons) return data.icons;
      if (data?.coords && data.coords.length > 5) {
          const c = data.coords[5];
          return (c.r << 16) | (c.g << 8) | c.b;
      }
      return 0xffffff;
  }

  forceRefreshColors() {
    if (this.playlists.length === 0) {
      this.applyAddButtonColors();
      return;
    }

    const currentIdx = this.centerIndex;
    const currentPlaylist = this.playlists[currentIdx];
    
    if (this.isAddButtonSelected()) {
        const grayData = ColorExtractor.getAddButtonColors();
        this.applyColorData(grayData);
    } else if (currentPlaylist?.isLoading) {
        const grayData = ColorExtractor.getAddButtonColors();
        this.applyColorData(grayData);
    } else if (currentPlaylist?.id) {
        this.applyColorsForPlaylist(currentPlaylist.id);
    }
  }

  async refreshColorsForPlaylist(playlistId) {
    const scene = this.scene || (window.game && window.game.scene.getScene('MainScene'));
    if (!scene || !scene.textures) return;
    
    const textureKey = `preview_${playlistId}`;
    if (scene.textures.exists(textureKey)) {
      try {
        const texture = scene.textures.get(textureKey);
        const image = texture.getSourceImage();
        const data = await ColorExtractor.extractFromImage(image);
        
        if (data) {
          this.setColorData(playlistId, data);
          return true;
        }
      } catch (e) {
      }
    }
    return false;
  }

  async init(defaultIds) {
    const savedPlaylists = await LocalStorage.getAllPlaylists();
    
    if (savedPlaylists && savedPlaylists.length > 0) {
        this.playlists = savedPlaylists.map(p => ({
            id: p.id,
            title: p.title,
            available: true, 
            isLocal: p.isLocal,
            isLoading: false,
            coverUrl: p.coverUrl,
            trackPaths: p.trackPaths,
            colorData: p.colorData
        }));
        
        this.playlists.forEach(p => {
            if (p.colorData) {
                this.setColorData(p.id, p.colorData);
            }
        });
        
    } else {
        this.playlists = defaultIds.map(id => ({
          id,
          title: this.getDisplayTitle(id),
          available: this.isAvailable(id),
          isLocal: false,
          isLoading: false
        }));
    }
    
    if (this.playlists.length > 0) {
      const firstId = this.playlists[0].id;
      this.applyColorsForPlaylist(firstId);
    }
    this.emit('playlistsChanged');
  }

  addLocalPlaylistToState(playlistObj) {
    const existing = this.playlists.find(p => p.id === playlistObj.id);
    const trackPaths = playlistObj.trackPaths || [];

    if (existing) {
      existing.isLocal = true;
      existing.isLoading = false;
      existing.coverUrl = playlistObj.coverUrl;
      existing.title = playlistObj.title;
      existing.trackPaths = trackPaths;
      if (playlistObj.colorData) {
          existing.colorData = playlistObj.colorData;
          this.setColorData(playlistObj.id, playlistObj.colorData);
      }
      return;
    }

    this.playlists.push({
      id: playlistObj.id,
      title: playlistObj.title,
      available: true,
      isLocal: true,
      isLoading: false,
      coverUrl: playlistObj.coverUrl,
      trackPaths: trackPaths,
      colorData: playlistObj.colorData
    });
    
    if (playlistObj.colorData) {
        this.setColorData(playlistObj.id, playlistObj.colorData);
    }

    const newPlaylistIndex = this.playlists.length - 1;
    this.addButtonIndex = -1;
    this.centerIndex = newPlaylistIndex;

    this.emit('playlistAdded', playlistObj);
    this.emit('centerIndexChanged', newPlaylistIndex);
    this.emit('playlistsChanged');
  }
  
  getDisplayTitle(id) { return id.replace(/_/g, ' '); }
  isAvailable(id) { return true; }

  registerBubbleRenderer(renderer) {
    this.bubbleRenderer = renderer;
    this.forceRefreshColors();
    if (this.playlists.length > 0) {
      const currentIdx = this.centerIndex >= 0 ? this.centerIndex : 0;
      const currentPlaylist = this.playlists[currentIdx];
      if (currentPlaylist && !currentPlaylist.isLoading) {
        this.applyColorsForPlaylist(currentPlaylist.id);
      }
    } else {
      this.applyColorsForPlaylist('empty-fallback');
    }
  }

  setPlayState(isPlaying) { this.isPlaying = isPlaying; this.emit('playStateChanged', isPlaying); }
  setSelectionMode(isSelection) { this.selectionMode = isSelection; this.emit('modeChanged', isSelection); }
  isSelectionMode() { return this.selectionMode; }
  setSelectedPlaylist(id) { this.selectedPlaylist = id; this.emit('playlistSelected', id); }
  getSelectedPlaylist() { return this.selectedPlaylist; }
  setAddingPlaylist(isAdding) { this.isAddingPlaylist = isAdding; this.emit('addingModeChanged', isAdding); }
  isAddingPlaylist() { return this.isAddingPlaylist; }
  showNetworkIssue() { if (this.bubbleRenderer) this.bubbleRenderer.transitionToGrayscale(); this.emit('networkIssue', true); }
  hideNetworkIssue() { if (this.bubbleRenderer) this.bubbleRenderer.restoreColors(); this.emit('networkIssue', false); }
}

export const StateManager = new StateManagerClass();