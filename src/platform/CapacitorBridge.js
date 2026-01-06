export class CapacitorBridge {
  static statusBar = null;
  static musicControls = null;
  static isNative = false;

  static async init() {
    this.isNative = this.checkIsNative();
    
    if (!this.isNative) {
      return;
    }

    await this.waitForPlugins();
    await this.initStatusBar();
    await this.initMusicControls();
  }

  static checkIsNative() {
    try {
      return !!(
        window.Capacitor && 
        typeof window.Capacitor.isNativePlatform === 'function' && 
        window.Capacitor.isNativePlatform()
      );
    } catch {
      return false;
    }
  }

  static async waitForPlugins(timeout = 3000) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      if (window.Capacitor?.Plugins) {
        return true;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  }

  static async initStatusBar() {
    if (!this.isNative) return;
    
    try {
      const StatusBar = window.Capacitor?.Plugins?.StatusBar;
      
      if (!StatusBar) {
        return;
      }
      
      this.statusBar = StatusBar;
      
      await this.statusBar.setOverlaysWebView({ overlay: true });
      await this.statusBar.setBackgroundColor({ color: '#00000000' });
      await this.statusBar.setStyle({ style: 'LIGHT' });
    } catch (e) {}
  }

  static async initMusicControls() {
    if (!this.isNative) return;
    
    try {
      const MusicControls = 
        window.Capacitor?.Plugins?.MusicControls ||
        window.Capacitor?.Plugins?.CapacitorMusicControls ||
        window.MusicControls;
      
      if (!MusicControls) {
        return;
      }
      
      this.musicControls = MusicControls;
    } catch (e) {}
  }

  static async updateMusicControls(options) {
    if (!this.musicControls) return;
    
    try {
      await this.musicControls.create({
        track: options.track || 'Music Player',
        artist: options.artist || '',
        album: options.album || '',
        cover: options.cover || '',
        isPlaying: options.isPlaying || false,
        dismissable: true,
        hasPrev: false,
        hasNext: false,
        hasClose: true
      });
    } catch (e) {}
  }

  static async updatePlayState(isPlaying) {
    if (!this.musicControls) return;
    
    try {
      await this.musicControls.updateIsPlaying({ isPlaying });
    } catch (e) {}
  }

  static async destroyMusicControls() {
    if (!this.musicControls) return;
    
    try {
      await this.musicControls.destroy();
    } catch (e) {}
  }

  static async vibrate(pattern = [50]) {
    if (!this.isNative) return;
    
    try {
      const Haptics = window.Capacitor?.Plugins?.Haptics;
      if (Haptics) {
        await Haptics.vibrate({ duration: pattern[0] });
      } else if (navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    } catch (e) {
      if (navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    }
  }

  static async keepAwake(enable = true) {
    if (!this.isNative) return;
    
    try {
      const KeepAwake = window.Capacitor?.Plugins?.KeepAwake;
      if (KeepAwake) {
        if (enable) {
          await KeepAwake.keepAwake();
        } else {
          await KeepAwake.allowSleep();
        }
      }
    } catch (e) {}
  }
}