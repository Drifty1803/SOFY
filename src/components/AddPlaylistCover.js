import Phaser from 'phaser';
import { CONFIG } from '../config.js';

export class AddPlaylistCover {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);

    this.tutorialStep = 0;
    this.isTyping = false;
    this.arrowTimer = null;

    this.messages = [
      "Create a folder for your radio station. The name of this folder will be a station name.",
      "Copy/move your desired tracks into this folder alongside the desired cover art."
    ];

    this.createVisuals();
  }

  createVisuals() {
    const size = CONFIG.getCoverSize();
    this.size = size;

    this.background = this.scene.add.rectangle(0, 0, size, size, 0x222222);
    this.background.setStrokeStyle(2, 0x444444);

    this.text = this.scene.add.text(0, 0, '+', {
      fontFamily: 'AppFont',
      fontSize: `${size * 0.4}px`,
      color: '#888888',
      align: 'center',
      wordWrap: { width: size - 40, useAdvancedWrap: true }
    }).setOrigin(0.5);

    // === НОВОЕ: отдельный элемент для стрелочки ===
    this.arrowText = this.scene.add.text(0, 0, '>', {
      fontFamily: 'AppFont',
      fontSize: `${Math.max(16, size * 0.08)}px`,
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);

    this.arrowText.setVisible(false); // по умолчанию скрыта

    this.container.add([this.background, this.text, this.arrowText]);
    this.container.setSize(size, size);
  }

  // === ЛОГИКА ВЗАИМОДЕЙСТВИЯ ===
  handleInteraction() {
    if (this.isTyping) return false;

    if (this.arrowTimer) {
      this.arrowTimer.remove();
      this.arrowTimer = null;
    }

    // если кликнули — стрелку прячем сразу (чтобы не мигала на следующем шаге)
    this.arrowText.setVisible(false);

    if (this.tutorialStep === 0) {
      this.tutorialStep = 1;
      this.typewriteText(this.messages[0]);
      return false;
    } else if (this.tutorialStep === 1) {
      this.tutorialStep = 2;
      this.typewriteText(this.messages[1]);
      return false;
    } else {
      this.reset();
      return true;
    }
  }

  typewriteText(message) {
    this.isTyping = true;

    // основному тексту — нужный стиль
    const fontSize = Math.max(16, this.size * 0.08);
    this.text.setStyle({ fontSize: `${fontSize}px`, color: '#ffffff' });

    // стрелке — тот же стиль (можно отдельно настроить)
    this.arrowText.setStyle({ fontSize: `${fontSize}px`, color: '#ffffff' });
    this.arrowText.setVisible(false);

    this.text.setText("");

    let currentIndex = 0;

    this.scene.time.addEvent({
      delay: 30,
      repeat: message.length - 1,
      callback: () => {
        this.text.text += message[currentIndex];
        currentIndex++;

        if (currentIndex === message.length) {
          this.isTyping = false;

          // ВАЖНО: позиционируем стрелку ПОСЛЕ того, как текст полностью напечатан
          // чтобы не влиять на разметку текста.
          this.arrowTimer = this.scene.time.delayedCall(500, () => {
            // стрелка ниже текста (эквивалентно "\n\n>")
            const gap = fontSize * 1.4; // подбери, если хочешь больше/меньше отступ
            const textHeight = this.text.height;

            // т.к. text origin = 0.5, его низ = y + height/2
            this.arrowText.setPosition(
              this.text.x,
              this.text.y + (textHeight / 2) + gap
            );

            this.arrowText.setVisible(true);
          });
        }
      }
    });
  }

  reset() {
    this.tutorialStep = 0;
    this.isTyping = false;

    if (this.arrowTimer) {
      this.arrowTimer.remove();
      this.arrowTimer = null;
    }

    this.arrowText.setVisible(false);

    this.text.setText("+");
    this.text.setStyle({
      fontSize: `${this.size * 0.4}px`,
      color: '#888888'
    });
  }

  moveTo(x, y, scale, alpha, animate = true) {
    this.scene.tweens.killTweensOf(this.container);
    if (animate) {
      this.scene.tweens.add({
        targets: this.container,
        x: x, y: y, scaleX: scale, scaleY: scale, alpha: alpha,
        duration: CONFIG.CAROUSEL_TRANSITION_MS,
        ease: 'Quad.easeInOut'
      });
    } else {
      this.container.setPosition(x, y);
      this.container.setScale(scale);
      this.container.setAlpha(alpha);
    }
  }

  containsPoint(x, y) {
    const bounds = this.container.getBounds();
    return Phaser.Geom.Rectangle.Contains(bounds, x, y);
  }

  clearTint() {
    this.background.fillColor = 0x222222;
  }

  setTint() {
    this.background.fillColor = 0x444444;
  }

  destroy() {
    this.container.destroy();
  }
}