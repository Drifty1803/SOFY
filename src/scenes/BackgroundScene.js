import Phaser from 'phaser';
import { BubbleRenderer } from '../graphics/BubbleRenderer.js';
import { StateManager } from '../data/StateManager.js';

export class BackgroundScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BackgroundScene' });
    this.bubbleRenderer = null;
    this.currentBgColor = { r: 17, g: 17, b: 17 };
  }

  create() {
    this.bubbleRenderer = new BubbleRenderer(this);
    this.bubbleRenderer.create();
    StateManager.registerBubbleRenderer(this.bubbleRenderer);

    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    document.body.style.transition = 'none';
    this.updateBodyColor();

    StateManager.on('backgroundColorChanged', (bg) => {
      this.tweens.killTweensOf(this.currentBgColor);

      this.tweens.add({
        targets: this.currentBgColor,
        r: bg.r, g: bg.g, b: bg.b,
        duration: 600,
        ease: 'Cubic.out',
        onUpdate: () => this.updateBodyColor()
      });
    });
  }

  updateBodyColor() {
    document.body.style.transition = 'none';
    
    const r = Math.floor(this.currentBgColor.r);
    const g = Math.floor(this.currentBgColor.g);
    const b = Math.floor(this.currentBgColor.b);
    document.body.style.backgroundColor = `rgb(${r},${g},${b})`;
  }

  update(time, delta) {
    if (this.bubbleRenderer) this.bubbleRenderer.update(delta);
  }

  shutdown() {
    StateManager.bubbleRenderer = null;
    if (this.bubbleRenderer) this.bubbleRenderer.destroy();
    StateManager.off('backgroundColorChanged');
  }
}