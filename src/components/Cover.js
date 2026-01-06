import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { StateManager } from '../data/StateManager.js';
import { ColorExtractor } from '../utils/ColorExtractor.js';

export class Cover {
  constructor(scene, playlist, index) {
    this.scene = scene;
    this.playlist = playlist;
    this.index = index;
    
    this.container = scene.add.container(0, 0);
    this.currentScale = 0;
    this.targetScale = 0;
    this.playOffset = 0;
    
    this.isLoading = playlist.isLoading || false;
    this.loadingProgress = 0;
    this.loadingStage = 'init';

    this.scanCircleTexture = null;
    this.scanCircleKey = null;
    this.scanCircle = null;
    this.scanCenter = null;
    this.maxScanRadius = 0;
    this.currentScanRadius = 0;
    this.scanTween = null;
    
    this.grayCanvasTexture = null;
    this.grayTextureKey = null;
    this.grayOverlay = null;
    this.maskCenter = null;
    this.maxMaskRadius = 0;
    this.currentMaskRadius = 0;
    this.maskTween = null;
 
    this.blurredImage = null;
    this.overlaySize = 0;
    
    this.createVisuals();
    
    if (this.isLoading) {
      this.setupLoadingListeners();
    }
  }

  createVisuals() {
    const coverSize = CONFIG.getCoverSize();
    
    if (this.isLoading) {
      this.createLoadingVisuals(coverSize);
    } else {
      this.createNormalVisuals(coverSize);
    }
    
    this.container.setSize(coverSize, coverSize);
    this.container.setAlpha(0);
    this.container.setScale(0);
  }
  
  createLoadingVisuals(coverSize) {
    this.overlaySize = coverSize;

    const margin = coverSize * 0.15;
    this.scanCenter = {
      x: Phaser.Math.Between(-coverSize/2 + margin, coverSize/2 - margin),
      y: Phaser.Math.Between(-coverSize/2 + margin, coverSize/2 - margin)
    };
    
    const half = this.overlaySize / 2;
    const corners = [
      { x: -half, y: -half },
      { x: half, y: -half },
      { x: -half, y: half },
      { x: half, y: half }
    ];
    
    this.maxScanRadius = 0;
    corners.forEach(corner => {
      const dist = Phaser.Math.Distance.Between(
        this.scanCenter.x, this.scanCenter.y,
        corner.x, corner.y
      );
      if (dist > this.maxScanRadius) {
        this.maxScanRadius = dist;
      }
    });
    
    this.scanCircleKey = `scan_circle_${this.playlist.id}_${Date.now()}`;
    this.scanCircleTexture = this.scene.textures.createCanvas(
      this.scanCircleKey,
      this.overlaySize,
      this.overlaySize
    );
    
    this.scanCircle = this.scene.add.image(0, 0, this.scanCircleKey);
    this.scanCircle.setOrigin(0.5);
    this.container.add(this.scanCircle);

    this.maskCenter = {
      x: Phaser.Math.Between(-coverSize/2 + margin, coverSize/2 - margin),
      y: Phaser.Math.Between(-coverSize/2 + margin, coverSize/2 - margin)
    };
    
    this.maxMaskRadius = 0;
    corners.forEach(corner => {
      const dist = Phaser.Math.Distance.Between(
        this.maskCenter.x, this.maskCenter.y,
        corner.x, corner.y
      );
      if (dist > this.maxMaskRadius) {
        this.maxMaskRadius = dist;
      }
    });

    this.nativeWidth = coverSize;
    this.nativeHeight = coverSize;
    
    this.currentScanRadius = 0;
    this.drawScanCircle(0);
  }
  
  drawScanCircle(radius) {
    if (!this.scanCircleTexture || !this.scanCenter) return;
    
    const size = this.overlaySize;
    const ctx = this.scanCircleTexture.getContext();
    const canvasX = this.scanCenter.x + size / 2;
    const canvasY = this.scanCenter.y + size / 2;
    
    ctx.clearRect(0, 0, size, size);
    
    if (radius > 0) {
      ctx.fillStyle = '#333333';
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, radius, 0, Math.PI * 2, false);
      ctx.fill();
    }
    
