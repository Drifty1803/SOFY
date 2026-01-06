import Phaser from 'phaser';
import { StateManager } from '../data/StateManager.js';

export class PaletteEditor extends Phaser.Events.EventEmitter {
  constructor(scene) {
    super();
    this.scene = scene;

    this.container = scene.add.container(0, 0);
    this.container.setDepth(3000);
    this.container.setVisible(false);

    this.markers = [];
    this.targetCover = null;
    this.isVisible = false;

    this.imageData = null;
    this.textureWidth = 0;
    this.textureHeight = 0;

    this.textureScaleX = 1;
    this.textureScaleY = 1;
  }

  async show(cover) {
    if (!cover || !cover.container || !cover.playlist || !cover.image) {
        return;
    }

    if (this.isVisible) return;
    this.isVisible = true;
    this.targetCover = cover;

    this.container.setAlpha(1);
    this.container.setVisible(true);

    const { x, y } = cover.container;
    const scale = cover.currentScale || 0.7;

    this.container.setPosition(x, y);
    this.container.setScale(scale);

    const key = cover.image.texture.key;
    await this.prepareTexture(key);

    this.textureScaleX = cover.image.scaleX;
    this.textureScaleY = cover.image.scaleY;

    const savedCoords = StateManager.getPixelCoords(cover.playlist.id);
    let coords = [];

    if (savedCoords && savedCoords.length >= 6) {
      coords = savedCoords;
    } else {
      const positions = [
        { x: this.textureWidth * 0.25, y: this.textureHeight * 0.25 },
        { x: this.textureWidth * 0.75, y: this.textureHeight * 0.25 },
        { x: this.textureWidth * 0.5,  y: this.textureHeight * 0.5 },
        { x: this.textureWidth * 0.25, y: this.textureHeight * 0.75 },
        { x: this.textureWidth * 0.75, y: this.textureHeight * 0.75 },
        { x: this.textureWidth * 0.5,  y: this.textureHeight * 0.25 }
      ];

      if (this.imageData) {
        coords = positions.map(pos => {
          const ix = Math.floor(pos.x);
          const iy = Math.floor(pos.y);
          const safeX = Phaser.Math.Clamp(ix, 0, this.textureWidth - 1);
          const safeY = Phaser.Math.Clamp(iy, 0, this.textureHeight - 1);
          const idx = (safeY * this.textureWidth + safeX) * 4;
          return {
            x: pos.x,
            y: pos.y,
            r: this.imageData.data[idx],
            g: this.imageData.data[idx + 1],
            b: this.imageData.data[idx + 2]
          };
        });
      } else {
        const cx = this.textureWidth / 2;
        const cy = this.textureHeight / 2;
        coords = Array(6).fill({ x: cx, y: cy, r: 128, g: 128, b: 128 });
      }
    }

    this.createMarkers(coords);
  }

  prepareTexture(key) {
    if (!this.scene.textures.exists(key)) return Promise.resolve();

    const texture = this.scene.textures.get(key);
    const source = texture.getSourceImage();
    this.textureWidth = source.width || source.videoWidth || 256;
    this.textureHeight = source.height || source.videoHeight || 256;

    const canvas = document.createElement('canvas');
    canvas.width = this.textureWidth;
    canvas.height = this.textureHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, this.textureWidth, this.textureHeight);
    this.imageData = ctx.getImageData(0, 0, this.textureWidth, this.textureHeight);

