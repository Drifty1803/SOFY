export class Logger {
  static LEVELS = {
    INFO: { emoji: '📘', color: '#3498db' },
    WARN: { emoji: '⚠️', color: '#f39c12' },
    ERROR: { emoji: '❌', color: '#e74c3c' },
    SUCCESS: { emoji: '✅', color: '#2ecc71' }
  };

  static log(level, tag, message) {
    const { emoji } = this.LEVELS[level] || this.LEVELS.INFO;
    const timestamp = new Date().toISOString().substr(11, 12);
    console.log(`${timestamp} ${emoji} [${tag}] ${message}`);
  }

  static info(tag, message) {
    this.log('INFO', tag, message);
  }

  static warn(tag, message) {
    this.log('WARN', tag, message);
  }

  static error(tag, message) {
    this.log('ERROR', tag, message);
  }

  static success(tag, message) {
    this.log('SUCCESS', tag, message);
  }
}