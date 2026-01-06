import Phaser from 'phaser';
import { Capacitor } from '@capacitor/core';
import { MetadataExtractor } from '../utils/MetadataExtractor.js';

export class AudioPlayer extends Phaser.Events.EventEmitter {
  constructor(localPath, metadata = {}) {
    super();
    this.localPath = localPath;
    this.metadata = metadata;
    this.audio = null;
    this.fadeRaf = null;
    this.isFading = false;
  }

  async load() {
    if (!this.localPath) {
      this.emit('error', 'No local path provided');
      return;
    }

    let src = this.localPath;
    if (Capacitor.isNativePlatform()) {
      src = Capacitor.convertFileSrc(this.localPath);
    }
    
    this._loadMetadata(src);

    this.audio = new Audio();
    this.audio.src = src;
    this.audio.volume = 0;
    this.audio.preload = 'auto';
    
    this.setupMediaSession();
    
    this.audio.addEventListener('canplaythrough', () => this.emit('ready'));
    this.audio.addEventListener('error', (e) => {
      this.emit('error', 'Audio Error');
    });
    
    this.audio.addEventListener('ended', () => this.emit('ended'));
    this.audio.addEventListener('play', () => {
      this.emit('play');
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    });
    this.audio.addEventListener('pause', () => {
      if (!this.isFading) this.emit('pause');
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    });

    this.audio.addEventListener('loadedmetadata', () => {
      if (this.audio && this.audio.duration && isFinite(this.audio.duration)) {
        const durationMs = Math.floor(this.audio.duration * 1000);
        this.emit('durationReady', durationMs);
      }
    });

    this.audio.addEventListener('durationchange', () => {
      if (this.audio && this.audio.duration && isFinite(this.audio.duration)) {
        const durationMs = Math.floor(this.audio.duration * 1000);
        this.emit('durationReady', durationMs);
      }
    });
    
    this.audio.load();
  }

  setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    if (typeof MediaMetadata === 'undefined') return;

    const title = this.metadata.title || 'Unknown Track';
    const artist = this.metadata.artist || 'VNL Player';
    const album = this.metadata.album || '';
    
    const artwork = [];
    if (this.metadata.artwork) {
      artwork.push({ src: this.metadata.artwork, sizes: '512x512', type: 'image/png' });
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album,
      artwork
    });

    try {
      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('stop', () => this.stop());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.emit('next'));
      navigator.mediaSession.setActionHandler('previoustrack', () => this.emit('prev'));
    } catch(e) {}
  }

  async _loadMetadata(src) {
    try {
      const coverBase64 = await MetadataExtractor.extractCover(src);
      if (coverBase64) {
        this.emit('metadata', { cover: coverBase64 });
      } else {
        this.emit('metadata', { cover: null });
      }
    } catch (e) {}
  }

  fadeVolume(from, to, duration, onComplete) {
    if (!this.audio) return;
    if (this.fadeRaf) cancelAnimationFrame(this.fadeRaf);
    this.isFading = true;
    const startTime = performance.now();
    const update = () => {
      if (!this.audio) { this.isFading = false; return; }
      const now = performance.now();
      const progress = Math.min((now - startTime) / duration, 1);
      this.audio.volume = from + (to - from) * progress;
      if (progress < 1) { this.fadeRaf = requestAnimationFrame(update); } 
      else { this.isFading = false; if (onComplete) onComplete(); }
    };
    this.fadeRaf = requestAnimationFrame(update);
  }

  play(fadeInDuration = 800) {
    if (!this.audio) return;
    this.audio.volume = 0;
    const playPromise = this.audio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => { this.fadeVolume(0, 1, fadeInDuration); })
        .catch(e => { if (e.name !== 'AbortError') this.emit('error', e); });
    }
  }

  pause(fadeOutDuration = 300) {
    if (!this.audio || this.audio.paused) return;
    this.fadeVolume(this.audio.volume, 0, fadeOutDuration, () => {
      if (this.audio) { this.audio.pause(); if (!this.isFading) this.emit('pause'); }
    });
  }

  stop() { this.pause(300); }

  destroy() {
    if (this.fadeRaf) cancelAnimationFrame(this.fadeRaf);
    this.isFading = false;
    if (this.audio) { this.audio.pause(); this.audio.src = ''; this.audio.load(); this.audio = null; }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
    }
    this.removeAllListeners();
  }
}