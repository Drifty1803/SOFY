import Phaser from 'phaser';
import { CONFIG } from '../config.js';

export class GestureManager extends Phaser.Events.EventEmitter {
  constructor(scene) {
    super();
    
    this.scene = scene;
    
    this.touchStart = { x: 0, y: 0, time: 0 };
    this.hasMoved = false;
    this.longPressTimer = null;
    this.isLongPressTriggered = false;
    
    this.bottomBlindZone = 0; 
    
    this.setupInput();
  }

  setupInput() {
    this.scene.input.on('pointerdown', this.onPointerDown, this);
    this.scene.input.on('pointermove', this.onPointerMove, this);
    this.scene.input.on('pointerup', this.onPointerUp, this);
    this.scene.input.on('pointerupoutside', this.onPointerUp, this);
    
    this.scene.scale.on('resize', this.updateBlindZone, this);
    this.updateBlindZone();
  }

  updateBlindZone() {
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.top = '-9999px';
    div.style.paddingBottom = 'env(safe-area-inset-bottom)';
    document.body.appendChild(div);
    
    let safeAreaBottom = 0;
    try {
        const computedStyle = window.getComputedStyle(div);
        safeAreaBottom = parseInt(computedStyle.paddingBottom, 10);
        if (isNaN(safeAreaBottom)) safeAreaBottom = 0;
    } catch (e) {
        safeAreaBottom = 0;
    }
    
    document.body.removeChild(div);

    this.bottomBlindZone = safeAreaBottom > 0 ? (safeAreaBottom + 20) : 30;

  }

  onPointerDown(pointer) {
    if (pointer.y > this.scene.scale.height - this.bottomBlindZone) {
        return; 
    }
    
    this.touchStart = {
      x: pointer.x,
      y: pointer.y,
      time: Date.now()
    };
    this.hasMoved = false;
    this.isLongPressTriggered = false;
    
    this.clearLongPressTimer();

    this.longPressTimer = setTimeout(() => {
      if (!this.hasMoved) {
        this.isLongPressTriggered = true;
        this.emit('longPress', pointer);
      }
    }, 1000); 
  }

  onPointerMove(pointer) {
    if (this.touchStart.time === 0) return;
    
    const dx = Math.abs(pointer.x - this.touchStart.x);
    const dy = Math.abs(pointer.y - this.touchStart.y);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > CONFIG.MOVE_THRESHOLD) {
      this.hasMoved = true;
      this.clearLongPressTimer();
    }
  }

  onPointerUp(pointer) {
    this.clearLongPressTimer();
    
    if (this.touchStart.time === 0) return;
    
    if (this.isLongPressTriggered) {
      this.reset();
      return;
    }
    
    const duration = Date.now() - this.touchStart.time;
    const dx = pointer.x - this.touchStart.x;
    const dy = pointer.y - this.touchStart.y;
    
    if (!this.hasMoved && duration < CONFIG.TAP_MAX_DURATION) {
      this.emit('tap', pointer);
    } else if (this.hasMoved) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      
      if (absDy > absDx && absDy > 50) {
        if (dy < 0) {
          this.emit('swipeUp', pointer);
        } else {
          this.emit('swipeDown', pointer);
        }
      } else if (absDx > absDy && absDx > 50) {
        if (dx < 0) {
          this.emit('swipeLeft', pointer);
        } else {
          this.emit('swipeRight', pointer);
        }
      }
    }
    
    this.reset();
  }

  clearLongPressTimer() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  reset() {
    this.touchStart = { x: 0, y: 0, time: 0 };
    this.hasMoved = false;
    this.isLongPressTriggered = false;
  }

  destroy() {
    this.clearLongPressTimer();
    this.scene.scale.off('resize', this.updateBlindZone, this);
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.removeAllListeners();
  }
}