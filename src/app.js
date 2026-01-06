import Phaser from 'phaser';
import { PreloaderScene } from './scenes/PreloaderScene.js';
import { BackgroundScene } from './scenes/BackgroundScene.js';
import { MainScene } from './scenes/MainScene.js';
import KawaseBlurPipelinePlugin from 'phaser3-rex-plugins/plugins/kawaseblurpipeline-plugin.js';

export function createApp() {
  const realWidth = window.innerWidth * (window.devicePixelRatio || 1);
  const realHeight = window.innerHeight * (window.devicePixelRatio || 1);

  console.log(`[Phaser] Creating ${realWidth}x${realHeight} canvas`);
  const config = {
    type: Phaser.WEBGL,
    parent: 'game-container',
    
    transparent: true,

    width: realWidth,
    height: realHeight,
    
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.NO_CENTER,
    },
    plugins: {
      global: [{
        key: 'rexKawaseBlurPipeline',
        plugin: KawaseBlurPipelinePlugin,
        start: true
      }]
    },
    
    render: {
      antialias: true,
      antialiasGL: true,
      pixelArt: false,
      roundPixels: false
    },
    
    input: {
      activePointers: 3,
      touch: {
        capture: true
      }
    },
    
    autoRound: false,
    
    scene: [PreloaderScene, BackgroundScene, MainScene]
  };

  return new Phaser.Game(config);
}