    return Promise.resolve();
  }

  createMarkers(coords) {
    this.clearMarkers();

    coords.forEach((pos, index) => {
      let label = '';
      if (index === 4) label = 'B'; 
      if (index === 5) label = 'I';

      this.createMarker(index, pos.x, pos.y, label, pos.r, pos.g, pos.b);
    });
  }

  createMarker(index, texX, texY, labelText, initialR = 128, initialG = 128, initialB = 128) {
    const posX = (texX - this.textureWidth / 2) * this.textureScaleX;
    const posY = (texY - this.textureHeight / 2) * this.textureScaleY;

    const marker = this.scene.add.container(posX, posY);

    const outerCircle = this.scene.add.circle(0, 0, 72, 0xffffff);
    const innerCircle = this.scene.add.circle(0, 0, 60, (initialR << 16) | (initialG << 8) | initialB);

    let textObj = null;
    if (labelText) {
      textObj = this.scene.add.text(0, 0, labelText, {
        fontFamily: 'CustomFont',
        fontSize: '48px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6
      }).setOrigin(0.5);
    }

    marker.add([outerCircle, innerCircle, textObj].filter(Boolean));

    marker.setData('index', index);
    marker.setData('inner', innerCircle);

    marker.setSize(160, 160);
    marker.setInteractive({ draggable: true, useHandCursor: true });

    marker.on('drag', (pointer, dragX, dragY) => {
      this.onDrag(marker, dragX, dragY);
    });

    marker.on('dragend', () => {
      this.saveChanges();
      StateManager.forceRefreshColors();
    });

    this.container.add(marker);
    this.markers.push(marker);
    this.updateMarkerColor(marker, texX, texY);

    marker.setScale(0);
    marker.setAlpha(0);

    this.scene.tweens.add({
      targets: marker,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 400,
      delay: index * 30,
      ease: 'Back.easeOut'
    });
  }

  hide() {
    if (!this.isVisible) return;
    this.isVisible = false;

    if (this.markers.length > 0) {
      this.scene.tweens.add({
        targets: this.markers,
        scaleX: 0,
        scaleY: 0,
        alpha: 0,
        duration: 250,
        ease: 'Back.easeIn',
        onComplete: () => {
          this.container.setVisible(false);
          this.clearMarkers();
          this.imageData = null;
        }
      });
    } else {
      this.container.setVisible(false);
      this.clearMarkers();
      this.imageData = null;
    }
  }

  onDrag(marker, x, y) {
    const halfW = (this.textureWidth * this.textureScaleX) / 2;
    const halfH = (this.textureHeight * this.textureScaleY) / 2;

    const clampedX = Phaser.Math.Clamp(x, -halfW, halfW);
    const clampedY = Phaser.Math.Clamp(y, -halfH, halfH);

    marker.setPosition(clampedX, clampedY);

    const texX = (clampedX / this.textureScaleX) + this.textureWidth / 2;
    const texY = (clampedY / this.textureScaleY) + this.textureHeight / 2;

    this.updateMarkerColor(marker, texX, texY);
  }

  updateMarkerColor(marker, texX, texY) {
    if (!this.imageData) return;

    const ix = Math.floor(texX);
    const iy = Math.floor(texY);
    const safeX = Phaser.Math.Clamp(ix, 0, this.textureWidth - 1);
    const safeY = Phaser.Math.Clamp(iy, 0, this.textureHeight - 1);

    const idx = (safeY * this.textureWidth + safeX) * 4;
    const r = this.imageData.data[idx];
    const g = this.imageData.data[idx + 1];
    const b = this.imageData.data[idx + 2];

    const colorInt = (r << 16) | (g << 8) | b;
    const index = marker.getData('index');

    marker.getData('inner').setFillStyle(colorInt);

    StateManager.updateLiveColor(index, colorInt, { r, g, b });
  }

  saveChanges() {
    if (!this.targetCover || !this.targetCover.playlist || !this.targetCover.playlist.id) {
        return;
    }
    if (!this.targetCover) return;

    const coords = this.markers.map(m => {
      const texX = (m.x / this.textureScaleX) + this.textureWidth / 2;
      const texY = (m.y / this.textureScaleY) + this.textureHeight / 2;

      const colorInt = m.getData('inner').fillColor;
      const r = (colorInt >> 16) & 0xFF;
      const g = (colorInt >> 8) & 0xFF;
      const b = colorInt & 0xFF;

      return { x: texX, y: texY, r, g, b };
    });

    StateManager.savePalette(this.targetCover.playlist.id, coords);
    StateManager.forceRefreshColors(); 
  }

  clearMarkers() {
    this.markers.forEach(m => m.destroy());
    this.markers = [];
  }

  destroy() {
    this.container.destroy();
  }
}