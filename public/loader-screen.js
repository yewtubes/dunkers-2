'use strict';
(() => {
  const screen = document.getElementById('loading-screen');
  const tile = screen.querySelector('.console-tile');
  let progress = 0, start, finishing = false;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  function update(value) {
    progress = Math.max(progress, Math.min(1, Number(value) || 0));
    screen.style.setProperty('--load-progress', progress);
    screen.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
  }
  function pan(value) { tile.style.setProperty('--pan', Math.max(-1, Math.min(1, value))); }
  screen.addEventListener('pointerdown', event => { if (finishing) return; start = event.clientX; screen.setPointerCapture(event.pointerId); });
  screen.addEventListener('pointermove', event => { if (start !== undefined) pan((event.clientX - start) / 180); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) screen.addEventListener(event, () => { start = undefined; pan(0); });
  screen.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); pan(event.key === 'ArrowLeft' ? -0.65 : 0.65); }
  });
  screen.addEventListener('keyup', () => pan(0));
  window.dunkersLoader = {
    progress: update,
    async finish() {
      finishing = true; update(1); pan(0);
      if (!motion.matches) {
        screen.classList.add('is-ready');
        await new Promise(resolve => {
          const done = event => { if (event && event.target !== screen) return; screen.removeEventListener('transitionend', done); resolve(); };
          screen.addEventListener('transitionend', done);
          setTimeout(done, 700);
        });
      }
      screen.hidden = true;
    },
  };
})();
