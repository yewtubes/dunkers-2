'use strict';
(() => {
  const canvas = document.getElementById('game');
  const container = document.getElementById('game-container');
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const density = Math.min(window.devicePixelRatio || 1, 1.5);
    // Multiples of 8x5 retain an exact 960:600 rendering aspect. The complete
    // frame is scaled to the fullscreen CSS rectangle, with no side bars or
    // camera-aspect changes. Pointer coordinates use the same canvas bounds.
    const units = Math.max(1, Math.round(Math.min(rect.width / 8, rect.height / 5) * density));
    const width = units * 8, height = units * 5;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  };
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', resize);
  document.addEventListener('fullscreenchange', resize);
  document.addEventListener('webkitfullscreenchange', resize);
  resize();
  // Native fullscreen forces the selected element to the screen's dimensions.
  // Fullscreen the wrapper, then let CSS fill it with the whole game frame.
  for (const method of ['requestFullscreen', 'webkitRequestFullscreen', 'webkitRequestFullScreen']) {
    if (typeof container[method] === 'function') {
      canvas[method] = (...args) => container[method](...args);
    }
  }
})();
