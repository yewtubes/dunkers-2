'use strict';
createUnityInstance(document.getElementById('game'), {
  dataUrl: 'Build/193748c60075be5c59dd80c8ec174c65.data',
  frameworkUrl: 'Build/db1ed814a2e6d886f14a5abfb87f5458.framework.js',
  codeUrl: 'Build/78187090b012beed2d50f0f0f2623bf2.wasm',
  streamingAssetsUrl: 'StreamingAssets', companyName: 'PlaybackStudios', productName: 'Dunkers 2', productVersion: '4.5',
  devicePixelRatio: Math.min(devicePixelRatio, 1.5),
  // viewport.js owns the drawing-buffer size; CSS can fill fullscreen without
  // changing Unity's 16:10 camera/UI layout.
  matchWebGLToCanvasSize: false,
  print: message => console.log(message), printErr: message => console.error(message),
}, progress => window.dunkersLoader?.progress(progress)).then(async game => {
  window.unityGame = game;
  await window.dunkersLoader.finish();
  document.getElementById('game').focus();
}).catch(error => {
  const message = document.getElementById('error');
  document.getElementById('loading-screen').hidden = true;
  message.textContent = String(error);
  message.hidden = false;
});
