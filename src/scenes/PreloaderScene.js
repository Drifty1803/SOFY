import Phaser from 'phaser';
import { StateManager } from '../data/StateManager.js';
import { ColorExtractor } from '../utils/ColorExtractor.js';
import { PlaylistManager } from '../data/PlaylistManager.js';

export class PreloaderScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloaderScene' });
  }

  preload() {
    this.load.image('vinyl', 'assets/vinyl.png');
    this.load.svg('icon_up', 'assets/icons/up.svg');
    this.load.svg('icon_down', 'assets/icons/down.svg');
    this.load.svg('icon_delete', 'assets/icons/delete.svg');
    this.load.svg('icon_palette', 'assets/icons/palette.svg');
  }

  async create() {

    this.add.text(0, 0, 'LoadFont', { fontFamily: 'AppFont' }).setVisible(false);

    try {
      await PlaylistManager.loadSavedPlaylists();

      const allPlaylists = StateManager.getPlaylists();
      const localPlaylists = StateManager.getPlaylists().filter(p => p.isLocal);
      await this.loadPlaylistCovers(localPlaylists);

      await this.extractAllColors(localPlaylists);

      this.scene.start('BackgroundScene');
      this.scene.start('MainScene');

    } catch (e) {
      this.scene.start('BackgroundScene');
      this.scene.start('MainScene');
    }
    StateManager.forceRefreshColors();

    this.time.delayedCall(1000, () => {
      if (this.scene.isActive()) {
        this.scene.stop();
      }
    });
  }

  async loadPlaylistCovers(localPlaylists) {
    await Promise.all(
      localPlaylists.map(async pl => {
        const key = `preview_${pl.id}`;

        if (this.textures.exists(key)) return; 

        const base64Data = await PlaylistManager.getCoverBase64(pl.id);
        if (!base64Data) {
          await this.createPlaceholderCover(key, pl.title);
          return;
        }

        const dataUrl = `data:image/png;base64,${base64Data}`;
        await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            this.textures.addImage(key, img);
            resolve();
          };
          img.onerror = () => reject(new Error('load image failed'));
          img.src = dataUrl;
        });
      })
    );
  }

  async createPlaceholderCover(key, title) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const size = 256;

    canvas.width = size;
    canvas.height = size;

    ctx.fillStyle = '#333333';
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

  async extractAllColors(allPlaylists) {
    for (const pl of allPlaylists) {
      await this.extractAndStoreColors(pl);
      StateManager.forceRefreshColors();
    }
  }

  async extractAndStoreColors(pl) {
    const playlistId = pl.id;

    const existingData = StateManager.colorDataMap[playlistId];
    if (existingData && existingData.bubbles && existingData.bubbles.length > 0) {
      return;
    }

    const textureKey = `preview_${playlistId}`;
    let data = null;

    if (this.textures.exists(textureKey)) {
      try {
        const texture = this.textures.get(textureKey);
        const source = texture.getSourceImage();

        data = await ColorExtractor.extractFromImage(source);
      } catch (e) {}
    }

    if (!data) {
      const seed = pl.title || playlistId;
      const generated = ColorExtractor.generateFallback(seed);

      data = {
        bg: '#222222',
        text: '#ffffff',
        palette: generated.bubbles.map(c => '#' + c.toString(16).padStart(6, '0')),
        colors: generated.bubbles,
        rawSorted: generated.bubbles.map(c => '#' + c.toString(16).padStart(6, '0')),
        bubbles: generated.bubbles,
        background: generated.background,
        icons: generated.icons
      };

    }
    StateManager.setColorData(playlistId, data);
  }
}