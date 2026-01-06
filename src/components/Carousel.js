import { CONFIG } from '../config.js';
import { Cover } from './Cover.js';
import { StateManager } from '../data/StateManager.js';
import { AddPlaylistCover } from './AddPlaylistCover.js';

export class Carousel {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.items = []; 
    this.visibleItems = []; 
    this.prevVisibleItemsState = new Map(); 

    this.coverSize = CONFIG.getCoverSize();
    this.isSelectionMode = true;
    this.isAnimating = false;
    this.viewportWidth = scene.scale.width;
    this.viewportHeight = scene.scale.height;
    this.playModeOffset = 0;
    
    this.lastCenterIndex = null;

    this.initializeItems();
    
    this.scene.scale.on('resize', this.onResizeInternal, this);
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.onCenterIndexChanged = (index) => {
      if (!this.scene?.sys?.isActive()) return;
      
      this.updateVisibleItems();
      this.updatePositions(true);
      this.updateAddButtonSelection();
    };

    StateManager.on('centerIndexChanged', this.onCenterIndexChanged);
    
    StateManager.on('playlistsChanged', () => {
      this.reinitializeItems();
      this.updatePositions(false);
    });

    StateManager.on('playlistOrderChanged', () => {
      this.refreshIndices(); 
      this.updateVisibleItems(); 
      this.updatePositions(true); 
    });

