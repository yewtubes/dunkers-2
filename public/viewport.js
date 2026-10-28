'use strict';
(() => {
  const canvas = document.getElementById('game');
  const container = document.getElementById('game-container');
  // Native fullscreen forces the selected element to the screen's dimensions.
  // Fullscreen the container so Unity's canvas keeps its own aspect ratio and
  // its mouse/touch coordinates continue to match the visible playing area.
  for (const method of ['requestFullscreen', 'webkitRequestFullscreen', 'webkitRequestFullScreen']) {
    if (typeof container[method] === 'function') {
      canvas[method] = (...args) => container[method](...args);
    }
  }
})();
