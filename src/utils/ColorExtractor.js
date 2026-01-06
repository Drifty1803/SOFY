export class ColorExtractor {

  static async extractFromImage(source) {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      let img;
      if (source instanceof HTMLImageElement || source instanceof HTMLCanvasElement) {
        img = source;
      } else {
        img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = source;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
      }

      const MAX_SIZE = 100;
      const w = img.width || img.naturalWidth;
      const h = img.height || img.naturalHeight;
      const scale = Math.min(MAX_SIZE / w, MAX_SIZE / h, 1);
      
      canvas.width = Math.floor(w * scale);
      canvas.height = Math.floor(h * scale);
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const pixelCount = canvas.width * canvas.height;

      const colorMap = new Map();
      const QUANTIZE_SHIFT = 4; 

      for (let i = 0; i < pixelCount; i++) {
         const offset = i * 4;
         const r = data[offset];
         const g = data[offset + 1];
         const b = data[offset + 2];
         const a = data[offset + 3];

         if (a < 128) continue;

         const key = `${r >> QUANTIZE_SHIFT},${g >> QUANTIZE_SHIFT},${b >> QUANTIZE_SHIFT}`;
         
         if (!colorMap.has(key)) {
             const y = Math.floor(i / canvas.width);
             const x = i % canvas.width;
             colorMap.set(key, { 
                 count: 1, r, g, b, 
                 x: Math.floor(x / scale), 
                 y: Math.floor(y / scale) 
             });
         } else {
             colorMap.get(key).count++;
         }
      }

      let sortedBuckets = Array.from(colorMap.values()).sort((a, b) => b.count - a.count);

      const selectedPixels = [];
      const MIN_DIST_SQ = 25 * 25; 

      for (const p of sortedBuckets) {
          if (selectedPixels.length >= 6) break;
          let tooClose = false;
          for (const s of selectedPixels) {
              const d = (p.r - s.r)**2 + (p.g - s.g)**2 + (p.b - s.b)**2;
              if (d < MIN_DIST_SQ) { tooClose = true; break; }
          }
          if (!tooClose) selectedPixels.push(p);
      }

      while (selectedPixels.length < 6) {
          if (selectedPixels.length > 0) {
             const last = selectedPixels[selectedPixels.length - 1];
             selectedPixels.push({ ...last, x: last.x + 5, y: last.y + 5 });
          } else {
             selectedPixels.push({ r: 40, g: 40, b: 40, x: w/2, y: h/2 });
          }
      }

      selectedPixels.forEach(p => { p.lum = 0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b; });
      selectedPixels.sort((a, b) => a.lum - b.lum);
      const finalOrdered = [];
      finalOrdered[0] = selectedPixels[1];
      finalOrdered[1] = selectedPixels[2];
      finalOrdered[2] = selectedPixels[3];
      finalOrdered[3] = selectedPixels[4];
      finalOrdered[4] = selectedPixels[0]; 
      finalOrdered[5] = selectedPixels[5]; 

      const coords = finalOrdered.map(p => ({ x: p.x, y: p.y, r: p.r, g: p.g, b: p.b }));
      const bubbleColorsInt = coords.slice(0, 4).map(c => (c.r << 16) | (c.g << 8) | c.b);
      const bgPixel = coords[4];
      const iconPixel = coords[5];

      return {
          bubbles: bubbleColorsInt,
          background: { r: bgPixel.r, g: bgPixel.g, b: bgPixel.b },
          icons: (iconPixel.r << 16) | (iconPixel.g << 8) | iconPixel.b,
          coords: coords, 

          bg: this.rgbToHex(bgPixel.r, bgPixel.g, bgPixel.b),
          text: this.rgbToHex(iconPixel.r, iconPixel.g, iconPixel.b),
          palette: coords.map(c => this.rgbToHex(c.r, c.g, c.b)),
          colors: coords.map(c => (c.r << 16) | (c.g << 8) | c.b)
      };

    } catch (e) {
      return this.getFallbackColors();
    }
  }

  static rgbToHex(r, g, b) {
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  static getFallbackColors() {
    const hexColors = ['#111111', '#444444', '#666666', '#888888'];
    const bubbles = hexColors.map(hex => parseInt(hex.replace('#', ''), 16));
    return {
      bubbles: bubbles,
      background: { r: 17, g: 17, b: 17 },
      icons: 0xFFFFFF,
      coords: [],
      bg: '#111111',
      text: '#FFFFFF'
    };
  }

  static getAddButtonColors() {
    const hexColors = ['#1a1a1a', '#333333', '#555555', '#777777'];
    const bubbles = hexColors.map(hex => parseInt(hex.replace('#', ''), 16));
    return {
      bubbles: bubbles,
      background: { r: 26, g: 26, b: 26 },
      icons: 0x333333,
      coords: [],
      bg: '#1a1a1a',
      text: '#ffffff'
    };
  }
  
  static generateFallback() { return this.getFallbackColors(); }
}