export class MathUtils {
  static lerp(a, b, t) {
    return a + (b - a) * t;
  }

  static easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  static easeOutQuad(t) {
    return t * (2 - t);
  }

  static easeInQuad(t) {
    return t * t;
  }

  static clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  static degToRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  static radToDeg(radians) {
    return radians * (180 / Math.PI);
  }
}