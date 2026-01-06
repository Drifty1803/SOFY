export class ScaleManager {
  static get DPR() {
    return window.devicePixelRatio || 1;
  }
  
  static toNative(cssPixels) {
    return cssPixels * this.DPR;
  }
  
  static getCoverSize() {
    const minSide = Math.min(window.innerWidth, window.innerHeight);
    return Math.floor(this.toNative(minSide));
  }
  
  static getCenter() {
    return {
      x: this.toNative(window.innerWidth / 2),
      y: this.toNative(window.innerHeight / 2)
    };
  }
}