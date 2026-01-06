import { createApp } from './app.js';
import { CapacitorBridge } from './platform/CapacitorBridge.js';
import { StateManager } from './data/StateManager.js';

async function bootstrap() {

  await CapacitorBridge.init();
  const app = createApp();

  const handleResize = () => {
    if (app.isRunning) {
      app.scale.resize(window.innerWidth, window.innerHeight);
    }
  };

  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', () => setTimeout(handleResize, 100));

  window.__APP__ = app;
  window.__STATE__ = StateManager;
  
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}