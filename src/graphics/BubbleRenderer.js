import { CONFIG } from '../config.js';
import { MathUtils } from '../utils/MathUtils.js';
import { BUBBLE_VERTEX_SHADER, BUBBLE_FRAGMENT_SHADER } from './shaders.js';

export class BubbleRenderer {
  constructor(scene) {
    this.scene = scene;
    
    this.canvas = null;
    this.gl = null;
    this.program = null;
    this.buffer = null;
    
    this.flatData = new Float32Array(this.maxBubbles * 3);

    this.bubbles = new Float32Array(CONFIG.MAX_BUBBLES * 3);
    this.speeds = new Float32Array(CONFIG.MAX_BUBBLES * 2);
    
    this.colors = new Float32Array(CONFIG.MAX_BUBBLES * 3);
    this.targetColors = new Float32Array(CONFIG.MAX_BUBBLES * 3);
    this.oldColors = new Float32Array(CONFIG.MAX_BUBBLES * 3);
    
    this.savedColors = null;
    
    this.colorTransition = {
      active: false,
      startTime: 0,
      duration: CONFIG.BUBBLE_COLOR_TRANSITION
    };

    this.spawnTimer = 0;
    this.spawnInterval = 3000; 
    this.activeBubblesCount = 0; 
    
    this.viewWidth = window.innerWidth;
    this.viewHeight = window.innerHeight;
    
    this.initialized = false;
    this.lastTime = 0;
    
    this.boundResizeHandler = this.onWindowResize.bind(this);
  }

  create() {
    if (this.initialized) return;
    
    this.createWebGLCanvas();
    this.initWebGL();
    this.initBubbles();
    
    window.addEventListener('resize', this.boundResizeHandler);
    
    this.initialized = true;
    this.lastTime = performance.now();
  }

  createWebGLCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'bubble-canvas';
    this.canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 0;
      pointer-events: none;
    `;
    
    const gameContainer = document.getElementById('game-container');
    gameContainer.parentNode.insertBefore(this.canvas, gameContainer);
 
    this.gl = this.canvas.getContext('webgl2', {
      premultipliedAlpha: false,
      antialias: false,
      powerPreference: 'high-performance',
      alpha: true
    }) || this.canvas.getContext('webgl', {
      premultipliedAlpha: false,
      alpha: true
    });

    this.resizeCanvas();
  }

  resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    this.viewWidth = window.innerWidth;
    this.viewHeight = window.innerHeight;
    
    this.canvas.width = this.viewWidth * dpr;
    this.canvas.height = this.viewHeight * dpr;
    
    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  initWebGL() {
    if (!this.gl) {
      return;
    }
    
    const gl = this.gl;
    
    const vs = this.compileShader(gl.VERTEX_SHADER, BUBBLE_VERTEX_SHADER);
    if (!vs) {
      return;
    }
    
    const fs = this.compileShader(gl.FRAGMENT_SHADER, BUBBLE_FRAGMENT_SHADER);
    if (!fs) {
      gl.deleteShader(vs);
      return;
    }
    
    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);
    
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(this.program);
      
      gl.deleteProgram(this.program);
      this.program = null;
      return;
    }
    
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1,  1,  1, -1,   1, 1
    ]), gl.STATIC_DRAW);
    
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  }

  initBubbles() {
    const nativeWidth = this.canvas.width;
    const nativeHeight = this.canvas.height;

    for (let i = 0; i < CONFIG.MAX_BUBBLES; i++) {
      const idx = i * 3;

      this.bubbles[idx] = nativeWidth / 2;
      this.bubbles[idx + 1] = nativeHeight + 5000; 
      this.bubbles[idx + 2] = 0; 
      
      this.speeds[i * 2] = 0;
      this.speeds[i * 2 + 1] = 0;
    }

    this.activeBubblesCount = 0;
  }

  update(delta) {
    const stableDelta = Math.min(delta, 50);
    this.spawnTimer += stableDelta;
    if (this.spawnTimer > this.spawnInterval && this.activeBubblesCount < CONFIG.MAX_BUBBLES) {
        this.spawnBubble();
        this.spawnTimer = 0;
    }
    
    this.updatePositions(stableDelta);
    this.updateColorTransition();
    this.render();
  }

  spawnBubble() {
    const i = this.activeBubblesCount;
    this.activeBubblesCount++;
    
    const idx = i * 3;
    const nativeWidth = this.canvas.width;
    const nativeHeight = this.canvas.height;
    const scaleX = nativeWidth / CONFIG.LOGICAL_WIDTH;
    const scaleY = nativeHeight / CONFIG.LOGICAL_HEIGHT;
    
    const MARGIN = CONFIG.BUBBLE_MAX_RADIUS * 2;

    const logicalX = (Math.random() - 0.5) * CONFIG.LOGICAL_WIDTH;
    const logicalRadius = Math.random() * (CONFIG.BUBBLE_MAX_RADIUS - CONFIG.BUBBLE_MIN_RADIUS) + CONFIG.BUBBLE_MIN_RADIUS;

    this.bubbles[idx] = logicalX * scaleX + nativeWidth / 2;
    this.bubbles[idx + 1] = nativeHeight + MARGIN; 

    this.bubbles[idx + 2] = logicalRadius * Math.min(scaleX, scaleY) * 0.3;

    this.speeds[i * 2] = (Math.random() - 0.5) * 0.8 * scaleX;
    this.speeds[i * 2 + 1] = -(Math.random() * 0.5 + 0.2) * scaleY;
  }

  updatePositions(delta) {
    const nativeWidth = this.canvas.width;
    const nativeHeight = this.canvas.height;
    const dt = delta / 16.67;
    
    const MARGIN = CONFIG.BUBBLE_MAX_RADIUS * 2;
    const marginLeft = 50;
    const marginRight = nativeWidth - 50;

    for (let i = 0; i < CONFIG.MAX_BUBBLES; i++) {
      if (i >= this.activeBubblesCount) continue;
      const idx = i * 3;
      const speedIdx = i * 2;
      const radius = this.bubbles[idx + 2];
      
      const buoyancy = 0.0015 * (80 / radius) * dt;

      this.speeds[speedIdx + 1] -= buoyancy;
      
      this.speeds[idx] += (Math.random() - 0.5) * 0.003 * dt;
      this.speeds[speedIdx] *= 0.999;
      this.speeds[speedIdx + 1] *= 0.999;
      
      const maxSpeed = 1.5;
      this.speeds[speedIdx] = Math.max(-maxSpeed, Math.min(maxSpeed, this.speeds[speedIdx]));
      this.speeds[speedIdx + 1] = Math.max(-maxSpeed, Math.min(maxSpeed, this.speeds[speedIdx + 1]));
      
      this.bubbles[idx] += this.speeds[speedIdx] * dt;
      this.bubbles[idx + 1] += this.speeds[speedIdx + 1] * dt;

      if (this.bubbles[idx + 1] + radius < -MARGIN) { 
        this.bubbles[idx] = marginLeft + Math.random() * (marginRight - marginLeft);
        this.bubbles[idx + 1] = nativeHeight + MARGIN; 
        
        this.speeds[idx] = (Math.random() - 0.5) * 0.3;
        this.speeds[speedIdx + 1] = -(Math.random() * 0.5 + 0.2); 
      }

      if (this.bubbles[idx] - radius < marginLeft) {
        this.bubbles[idx] = marginLeft + radius;
        this.speeds[speedIdx] *= -0.5;
      } else if (this.bubbles[idx] + radius > marginRight) {
        this.bubbles[idx] = marginRight - radius;
        this.speeds[speedIdx] *= -0.5;
      }
    }
  }

  updateColorTransition() {
    if (!this.colorTransition.active) return;
    
    const elapsed = performance.now() - this.colorTransition.startTime;
    let t = elapsed / this.colorTransition.duration;
    
    if (t >= 1) {
      t = 1;
      this.colorTransition.active = false;
      this.colors.set(this.targetColors);
    } else {
      t = MathUtils.easeInOutQuad(t);
      for (let i = 0; i < CONFIG.MAX_BUBBLES * 3; i++) {
        this.colors[i] = this.oldColors[i] + (this.targetColors[i] - this.oldColors[i]) * t;
      }
    }
  }

  render() {
    if (!this.gl || !this.program) return;
    
    const gl = this.gl;
    
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    gl.useProgram(this.program);

    const uResolution = gl.getUniformLocation(this.program, 'uResolution');
    const uBubbles = gl.getUniformLocation(this.program, 'uBubbles');
    const uColors = gl.getUniformLocation(this.program, 'uColors');
    
    gl.uniform2f(uResolution, this.canvas.width, this.canvas.height);
    gl.uniform3fv(uBubbles, this.bubbles);
    gl.uniform3fv(uColors, this.colors);
 
    const posLoc = gl.getAttribLocation(this.program, 'inPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  transitionToColors(newColors) {

    if (!Array.isArray(newColors) || newColors.length === 0) {
      newColors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00];
    }

    newColors = newColors.map(color => color || 0x444444);

    const count = CONFIG.MAX_BUBBLES;
    const targetData = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const colorInt = newColors[i % newColors.length];
      targetData[i*3] = ((colorInt >> 16) & 0xFF) / 255.0;
      targetData[i*3+1] = ((colorInt >> 8) & 0xFF) / 255.0;
      targetData[i*3+2] = (colorInt & 0xFF) / 255.0;
    }

    this.oldColors.set(this.colors);
    this.targetColors.set(targetData);

    this.colorTransition.active = true;
    this.colorTransition.startTime = performance.now();
    this.colorTransition.duration = 2000;
  }

  transitionToGrayscale() {
    this.savedColors = new Float32Array(this.targetColors);
    const grayscale = new Float32Array(CONFIG.MAX_BUBBLES * 3);
    grayscale.fill(0.5);
    this.transitionToColors(grayscale);
  }

  restoreColors() {
    if (this.savedColors) {
      this.transitionToColors(this.savedColors);
    }
  }

  setColors(newColors) {
    
    if (!newColors || !Array.isArray(newColors) || newColors.length === 0) {
      newColors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00];
    }

    newColors = newColors.map(color => {
      if (!color || color === 0) return 0x444444; 
      return color;
    });

    const count = CONFIG.MAX_BUBBLES;
    const targetData = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const colorInt = newColors[i % newColors.length];
      targetData[i*3] = ((colorInt >> 16) & 0xFF) / 255.0;
      targetData[i*3+1] = ((colorInt >> 8) & 0xFF) / 255.0;
      targetData[i*3+2] = (colorInt & 0xFF) / 255.0;
    }

    this.oldColors.set(this.colors);
    this.targetColors.set(targetData);

    this.colorTransition.active = true;
    this.colorTransition.startTime = performance.now();
    this.colorTransition.duration = 50;
  }

  onWindowResize() {
    this.resizeCanvas();
  }

  destroy() {
    window.removeEventListener('resize', this.boundResizeHandler);
    
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    
    if (this.gl) {
      if (this.program) this.gl.deleteProgram(this.program);
      if (this.buffer) this.gl.deleteBuffer(this.buffer);
    }
    
    this.initialized = false;
  }
}