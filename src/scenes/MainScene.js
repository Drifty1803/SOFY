import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { Carousel } from '../components/Carousel.js';
import { Vinyl } from '../components/Vinyl.js';
import { EditButtons } from '../components/EditButtons.js';
import { GestureManager } from '../input/GestureManager.js';
import { AudioEngine } from '../audio/AudioEngine.js';
import { StateManager } from '../data/StateManager.js';
import { PlaylistManager } from '../data/PlaylistManager.js';
import { Capacitor } from '@capacitor/core';
import { ColorExtractor } from '../utils/ColorExtractor.js';
import { PaletteEditor } from '../components/PaletteEditor.js';

export class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });

    this.carousel = null;
    this.vinyl = null;
    this.gestureManager = null;
    this.audioEngine = null;
    this.messageText = null;
    this.editButtons = null; 
    this.isUpdating = false;
    this.isAddMenuOpen = false;
    this.paletteEditor = null;
    this.eventHandlers = {};
  }

  create() {
    this.vinyl = new Vinyl(this);
    this.carousel = new Carousel(this);
    this.audioEngine = new AudioEngine();

    this.editButtons = new EditButtons(this);

    this.editButtons.on('action', (action) => {
      this.handleEditAction(action);
    });

    if (this.editButtons.setActionCallback) {
        this.editButtons.setActionCallback((sector) => {
            this.handleEditAction(sector);
        });
    }

    this.paletteEditor = new PaletteEditor(this);

    this.messageText = this.add.text(
      this.scale.width / 2,
      this.scale.height - 100,
      '',
      {
        fontSize: '18px',
        fontFamily: 'Arial',
        color: '#ffffff',
        align: 'center',
        backgroundColor: '#333333',
        padding: { x: 20, y: 10 }
      }
    );
    this.messageText.setOrigin(0.5);
    this.messageText.setDepth(1000);
    this.messageText.setAlpha(0);

    this.gestureManager = new GestureManager(this);
    this.gestureManager.on('tap', this.onTap, this);
    this.gestureManager.on('swipeUp', this.onSwipeUp, this);
    this.gestureManager.on('swipeDown', this.onSwipeDown, this);
    this.gestureManager.on('longPress', this.onLongPress, this);

    this.eventHandlers.onPlayStateChanged = (isPlaying) => {
      if (this.vinyl) this.vinyl.setPlaying(isPlaying);
      const coverSize = CONFIG.getCoverSize() * 0.6;
      const offset = isPlaying ? -(coverSize * 0.25) : 0;
      if (this.carousel) this.carousel.setPlayModeOffset(offset, true);
    };

    this.eventHandlers.onModeChanged = (isSelectionMode) => {
      if (this.carousel) this.carousel.setSelectionMode(isSelectionMode);
      if (this.vinyl) this.vinyl.setVisible(!isSelectionMode);
    };

    this.eventHandlers.onPlaylistAdded = (pl) => {
      this.loadLocalCoverAndRefresh(pl);
    };

    StateManager.on('playStateChanged', this.eventHandlers.onPlayStateChanged);
    StateManager.on('modeChanged', this.eventHandlers.onModeChanged);
    StateManager.on('playlistAdded', this.eventHandlers.onPlaylistAdded);

    StateManager.on('trackMetadataLoaded', (data) => {
        if (this.vinyl) {
            this.vinyl.updateLabel(data.cover);
        }
    });

    StateManager.on('playlistReadyForTexture', async (data) => {
      await this.loadTextureAndFinalize(data);
    });

    this.events.once('shutdown', this.shutdown, this);

    StateManager.setSelectionMode(true);
    this.carousel.fadeIn();
    this.vinyl.setVisible(false);

    this.scale.on('resize', this.onResize, this);

    this.time.delayedCall(50, () => {
      StateManager.forceRefreshColors();
    });
  }

  async loadTextureAndFinalize(data) {
    const { id, title, coverUrl, trackPaths, coverBase64 } = data;
    const key = `preview_${id}`;
    
    try {
      await new Promise((resolve) => {
        const img = new Image();
        img.onload = async () => {
          if (!this.textures.exists(key)) {
            this.textures.addImage(key, img);
          }
          const existingPlaylist = StateManager.getPlaylists().find(p => p.id === id);
          if (existingPlaylist && existingPlaylist.colorData) {
              StateManager.setColorData(id, existingPlaylist.colorData);
          } else {
              try {
                const colorData = await ColorExtractor.extractFromImage(img);
                if (colorData) {
                  StateManager.setColorData(id, colorData);
                  await PlaylistManager.updatePlaylist(id, { colorData });
                } else {
                  const generated = ColorExtractor.generateFallback(pl.title || pl.id);
                  const fallbackData = {
                    bg: '#222222',
                    text: '#ffffff',
                    palette: generated.bubbles.map(c => '#' + c.toString(16).padStart(6, '0')),
                    colors: generated.bubbles,
                    rawSorted: generated.bubbles.map(c => '#' + c.toString(16).padStart(6, '0')),
                    bubbles: generated.bubbles,
                    background: { r: (generated.background >> 16) & 0xFF, g: (generated.background >> 8) & 0xFF, b: generated.background & 0xFF },
                    icons: generated.icons
                  };
                  StateManager.setColorData(id, fallbackData);
                  await PlaylistManager.updatePlaylist(id, { colorData: fallbackData });
                }
              } catch (e) {}
          }
          
          this.time.delayedCall(100, () => {
            StateManager.finishLoadingPlaylist(id, {
              title,
              coverUrl,
              trackPaths
            });
          });
          
          resolve();
        };
        
        img.onerror = () => {
          StateManager.finishLoadingPlaylist(id, { title, coverUrl, trackPaths });
          resolve();
        };
        img.src = `data:image/png;base64,${coverBase64}`;
      });
      
    } catch (e) {
      StateManager.finishLoadingPlaylist(id, { title, coverUrl, trackPaths });
    }
  }

  handleEditAction(sector) {
      const centerIndex = StateManager.getCenterIndex();
      const playlists = StateManager.getPlaylists();
      if (centerIndex < 0 || centerIndex >= playlists.length) return;
      
      const currentPlaylist = playlists[centerIndex];

      if (sector === 'TOP') {
          StateManager.reorderPlaylist(-1);
      } else if (sector === 'BOTTOM') {
          StateManager.reorderPlaylist(1);
      } else if (sector === 'LEFT') {
          this.editButtons.hide();
          StateManager.deletePlaylist(currentPlaylist.id);
          
      } else if (sector === 'RIGHT') {

          this.editButtons.hide();
          this.isPaletteMode = true; 
          
          const centerIndex = StateManager.getCenterIndex();
          const coverItem = this.carousel.items.find(item => item.index === centerIndex);
          if (coverItem && coverItem.cover && coverItem.cover.playlist) {
            this.paletteEditor.show(coverItem.cover);
          } else {
          }
      }
  }

  showMessage(text, duration = 3000) {
    this.messageText.setText(text);
    this.messageText.setPosition(this.scale.width / 2, this.scale.height - 100);
    
    this.tweens.killTweensOf(this.messageText);
    
    this.tweens.add({
      targets: this.messageText,
      alpha: 1,
      duration: 200,
      onComplete: () => {
        this.time.delayedCall(duration, () => {
          this.tweens.add({
            targets: this.messageText,
            alpha: 0,
            duration: 300
          });
        });
      }
    });
  }

  update(time, delta) {
    if (this.vinyl) {
      this.vinyl.update();
    }
  }

  onTap(pointer) {
    if (this.isUpdating) return;

    if (this.isPaletteMode) {
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;
        const size = CONFIG.getCoverSize() * 0.7;
        const half = size / 2;
        if (pointer.x < centerX - half || pointer.x > centerX + half ||
            pointer.y < centerY - half || pointer.y > centerY + half) {
            this.closePaletteMode();
        }
        return;
    }

    if (this.editButtons.visible) {
        const coverInfo = this.carousel.getCoverAtPosition(pointer.x, pointer.y);
        
        if (coverInfo && coverInfo.index === StateManager.getCenterIndex()) {
            this.editButtons.handlePress(pointer.x, pointer.y);
        } else {
            this.editButtons.hide();
        }
        return; 
    }

    if (this.isAddMenuOpen) {
      const coverInfo = this.carousel.getCoverAtPosition(pointer.x, pointer.y);
      if (!coverInfo || !coverInfo.isAddButton) {
        this.closeAddMenu();
      }
      return;
    }

    const coverInfo = this.carousel.getCoverAtPosition(pointer.x, pointer.y);
    
     if (coverInfo) {
      if (coverInfo.isAddButton) {
        if (coverInfo.index === StateManager.getCenterIndex()) {
            
            const playlists = StateManager.getPlaylists();

            if (playlists.length === 0) {
                const isTutorialFinished = this.carousel.addPlaylistCover.handleInteraction();
                
                if (isTutorialFinished) {
                    this.onPickFolder();
                }
            } else {
                this.onPickFolder();
            }
            
        }
        return;
      }

      if (coverInfo.index === StateManager.getCenterIndex()) {
        if (StateManager.isSelectionMode()) {
          this.selectPlaylist(coverInfo.playlistId);
        } else {
          this.returnToSelection();
        }
      }
    }
  }

  closePaletteMode() {
      if (this.paletteEditor) {
          this.paletteEditor.saveChanges();
          this.paletteEditor.hide();
      }
      this.isPaletteMode = false;
  }

  handleSearchButton() {
    this.openAddMenu();
    this.time.delayedCall(100, () => {
      this.onPickFolder();
    });
  }

  async onPickFolder() {
    try {
        const pickResult = await Capacitor.Plugins.FolderPicker.pickFolder();
        
        if (!pickResult || !pickResult.folderName) {
          return;
        }
        
        const folderName = pickResult.folderName;

        if (pickResult.pending) {
          const playlistId = `local_${Date.now()}`;
          StateManager.addLoadingPlaylist(playlistId, folderName);

          const scanProgressListener = await Capacitor.Plugins.FolderPicker.addListener(
            'scanProgress', 
            (data) => {
              StateManager.emit('scanProgress', {
                folderName: data.folderName,
                total: data.total,
                current: data.current,
                percent: data.percent
              });
            }
          );

          try {
            const scanResult = await Capacitor.Plugins.FolderPicker.scanPendingFolder();
            
            if (scanProgressListener && scanProgressListener.remove) {
              scanProgressListener.remove();
            }
            
            if (scanResult && scanResult.files && scanResult.files.length > 0) {
              PlaylistManager.processScannedFolder(playlistId, folderName, scanResult.files)
                .then(title => {
                  this.showMessage(`Added: ${title}`);
                })
                .catch(error => {
                  this.showMessage(error.message || 'Error importing folder');
                });
            } else {
              StateManager.cancelLoadingPlaylist(playlistId);
              this.showMessage('No files found');
            }
          } catch (scanError) {
            if (scanProgressListener && scanProgressListener.remove) {
              scanProgressListener.remove();
            }
            StateManager.cancelLoadingPlaylist(playlistId);
            this.showMessage('Error scanning folder');
          }
          
        } else if (pickResult.files && pickResult.files.length > 0) {
          PlaylistManager.processNativeFolder(folderName, pickResult.files)
            .then(title => {
              this.showMessage(`Added: ${title}`);
            })
            .catch(error => {
              this.showMessage(error.message || 'Error importing folder');
            });
        } else {
          this.showMessage('No files found');
        }
        
    } catch (error) {
        if (!error.message?.includes('canceled') && !error.message?.includes('Canceled')) {
          this.showMessage('Error importing folder');
        }
    }
  }

  async loadLocalCoverAndRefresh(pl) {
    const key = `preview_${pl.id}`;
    if (this.textures.exists(key)) {
      StateManager.emit('playlistsChanged'); 
      return;
    }

    
    const existingTexture = this.textures.exists(key);
    
    if (existingTexture) {
      this.scene.restart(); 
      return;
    }
    
    try {
      const base64Data = await PlaylistManager.getCoverBase64(pl.id);
      
      if (base64Data) {
        await new Promise((resolve) => {
          const img = new Image();
          img.onload = async () => {
            this.textures.addImage(key, img);

            if (pl.colorData) {
                StateManager.setColorData(pl.id, pl.colorData);
            } else {
                try {
                  const data = await ColorExtractor.extractFromImage(img);
                  if (data) {
                    StateManager.setColorData(pl.id, data);
                    await PlaylistManager.updatePlaylist(pl.id, { colorData: data });
                  }
                } catch(e) {
                }
            }
            
            resolve();
          };
          
          img.onerror = (e) => {
            resolve(); 
          };
          
          img.src = `data:image/png;base64,${base64Data}`;
        });
        
        StateManager.emit('playlistsChanged');
        this.scene.restart();
        
      } else {
        await this.createPlaceholderCover(key, pl.title);
        this.scene.restart();
      }
      
    } catch (e) {
      await this.createPlaceholderCover(key, pl.title);
      this.scene.restart();
    }
  }


  async createPlaceholderCover(key, title) {

    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const size = 256;
    
    canvas.width = size;
    canvas.height = size;

    ctx.fillStyle = '#444444';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, size - 8, size - 8);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const words = title.split(' ');
    let lines = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > size * 0.8) {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    if (lines.length > 3) {
      lines = lines.slice(0, 2);
      lines.push('...');
    }

    const lineHeight = 32;
    const startY = size / 2 - (lines.length * lineHeight) / 2;
    
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], size / 2, startY + i * lineHeight);
    }

    this.textures.addCanvas(key, canvas);

  }


  openAddMenu() {
    if (this.isAddMenuOpen) return;
    this.isAddMenuOpen = true;
    this.carousel.addPlaylistCover.animateSplit();
  }

  closeAddMenu() {
    if (!this.isAddMenuOpen) return;
    this.isAddMenuOpen = false;
    this.carousel.addPlaylistCover.animateUnsplit();
  }

  onSwipeUp(pointer) {
    if (this.isUpdating || this.isAddMenuOpen) return;

    if (this.isPaletteMode) return; 

    if (StateManager.isSelectionMode()) {
      this.carousel.scrollNext();
    } else {
      if (this.audioEngine) this.audioEngine.pause();
    }
  }

  onSwipeDown(pointer) {
    if (this.isUpdating || this.isAddMenuOpen) return;

    if (this.isPaletteMode) return; 

    if (StateManager.isSelectionMode()) {
      this.carousel.scrollPrev();
    } else {
      if (this.audioEngine) this.audioEngine.play();
    }
  }

  async onLongPress(pointer) {
    if (!StateManager.isSelectionMode()) return;
    if (this.isPaletteMode) return;

    if (this.carousel.isAnimating) return;

    const info = this.carousel.getCoverAtPosition(pointer.x, pointer.y);
    
    if (info && !info.isAddButton && info.index === StateManager.getCenterIndex()) {
        const playlist = StateManager.getPlaylists().find(p => p.id === info.playlistId);

        if (playlist && playlist.isLoading) {
             return;
        }
        this.editButtons.show(info.cover);
        if (navigator.vibrate) navigator.vibrate(50);
    }
  }

  async selectPlaylist(playlistId) {

    if (this.stopTimer) {
        this.stopTimer.remove();
        this.stopTimer = null;
    }
    
    StateManager.setSelectionMode(false);
    StateManager.setSelectedPlaylist(playlistId);
    
    const success = await this.audioEngine.loadPlaylist(playlistId);
    
    if (!success) {
      this.showMessage('This playlist has no tracks');
      this.returnToSelection();
    }
  }

   returnToSelection() {
    if (this.audioEngine) {
      this.audioEngine.pause();
      if (this.stopTimer) this.stopTimer.remove();
      this.stopTimer = this.time.delayedCall(400, () => {
        if (this.audioEngine) {
            this.audioEngine.stop();
        }
        this.stopTimer = null;
      });
    }

    this.carousel.setPlayModeOffset(0, true);
    
    StateManager.setSelectionMode(true);
    StateManager.setSelectedPlaylist(null);
  }

  onResize(gameSize) {
    const { width, height } = gameSize;
    
    if (this.carousel) this.carousel.onResize(width, height);
    if (this.vinyl) this.vinyl.onResize(width, height);
    if (this.messageText) this.messageText.setPosition(width / 2, height - 100);
    if (this.loader) this.loader.setPosition(width / 2, height / 2);
  }

  shutdown() {

    StateManager.off('playStateChanged', this.eventHandlers.onPlayStateChanged);
    StateManager.off('modeChanged', this.eventHandlers.onModeChanged);
    StateManager.off('playlistAdded', this.eventHandlers.onPlaylistAdded);
    StateManager.off('trackMetadataLoaded');
    StateManager.off('playlistReadyForTexture');

    if (this.carousel) this.carousel.destroy();
    if (this.gestureManager) this.gestureManager.destroy();
    if (this.audioEngine) this.audioEngine.destroy();
    if (this.editButtons) this.editButtons.destroy();
    if (this.vinyl) this.vinyl.destroy();
    

    this.scale.off('resize', this.onResize, this);
    
  }
}