    this.scanCircleTexture.refresh();
  }
  
  drawGrayWithHole(holeRadius) {
    if (!this.grayCanvasTexture || !this.maskCenter) return;
    
    const size = this.overlaySize;
    const ctx = this.grayCanvasTexture.getContext();
    const canvasX = this.maskCenter.x + size / 2;
    const canvasY = this.maskCenter.y + size / 2;
    
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, size, size);
    
    if (holeRadius > 0) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, holeRadius, 0, Math.PI * 2, false);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    
    this.grayCanvasTexture.refresh();
  }
  
  createNormalVisuals(coverSize) {
    const textureKey = `preview_${this.playlist.id}`;

    this.image = this.scene.add.image(0, 0, textureKey);

    if (this.image.texture && this.image.texture.key !== '__MISSING') {
      this.image.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      
      const tex = this.scene.textures.get(textureKey);
      const w = tex.getSourceImage().width;
      const h = tex.getSourceImage().height;
      
      const minDim = Math.min(w, h);
      const offsetX = (w - minDim) / 2;
      const offsetY = (h - minDim) / 2;
      
      this.image.setCrop(offsetX, offsetY, minDim, minDim);
      
      const scale = coverSize / minDim;
      this.image.setScale(scale);
      
      this.nativeWidth = coverSize;
      this.nativeHeight = coverSize;

    } else {
      this.image.setVisible(false);
      const fallback = this.scene.add.rectangle(0, 0, coverSize, coverSize, 0x444444);
      this.container.add(fallback);
      
      this.nativeWidth = coverSize;
      this.nativeHeight = coverSize;
    }
    
    this.image.setOrigin(0.5, 0.5);
    this.container.add(this.image);
  }
  
  setupLoadingListeners() {
    this.onScanProgress = (data) => {
      if (data.folderName === this.playlist.title && (this.loadingStage === 'init' || this.loadingStage === 'scanning')) {
        this.loadingStage = 'scanning';
        this.updateScanProgress(data.percent);
      }
    };
    
    this.onProgressUpdate = (data) => {
      if (data.id === this.playlist.id) {
        this.updateLoadingProgress(data.progress, data.stage);
      }
    };
    
    this.onDurationProgress = (data) => {
      if (data.playlistId === this.playlist.id && this.loadingStage === 'duration') {
        const durationProgress = 30 + (data.percent * 0.4);
        this.updateLoadingProgress(durationProgress, 'duration');
      }
    };
    
    this.onPreviewReady = (data) => {
      if (data.id === this.playlist.id) {
        this.setupBlurredPreview(data.base64);
      }
    };
    
    this.onLoadingComplete = (data) => {
      if (data.id === this.playlist.id) {
        this.transitionToLoaded();
      }
    };
    
    StateManager.on('scanProgress', this.onScanProgress);
    StateManager.on('playlistLoadingProgress', this.onProgressUpdate);
    StateManager.on('durationProgress', this.onDurationProgress);
    StateManager.on('previewReadyForBlur', this.onPreviewReady);
    StateManager.on('playlistLoadingComplete', this.onLoadingComplete);
  }
  
  updateScanProgress(percent) {
    const targetRadius = (percent / 100) * this.maxScanRadius;
    const radiusDiff = Math.abs(targetRadius - this.currentScanRadius);
    const duration = Math.max(800, radiusDiff * 6);
    
    if (this.scanTween && this.scanTween.isPlaying()) {
      this.scanTween.stop();
    }
    
    this.scanTween = this.scene.tweens.add({
      targets: this,
      currentScanRadius: targetRadius,
      duration: duration,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        this.drawScanCircle(this.currentScanRadius);
      }
    });
  }
  
  setupBlurredPreview(base64Data) {
    const coverSize = CONFIG.getCoverSize();
    const textureKey = `preview_blur_${this.playlist.id}`;
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = coverSize;
      canvas.height = coverSize;
      const ctx = canvas.getContext('2d');

      ctx.filter = 'blur(12px)';

      const scale = Math.max(coverSize / img.width, coverSize / img.height);
      
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (coverSize - w) / 2;
      const y = (coverSize - h) / 2;
      
      ctx.drawImage(img, x, y, w, h);

      if (this.scene.textures.exists(textureKey)) {
        this.scene.textures.remove(textureKey);
      }
      this.scene.textures.addCanvas(textureKey, canvas);

      this.finishScanCircle(() => {
        this.showPreviewWithMask(textureKey, coverSize);
      });
    };
    
    img.src = `data:image/png;base64,${base64Data}`;
  }
  
  finishScanCircle(onComplete) {
    if (this.scanTween && this.scanTween.isPlaying()) {
      this.scanTween.stop();
    }
    
    const remainingDistance = this.maxScanRadius - this.currentScanRadius;
    const duration = Math.max(500, remainingDistance * 4);
    
    this.scanTween = this.scene.tweens.add({
      targets: this,
      currentScanRadius: this.maxScanRadius,
      duration: duration,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        this.drawScanCircle(this.currentScanRadius);
      },
      onComplete: () => {
        onComplete();
      }
    });
  }
  
  showPreviewWithMask(textureKey, coverSize) {
    this.blurredImage = this.scene.add.image(0, 0, textureKey);
    this.blurredImage.setOrigin(0.5);
    this.blurredImage.setScale(1);
    this.container.addAt(this.blurredImage, 0);

    this.grayTextureKey = `gray_overlay_${this.playlist.id}_${Date.now()}`;
    this.grayCanvasTexture = this.scene.textures.createCanvas(
      this.grayTextureKey,
      this.overlaySize,
      this.overlaySize
    );
    
    this.grayOverlay = this.scene.add.image(0, 0, this.grayTextureKey);
    this.grayOverlay.setOrigin(0.5);

    this.grayOverlay.setAlpha(1); 
    this.container.add(this.grayOverlay);
    
    this.currentMaskRadius = 0;
    this.drawGrayWithHole(0);

    if (this.scanCircle) {
      this.scanCircle.destroy();
      this.scanCircle = null;
    }
    if (this.scanCircleKey && this.scene.textures.exists(this.scanCircleKey)) {
      this.scene.textures.remove(this.scanCircleKey);
    }
    this.scanCircleTexture = null;

    if (this.titleText) {
      this.titleText.destroy();
      this.titleText = null;
    }
    
    this.loadingStage = 'duration';
  }
  
  updateLoadingProgress(progress, stage) {
    if (!this.isLoading) return;
    
    this.loadingProgress = progress;
    this.loadingStage = stage;
    
    if (this.blurredImage && this.maskCenter && this.grayCanvasTexture && stage !== 'scanning') {
      const maskProgress = Math.max(0, (progress - 30) / 70);
      const targetRadius = maskProgress * this.maxMaskRadius;
      
      const radiusDiff = Math.abs(targetRadius - this.currentMaskRadius);
      const duration = Math.max(1000, radiusDiff * 4);
      
      if (this.maskTween && this.maskTween.isPlaying()) {
        this.maskTween.stop();
      }
      
      this.maskTween = this.scene.tweens.add({
        targets: this,
        currentMaskRadius: targetRadius,
        duration: duration,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          this.drawGrayWithHole(this.currentMaskRadius);
        }
      });
    }
  }
  
  transitionToLoaded() {
    if (!this.isLoading) return;

    this.isLoading = false;
    
    if (this.maskTween) {
      this.maskTween.stop();
      this.maskTween = null;
    }
    if (this.scanTween) {
      this.scanTween.stop();
      this.scanTween = null;
    }
    
    const finalRadius = this.maxMaskRadius * 1.1;
    const remainingDistance = finalRadius - this.currentMaskRadius;
    const maskDuration = Math.max(1500, remainingDistance * 3);
    
    this.scene.tweens.add({
      targets: this,
      currentMaskRadius: finalRadius,
      duration: maskDuration,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        this.drawGrayWithHole(this.currentMaskRadius);
      },
      onComplete: () => {
        if (this.grayOverlay) {
          this.scene.tweens.add({
            targets: this.grayOverlay,
            alpha: 0,
            duration: 400,
            ease: 'Quad.easeOut',
            onComplete: () => {
              this.grayOverlay.destroy();
              this.grayOverlay = null;
              
              if (this.grayTextureKey && this.scene.textures.exists(this.grayTextureKey)) {
                this.scene.textures.remove(this.grayTextureKey);
              }
              this.grayCanvasTexture = null;
              
              this.scene.time.delayedCall(300, async () => {
                this.image = this.blurredImage;
                this.blurredImage = null;
                await this.finalizeTexture(); 
                
                StateManager.emit('playlistReadyForColors', {
                  id: this.playlist.id,
                  coverUrl: this.playlist.coverUrl
                });
              });
            }
          });
        }

        this.scene.time.delayedCall(300, () => {
          this.image = this.blurredImage;
          this.blurredImage = null;
          this.finalizeTexture();
        });
      }
    });
  }
  
  async finalizeTexture() {
    const updatedPlaylist = StateManager.getPlaylists().find(p => p.id === this.playlist.id);
    if (updatedPlaylist) {
      this.playlist = updatedPlaylist;
    }

    const mainTextureKey = `preview_${this.playlist.id}`;
    const blurTextureKey = `preview_blur_${this.playlist.id}`;
    
    if (this.scene.textures.exists(mainTextureKey) && this.image) {
      this.image.setTexture(mainTextureKey);
      
      const coverSize = CONFIG.getCoverSize();
      const tex = this.scene.textures.get(mainTextureKey);
      
      const w = tex.getSourceImage().width;
      const h = tex.getSourceImage().height;
      const minDim = Math.min(w, h);
      const offsetX = (w - minDim) / 2;
      const offsetY = (h - minDim) / 2;
      
      this.image.setCrop(offsetX, offsetY, minDim, minDim);
      this.image.setScale(coverSize / minDim);

      try {
        const imageElement = tex.getSourceImage();
        const colorData = await ColorExtractor.extractFromImage(imageElement);
        
        if (colorData) {
          const bubbles = colorData.colors || colorData.palette?.map(hex => parseInt(hex.replace('#', ''), 16));
          
          StateManager.setColorData(this.playlist.id, {
            bubbles: bubbles,
            background: colorData.background || { r: 17, g: 17, b: 17 },
            icons: bubbles[1] || 0xFFFFFF
          });

          StateManager.applyColorsForPlaylist(this.playlist.id);
        }
      } catch (e) {
        StateManager.applyColorsForPlaylist(this.playlist.id);
      }
    }
    if (this.scene.textures.exists(blurTextureKey)) {
      this.scene.textures.remove(blurTextureKey);
    }
  }

  moveTo(x, y, scale, alpha, animate = true, onComplete = null) {
    const duration = animate ? CONFIG.CAROUSEL_TRANSITION_MS : 0;
    const finalY = y + this.playOffset;
    
    this.scene.tweens.killTweensOf(this.container);
    if (this.image) this.scene.tweens.killTweensOf(this.image);

    if (duration > 0) {
      this.scene.tweens.add({
        targets: this.container,
        x,
        y: finalY,
        scaleX: scale,
        scaleY: scale,
        alpha,
        duration,
        ease: 'Quad.easeInOut',
        onComplete: () => {
          if (onComplete) onComplete();
        }
      });
    } else {
      this.container.setPosition(x, finalY);
      this.container.setScale(scale);
      this.container.setAlpha(alpha);
      if (onComplete) onComplete();
    }
    
    this.currentScale = scale;
    this.targetScale = scale;
  }

  setPlayOffset(offset, animate = true) {
    this.targetPlayOffset = offset;
    this.scene.tweens.killTweensOf(this);

    if (animate) {
      this.scene.tweens.add({
        targets: this,
        playOffset: offset,
        duration: 500,
        ease: 'Quad.easeInOut'
      });
    } else {
      this.playOffset = offset;
    }
  }

  containsPoint(x, y) {
    if (this.currentScale < 0.1) return false;
    const bounds = this.container.getBounds();
    return Phaser.Geom.Rectangle.Contains(bounds, x, y);
  }

  setGrayscale(isGray) {
    if (this.image && this.image.setTint) {
      if (isGray) this.image.setTint(0x888888);
      else this.image.clearTint();
    }
  }

  destroy() {
    if (this.onScanProgress) {
      StateManager.off('scanProgress', this.onScanProgress);
    }
    if (this.onProgressUpdate) {
      StateManager.off('playlistLoadingProgress', this.onProgressUpdate);
    }
    if (this.onDurationProgress) {
      StateManager.off('durationProgress', this.onDurationProgress);
    }
    if (this.onPreviewReady) {
      StateManager.off('previewReadyForBlur', this.onPreviewReady);
    }
    if (this.onLoadingComplete) {
      StateManager.off('playlistLoadingComplete', this.onLoadingComplete);
    }
    
    if (this.maskTween) {
      this.maskTween.stop();
    }
    if (this.scanTween) {
      this.scanTween.stop();
    }

    if (this.grayTextureKey && this.scene.textures.exists(this.grayTextureKey)) {
      this.scene.textures.remove(this.grayTextureKey);
    }
    if (this.scanCircleKey && this.scene.textures.exists(this.scanCircleKey)) {
      this.scene.textures.remove(this.scanCircleKey);
    }
    const blurKey = `preview_blur_${this.playlist.id}`;
    if (this.scene.textures.exists(blurKey)) {
        this.scene.textures.remove(blurKey);
    }
    
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.killTweensOf(this);
    this.container.destroy();
  }
}