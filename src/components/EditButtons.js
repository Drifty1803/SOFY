import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { StateManager } from '../data/StateManager.js';

export class EditButtons extends Phaser.Events.EventEmitter {
  constructor(scene) {
    super();
    this.scene = scene;
    
    this.container = scene.add.container(0, 0);
    this.container.setDepth(2000); 
    this.visible = false;
    
    this.crossGraphics = null;
    this.shadowGraphics = null;
    this.maskGraphics = null;
    this.targetCover = null;
    this.blurInstance = null;
    this.iconSprites = [];
    this.dimmer = null;
  }

  show(cover) {
    if (this.visible || !cover) return;
    
    this.visible = true;
    this.targetCover = cover;
    
    const { x, y } = cover.container;
    const size = CONFIG.getCoverSize();
    
    this.container.setPosition(x, y);
    const scale = cover.currentScale || 0.7;
    this.container.setScale(scale); 

    this.dimmer = this.scene.add.rectangle(0, 0, size, size, 0x000000);
    this.dimmer.setAlpha(0);
    cover.container.add(this.dimmer);
    
    this.scene.tweens.add({
        targets: this.dimmer,
        alpha: 0.4,
        duration: 300
    });

    const blurPlugin = this.scene.plugins.get('rexKawaseBlurPipeline');
    if (blurPlugin && cover.image) {
        this.blurInstance = blurPlugin.add(cover.image, { blur: 0, quality: 4 });
        this.scene.tweens.add({ targets: this.blurInstance, blur: 8, duration: 300, ease: 'Quad.easeOut' });
    }

    const iconColor = StateManager.getIconColor(cover.playlist.id) || 0xffffff;
    const strokeColor = this.getDarkerColor(iconColor);
    
    if (!this.shadowGraphics) {
        this.shadowGraphics = this.scene.add.graphics();
        this.container.add(this.shadowGraphics);
    }
    if (!this.crossGraphics) {
        this.crossGraphics = this.scene.add.graphics();
        this.container.add(this.crossGraphics);
    }

    this._drawCrossGeometry(this.shadowGraphics, size, strokeColor, size * 0.04 + 6);
    this._drawCrossGeometry(this.crossGraphics, size, iconColor, size * 0.04);

    if (!this.maskGraphics) this.maskGraphics = this.scene.make.graphics();
    const realSize = size * scale;
    this.maskGraphics.clear();
    this.maskGraphics.fillStyle(0xffffff);
    this.maskGraphics.fillRect(-realSize/2, -realSize/2, realSize, realSize);
    this.maskGraphics.x = x;
    this.maskGraphics.y = y;
    
    const mask = this.maskGraphics.createGeometryMask();
    this.crossGraphics.setMask(mask);
    this.shadowGraphics.setMask(mask); 
    
    this.maskGraphics.setScale(0);
    this.scene.tweens.add({ targets: this.maskGraphics, scaleX: 1, scaleY: 1, duration: 300, ease: 'Cubic.easeOut' });

    const dist = size * 0.35; 
    const iconScale = 1.2; 

    this.addIcon('icon_up', 0, -dist, iconColor, strokeColor, iconScale);      
    this.addIcon('icon_down', 0, dist, iconColor, strokeColor, iconScale);     
    this.addIcon('icon_delete', -dist, 0, iconColor, strokeColor, iconScale);  
    this.addIcon('icon_palette', dist, 0, iconColor, strokeColor, iconScale); 
  }

  _drawCrossGeometry(graphics, size, color, width) {
      graphics.clear();
      graphics.setAlpha(1);
      
      const thickness = width; 
      const halfSize = size / 2;
      const len = halfSize * 1.5; 
      
      graphics.lineStyle(thickness, color, 1);
      graphics.beginPath();
      graphics.moveTo(-len, -len);
      graphics.lineTo(len, len);
      graphics.moveTo(len, -len);
      graphics.lineTo(-len, len);
      graphics.strokePath();
  }