    StateManager.on('playlistRemoved', (id) => {
        this.onPlaylistRemoved(id);
    });
  }

  onPlaylistRemoved(id) {
    const itemIndex = this.items.findIndex(item => item.id === id);
    
    if (itemIndex === -1) {
      this.refreshIndices();
      this.updateVisibleItems();
      this.updatePositions(true);
      return;
    }

    const removedItem = this.items[itemIndex];
    this.items.splice(itemIndex, 1);

    if (removedItem.container) {
      this.scene.tweens.add({
        targets: removedItem.container,
        scaleX: 0, scaleY: 0, alpha: 0,
        duration: 300, ease: 'Back.easeIn',
        onComplete: () => {
          if (removedItem.cover && removedItem.cover.destroy) {
            removedItem.cover.destroy();
          } else {
            removedItem.container.destroy();
          }
        }
      });
    }

    this.refreshIndices();
    this.lastCenterIndex = StateManager.getCenterIndex();
    this.updateVisibleItems();
    this.updatePositions(true);
  }

  refreshIndices() {
    const playlists = StateManager.getPlaylists();
    
    this.items.forEach(item => {
      if (item.type === 'playlist') {
        const newIndex = playlists.findIndex(p => p.id === item.id);
        item.index = newIndex; 
      } else if (item.type === 'add') {
        item.index = playlists.length;
      }
    });
    
    const deadItems = this.items.filter(i => i.index === -1 && i.type === 'playlist');
    deadItems.forEach(item => {
        if (item.container) item.container.setVisible(false);
    });
    
    this.items = this.items.filter(i => i.index !== -1);
    this.lastCenterIndex = StateManager.getCenterIndex();
  }

  initializeItems() {
    this.items = [];
    this.container.removeAll(true);
    this.prevVisibleItemsState.clear();

    const playlists = StateManager.getPlaylists();
    playlists.forEach((playlist, index) => {
      const cover = new Cover(this.scene, playlist, index);
      cover.container.setVisible(false);
      this.items.push({
        type: 'playlist',
        index: index,
        id: playlist.id,
        cover: cover,
        container: cover.container
      });
      this.container.add(cover.container);
    });

    this.addPlaylistCover = new AddPlaylistCover(this.scene);
    this.addPlaylistCover.container.setVisible(false);
    this.items.push({
      type: 'add',
      index: playlists.length,
      id: 'add_button',
      cover: this.addPlaylistCover,
      container: this.addPlaylistCover.container
    });
    this.container.add(this.addPlaylistCover.container);

    this.lastCenterIndex = StateManager.getCenterIndex();
    
    this.updateVisibleItems();
    this.updateAddButtonSelection();
  }

  reinitializeItems() {
    this.items.forEach(item => { if (item.cover?.destroy) item.cover.destroy(); });
    if (this.addPlaylistCover?.destroy) this.addPlaylistCover.destroy();
    this.prevVisibleItemsState.clear();
    this.initializeItems();
  }


  updateAddButtonSelection() {
    if (this.addPlaylistCover) this.addPlaylistCover.clearTint();
  }

  updateVisibleItems() {
    this.prevVisibleItemsState.clear();
    this.visibleItems.forEach(item => {
      this.prevVisibleItemsState.set(item.item.index, item.position);
    });

    const centerIndex = StateManager.getCenterIndex();
    const totalItems = this.items.length; 

    if (totalItems === 0) {
      this.visibleItems = [];
      return;
    }

    this.visibleItems = [];

    const centerItem = this.items.find(i => i.index === centerIndex);
    if (centerItem) this.visibleItems.push({ item: centerItem, position: 0 });

    if (totalItems > 1) {
      let prevIndex;
      if (totalItems >= 4) {
        prevIndex = (centerIndex - 1 + totalItems) % totalItems;
      } else {
        prevIndex = Math.max(0, centerIndex - 1);
      }
      
      if (prevIndex !== centerIndex) {
        const prevItem = this.items.find(i => i.index === prevIndex);
        if (prevItem) this.visibleItems.push({ item: prevItem, position: -1 });
      }
    }

    if (totalItems > 1) {
      let nextIndex;
      if (totalItems >= 4) {
        nextIndex = (centerIndex + 1) % totalItems;
      } else {
        nextIndex = Math.min(totalItems - 1, centerIndex + 1);
      }
      
      if (nextIndex !== centerIndex) {
        const nextItem = this.items.find(i => i.index === nextIndex);
        if (nextItem) this.visibleItems.push({ item: nextItem, position: 1 });
      }
    }

    this.visibleItems.sort((a, b) => a.position - b.position);
  }

  show(animate = true) {
    this.container.setVisible(true);
    this.updatePositions(animate);
    this.updateAddButtonSelection();
    if (animate) {
      this.scene.time.delayedCall(50, () => this.updatePositions(true));
    }
  }

  hide() {
    this.container.setVisible(false);
  }

  fadeIn() {
    this.visibleItems.forEach(({ item }) => {
      item.container.setAlpha(0);
    });

    this.show(false);

    this.visibleItems.forEach(({ item }) => {
      const targetAlpha = this.getAlphaForPosition(
        this.visibleItems.find(vi => vi.item === item).position
      );
      this.scene.tweens.add({
        targets: item.container,
        alpha: targetAlpha,
        duration: 1000,
        ease: 'Power2'
      });
    });
  }

  setSelectionMode(isSelection) {
    this.isSelectionMode = isSelection;
    this.updatePositions(true);
  }

  setPlayModeOffset(offset, animate = true) {
    this.playModeOffset = offset;
    this.updatePositions(animate);
  }

  canScroll(direction) {
    const totalItems = this.items.length;
    if (totalItems >= 4) return true;
    const centerIndex = StateManager.getCenterIndex();
    return direction === 'next' ? centerIndex < totalItems - 1 : centerIndex > 0;
  }

  async scrollNext() {
    if (this.isAnimating || !this.isSelectionMode) return;
    
    const totalItems = this.items.length;
    const centerIndex = StateManager.getCenterIndex();

    if (centerIndex >= totalItems - 1 && totalItems < 4) {
      if (navigator.vibrate) navigator.vibrate(30);
      return;
    }

    if (!this.canScroll('next')) {
      if (navigator.vibrate) navigator.vibrate(30);
      return;
    }

    this.isAnimating = true;
    
    let newIndex;
    if (totalItems >= 4) {
      newIndex = (centerIndex + 1) % totalItems;
    } else {
      newIndex = Math.min(centerIndex + 1, totalItems - 1);
    }
    
    if (newIndex === totalItems - 1) {
      StateManager.setAddButtonIndex(newIndex);
    } else {
      StateManager.setCenterIndex(newIndex);
    }

    await new Promise(resolve => setTimeout(resolve, CONFIG.CAROUSEL_TRANSITION_MS));
    this.isAnimating = false;
  }

  async scrollPrev() {
    if (this.isAnimating || !this.isSelectionMode) return;
    if (!this.canScroll('prev')) {
      if (navigator.vibrate) navigator.vibrate(30);
      return;
    }

    this.isAnimating = true;
    const totalItems = this.items.length;
    const centerIndex = StateManager.getCenterIndex();
    
    let newIndex;
    if (totalItems >= 4) {
      newIndex = (centerIndex - 1 + totalItems) % totalItems;
    } else {
      newIndex = Math.max(0, centerIndex - 1);
    }

    if (newIndex === totalItems - 1) {
      StateManager.setAddButtonIndex(newIndex);
    } else {
      StateManager.setCenterIndex(newIndex);
    }

    await new Promise(resolve => setTimeout(resolve, CONFIG.CAROUSEL_TRANSITION_MS));
    this.isAnimating = false;
  }

  getScrollDirection() {
    for (const visibleItem of this.visibleItems) {
      const index = visibleItem.item.index;
      if (this.prevVisibleItemsState.has(index)) {
        const prevPos = this.prevVisibleItemsState.get(index);
        const currPos = visibleItem.position;
        if (currPos < prevPos) return 1;
        if (currPos > prevPos) return -1;
      }
    }
    return 0;
  }

  updatePositions(animate = true) {
    const centerX = this.viewportWidth / 2;
    const centerY = this.viewportHeight / 2;
    const spacing = CONFIG.getCoverSpacing();
    
    const currentCenterIndex = StateManager.getCenterIndex();
    const indexChanged = this.lastCenterIndex !== currentCenterIndex;

    this.items.forEach(item => {
      const isVisible = this.visibleItems.some(vi => vi.item === item);
      if (!this.isSelectionMode && !isVisible) {
        item.container.setVisible(false);
      }
    });

    if (!this.isSelectionMode) {
      this.visibleItems.forEach(({ item, position }) => {
        item.container.setVisible(true);
        const depth = 1000 - Math.abs(position) * 100;
        item.container.setDepth(depth);

        if (position === 0) {
          const playModeScale = 0.6;
          const targetY = centerY + this.playModeOffset;
          item.cover.moveTo(centerX, targetY, playModeScale, 1, animate);
        } else {
          item.cover.moveTo(centerX, centerY, 0, 0, animate);
        }
      });
      this.container.sort('depth');
      this.lastCenterIndex = currentCenterIndex;
      return; 
    }

    let scrollDirection = this.getScrollDirection();
    if (!indexChanged) {
      scrollDirection = 0;
    }

    const currentIndices = new Set(this.visibleItems.map(vi => vi.item.index));
    
    this.prevVisibleItemsState.forEach((prevPos, index) => {
      if (!currentIndices.has(index)) {
        const ghostPos = prevPos - scrollDirection; 
        const targetY = centerY + (ghostPos * spacing);
        const item = this.items.find(i => i.index === index);
        
        if (item) {
          item.container.setVisible(true);
          item.container.setDepth(500);
          const moveCallback = () => {
            item.container.setVisible(false);
          };
          item.cover.moveTo(centerX, targetY, 0, 0, animate, moveCallback);
        }
      }
    });

    this.visibleItems.forEach(({ item, position }) => {
      const container = item.container;
      container.setVisible(true);

      const targetY = centerY + (position * spacing);
      const scale = this.getScaleForPosition(position);
      const depth = 1000 - Math.abs(position) * 100;

      let alpha = this.getAlphaForPosition(position);
      if (item.type === 'add') {
        alpha = Math.min(alpha, 0.8);
      }

      container.setDepth(depth);

      const isEntering = !this.prevVisibleItemsState.has(item.index) && animate;

      if (isEntering && scrollDirection !== 0) {
        const startPos = position + scrollDirection;
        const startY = centerY + (startPos * spacing);
        item.cover.moveTo(centerX, startY, scale * 0.5, 0, false);
        item.cover.moveTo(centerX, targetY, scale, alpha, true);
      } else {
        item.cover.moveTo(centerX, targetY, scale, alpha, animate);
      }
    });

    this.container.sort('depth');
    this.lastCenterIndex = currentCenterIndex;
  }

  getScaleForPosition(position) {
    const absPos = Math.abs(position);
    if (absPos === 0) return 0.7;
    if (absPos === 1) return 0.5;
    return 0.3;
  }

  getAlphaForPosition(position) {
    const absPos = Math.abs(position);
    if (absPos === 0) return 1;
    if (absPos === 1) return 0.8;
    return 0.4;
  }

  getCoverAtPosition(x, y) {
    for (let i = this.visibleItems.length - 1; i >= 0; i--) {
      const { item, position } = this.visibleItems[i];
      if (Math.abs(position) <= 1) { 
        if (item.type === 'add') {
          if (this.addPlaylistCover.containsPoint(x, y)) {
            return { index: item.index, playlistId: null, cover: this.addPlaylistCover, isAddButton: true };
          }
        } else {
          if (item.cover.containsPoint(x, y)) {
            return { index: item.index, playlistId: item.id, cover: item.cover, isAddButton: false };
          }
        }
      }
    }
    return null;
  }

  onResizeInternal = (gameSize) => {
    this.viewportWidth = gameSize.width;
    this.viewportHeight = gameSize.height;
    this.coverSize = CONFIG.getCoverSize();
    this.updatePositions(false);
  }

  destroy() {
    this.scene.scale.off('resize', this.onResizeInternal, this);
    StateManager.off('centerIndexChanged', this.onCenterIndexChanged);
    StateManager.off('playlistsChanged'); 
    StateManager.off('playlistOrderChanged');
    StateManager.off('playlistRemoved');
    
    this.items.forEach(item => item.cover?.destroy?.());
    this.addPlaylistCover?.destroy?.();
    this.container.destroy();
  }
}