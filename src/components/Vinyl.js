import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { StateManager } from '../data/StateManager.js';

export class Vinyl {
  constructor(scene) {
    this.scene = scene;
    
    this.isPlaying = false;
    this.isVisible = false;
    this.isLowered = false;
    
    this.baseY = 0;
    this.vinylSize = 0; 
    
    this.currentAngle = 0;
    this.angularVelocity = 0;
    this.targetVelocity = 0;
    this.maxVelocity = 100; 
    this.lastUpdateTime = 0;
    
    this.container = null;
    this.disc = null;
    this.label = null;

    this.createVisuals();
  }

  createVisuals() {
    const { width, height } = this.scene.scale;
    this.baseY = height / 2;

    const coverSize = CONFIG.getCoverSize() * 0.6; 
    this.vinylSize = coverSize;
    
    this.dropOffset = this.vinylSize * 0.25;

    this.container = this.scene.add.container(width / 2, this.baseY);
    this.container.setDepth(-10);
    this.container.setAlpha(0);
    this.container.setVisible(false);

    this.label = this.scene.add.image(0, 0, '__MISSING'); 
    this.container.add(this.label);

    this.disc = this.scene.add.image(0, 0, 'vinyl');
    const originalDiscSize = Math.max(this.disc.width, this.disc.height);
    const discScale = this.vinylSize / originalDiscSize;
    
    this.disc.setScale(discScale);
    this.disc.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.container.add(this.disc);

    this.updateLabel();

    this.lastUpdateTime = performance.now();
  }

  async updateLabel(trackCoverBase64 = null) {
    const playlistId = StateManager.getSelectedPlaylist();
    if (!playlistId && !trackCoverBase64) return;

    let sourceKey = null;
    let tempKey = null;

    if (trackCoverBase64) {
      tempKey = `track_label_${Date.now()}`;
      await this._createTextureFromBase64(tempKey, trackCoverBase64);
      sourceKey = tempKey;
    } else if (playlistId) {
      sourceKey = `preview_${playlistId}`;
      if (!this.scene.textures.exists(sourceKey)) {
        sourceKey = null;
      }
    }

    const labelTextureKey = `vinyl_label_${Date.now()}`;
    this._generateDonutTexture(labelTextureKey, sourceKey);

    this.label.setTexture(labelTextureKey);

    if (tempKey) {
        this.scene.time.delayedCall(1000, () => {
             if (this.scene.textures.exists(tempKey)) this.scene.textures.remove(tempKey);
        });
    }
    this._cleanupOldLabels(labelTextureKey);
  }

  _cleanupOldLabels(currentKey) {
      const textures = this.scene.textures.list;
      Object.keys(textures).forEach(key => {
          if (key.startsWith('vinyl_label_') && key !== currentKey) {
              this.scene.textures.remove(key);
          }
      });
  }

  async _createTextureFromBase64(key, base64) {
      return new Promise(resolve => {
          const img = new Image();
          img.onload = () => {
              if (this.scene.textures.exists(key)) {
                  this.scene.textures.remove(key);
              }
              this.scene.textures.addImage(key, img);
              resolve();
          };
          
          img.onerror = () => {
              resolve();
          };

          if (base64 && !base64.startsWith('data:image')) {
              img.src = `data:image/jpeg;base64,${base64}`;
          } else {
              img.src = base64;
          }
      });
  }

  _generateDonutTexture(targetKey, sourceKey) {

    const vinylRadius = this.vinylSize / 2;
    const labelRadius = vinylRadius / 2.4;
    const labelDiameter = labelRadius * 2;

    const holeRadius = vinylRadius / 33;

    const canvasTexture = this.scene.textures.createCanvas(targetKey, labelDiameter, labelDiameter);
    const ctx = canvasTexture.getContext();
    const centerX = labelDiameter / 2;
    const centerY = labelDiameter / 2;

    ctx.beginPath();
    ctx.arc(centerX, centerY, labelRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip(); 

    if (sourceKey && this.scene.textures.exists(sourceKey)) {
        const source = this.scene.textures.get(sourceKey).getSourceImage();

        const sWidth = source.width;
        const sHeight = source.height;
        const scale = Math.max(labelDiameter / sWidth, labelDiameter / sHeight);
        const dWidth = sWidth * scale;
        const dHeight = sHeight * scale;
        const dx = (labelDiameter - dWidth) / 2;
        const dy = (labelDiameter - dHeight) / 2;

        ctx.drawImage(source, dx, dy, dWidth, dHeight);
    } else {
        ctx.fillStyle = '#333333';
        ctx.fillRect(0, 0, labelDiameter, labelDiameter);
    }

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(centerX, centerY, holeRadius, 0, Math.PI * 2, false);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';

    canvasTexture.refresh();
  }

  setPlaying(isPlaying) {
    this.isPlaying = isPlaying;
    
    if (isPlaying) {
      this.lower();
      this.targetVelocity = this.maxVelocity;
    } else {
      this.raise();
      this.targetVelocity = 0;
    }
  }

  raise() {
    if (!this.isLowered) return;
    this.isLowered = false;
    
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.add({
      targets: this.container,
      y: this.baseY,
      duration: 500,
      ease: 'Quad.easeInOut'
    });
  }

  lower() {
    if (this.isLowered) return;
    this.isLowered = true;
    
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.add({
      targets: this.container,
      y: this.baseY + this.dropOffset,
      duration: 500,
      ease: 'Quad.easeInOut'
    });
  }

  setVisible(visible) {
    if (this.isVisible === visible) return;
    this.isVisible = visible;
    
    this.scene.tweens.killTweensOf(this.container);
    
    if (visible) {
      this.updateLabel(); 
      
      this.isLowered = false;
      this.container.y = this.baseY;
      this.container.setVisible(true);
      this.container.setAlpha(0);
      
      this.scene.tweens.add({
        targets: this.container,
        alpha: 1,
        duration: 300,
        ease: 'Quad.easeOut'
      });
    } else {
      this.targetVelocity = 0;
      this.angularVelocity = 0;
      
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: 300,
        ease: 'Quad.easeIn',
        onComplete: () => {
            this.container.setVisible(false);
        }
      });
    }
  }

  update() {
    const now = performance.now();
    const deltaMs = now - this.lastUpdateTime;
    this.lastUpdateTime = now;
    const deltaSeconds = Math.min(deltaMs, 100) / 1000;

    const accelerationRate = 150;
    if (this.angularVelocity < this.targetVelocity) {
      this.angularVelocity = Math.min(this.angularVelocity + accelerationRate * deltaSeconds, this.targetVelocity);
    } else if (this.angularVelocity > this.targetVelocity) {
      this.angularVelocity = Math.max(this.angularVelocity - accelerationRate * deltaSeconds, this.targetVelocity);
    }

    if (this.angularVelocity > 0.1) {
      this.currentAngle += this.angularVelocity * deltaSeconds;
      if (this.currentAngle >= 360) this.currentAngle -= 360;
      this.container.setAngle(this.currentAngle);
    }
  }

  onResize(width, height) {
    this.baseY = height / 2;
    this.container.x = width / 2;
    this.container.y = this.isLowered ? this.baseY + this.dropOffset : this.baseY;
  }

  destroy() {
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy();
  }
}