  addIcon(key, x, y, color, strokeColor, scale) {
      const iconGroup = this.scene.add.container(x, y);
      iconGroup.setScale(0);
      iconGroup.setAlpha(0);

      const shadow = this.scene.add.image(2, 2, key);
      shadow.setOrigin(0.5);
      shadow.setTint(strokeColor); 
      iconGroup.add(shadow);

      const icon = this.scene.add.image(0, 0, key);
      icon.setOrigin(0.5);
      icon.setTint(color);
      iconGroup.add(icon);
      
      this.container.add(iconGroup);
      this.iconSprites.push(iconGroup);

      this.scene.tweens.add({
          targets: iconGroup,
          scaleX: scale,
          scaleY: scale,
          alpha: 1,
          duration: 300,
          delay: 150, 
          ease: 'Back.easeOut'
      });
  }
  
  updateColor(color) {
      const size = CONFIG.getCoverSize();
      const strokeColor = this.getDarkerColor(color);
      this._drawCrossGeometry(this.shadowGraphics, size, strokeColor, size * 0.04 + 6);
      this._drawCrossGeometry(this.crossGraphics, size, color, size * 0.04);

      this.iconSprites.forEach(group => {
          const shadow = group.getAt(0);
          const icon = group.getAt(1);
          if (shadow) shadow.setTint(strokeColor);
          if (icon) icon.setTint(color);
      });
  }

  getDarkerColor(colorInt) {
      const color = Phaser.Display.Color.IntegerToColor(colorInt);
      color.darken(50); 
      return color.color;
  }

  hide() {
    if (!this.visible) return;
    if (this.dimmer) {
        this.scene.tweens.add({
            targets: this.dimmer,
            alpha: 0,
            duration: 200,
            onComplete: () => {
                if (this.targetCover) this.targetCover.container.remove(this.dimmer);
                this.dimmer.destroy();
                this.dimmer = null;
            }
        });
    }

    if (this.iconSprites.length > 0) {
        this.scene.tweens.add({
            targets: this.iconSprites,
            scaleX: 0,
            scaleY: 0,
            alpha: 0,
            duration: 200
        });
    }

    if (this.blurInstance) {
        this.scene.tweens.add({
            targets: this.blurInstance,
            blur: 0,
            duration: 200,
            onComplete: () => {
                const blurPlugin = this.scene.plugins.get('rexKawaseBlurPipeline');
                if (blurPlugin && this.targetCover && this.targetCover.image) {
                    blurPlugin.remove(this.targetCover.image);
                }
                this.blurInstance = null;
            }
        });
    }

    if (this.maskGraphics) {
        this.scene.tweens.add({
            targets: this.maskGraphics,
            scaleX: 0,
            scaleY: 0,
            duration: 250,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                this.cleanup();
            }
        });
    } else {
        this.cleanup();
    }
  }

  handlePress(worldX, worldY) {
      if (!this.visible) return;
      const dx = worldX - this.container.x;
      const dy = worldY - this.container.y;
      
      let sector = '';
      if (Math.abs(dx) > Math.abs(dy)) {
          sector = dx > 0 ? 'RIGHT' : 'LEFT';
      } else {
          sector = dy > 0 ? 'BOTTOM' : 'TOP';
      }
      this.onSectorAction(sector);
  }
  
  onSectorAction(sector) {
    this.emit('action', sector);
  }

  cleanup() {
    this.visible = false;
    this.iconSprites.forEach(s => s.destroy());
    this.iconSprites = [];

    this.targetCover = null;
    this.crossGraphics.clear();
    this.shadowGraphics.clear();
    this.crossGraphics.setMask(null);
    this.shadowGraphics.setMask(null);
    if (this.maskGraphics) this.maskGraphics.clear();
  }

  destroy() {
    this.container.destroy();
    if (this.maskGraphics) this.maskGraphics.destroy();
    this.removeAllListeners();
  }
}