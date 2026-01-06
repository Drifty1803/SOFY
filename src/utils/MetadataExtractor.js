import { parseBlob } from 'music-metadata';
import { Logger } from './Logger.js';

export class MetadataExtractor {
  static async extractCover(src) {
    try {
      const response = await fetch(src);
      const blob = await response.blob();

      const metadata = await parseBlob(blob);

      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const picture = metadata.common.picture[0];
        const base64String = this._arrayBufferToBase64(picture.data);
        return `data:${picture.format};base64,${base64String}`;
      }
      
      return null;
    } catch (e) {
      return null;
    }
  }

  static _arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}