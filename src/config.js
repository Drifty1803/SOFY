import { ScaleManager } from './utils/ScaleManager.js';

export const CONFIG = {
  LONG_PRESS_MS: 2000,
  MOVE_THRESHOLD: 30,
  SWIPE_VELOCITY: 0.3,
  TAP_MAX_DURATION: 300,

  ANIMATION_MS: 3000,
  VINYL_SPIN_DURATION: 1500,
  CAROUSEL_TRANSITION_MS: 400,
  BUBBLE_COLOR_TRANSITION: 1200,

  COVER_MARGIN: 20,
  VINYL_SCALE: 0.8,

  getCoverSize() {
    return ScaleManager.getCoverSize();
  },
  
  getCoverSpacing() {
    return this.getCoverSize() + this.COVER_MARGIN * ScaleManager.DPR;
  },

  MAX_BUBBLES: 25,
  get BUBBLE_MIN_RADIUS() {
    const coverSize = this.getCoverSize() / 2;
    return coverSize / 5 / (window.devicePixelRatio || 1);
  },
  get BUBBLE_MAX_RADIUS() {
    const coverSize = this.getCoverSize() / 2;
    return coverSize / (window.devicePixelRatio || 1);
  },
  BUBBLE_SPEED_FACTOR: 0.5,
  LOGICAL_WIDTH: 432,
  LOGICAL_HEIGHT: 874,
};