'use strict';
// Route only the original game's backend to the local implementation. No upstream proxy.
(() => {
  const nativeFetch = window.fetch.bind(window);
  const gameBase = new URL('.', location.href);
  const backendPath = new URL('backend/', gameBase).pathname;
  const isBackend = url => new URL(url).pathname.startsWith(backendPath);
  const route = input => {
    const url = new URL(input, location.href);
    if (url.hostname === 'd2.touchdowners2.com') return new URL('backend' + url.pathname + url.search, gameBase).href;
    if (url.origin !== location.origin) throw new Error('External request disabled: ' + url.origin);
    return url.href;
  };
  window.fetch = (input, options) => {
    try {
      const url = route(input instanceof Request ? input.url : input);
      const request = input instanceof Request ? new Request(url, input) : url;
      if (isBackend(url) && Number.isSafeInteger(window.dunkersAdminRevision)) {
        const headers = new Headers(options?.headers || (request instanceof Request ? request.headers : undefined));
        headers.set('X-Dunkers-Admin-Revision', String(window.dunkersAdminRevision));
        options = { ...options, headers };
      }
      return nativeFetch(request, options);
    }
    catch (error) { return Promise.reject(error); }
  };
  const nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) { const target = route(url); this.dunkersBackend = isBackend(target); return nativeOpen.call(this, method, target, ...rest); };
  const nativeSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(...args) {
    if (this.dunkersBackend && Number.isSafeInteger(window.dunkersAdminRevision)) this.setRequestHeader('X-Dunkers-Admin-Revision', String(window.dunkersAdminRevision));
    return nativeSend.apply(this, args);
  };
  const noop = () => {};
  window.PokiSDK = {init: () => Promise.resolve(), setDebug: noop, gameLoadingStart: noop, gameLoadingFinished: noop,
    gameLoadingProgress: noop, gameplayStart: noop, gameplayStop: noop, customEvent: noop, logError: console.error,
    isAdBlocked: () => true, getLanguage: () => navigator.language.split('-')[0], displayAd: noop, destroyAd: noop,
    commercialBreak: () => Promise.resolve(), rewardedBreak: () => Promise.resolve(false),
    shareableURL: () => Promise.resolve(gameBase.href)};
  window.initPokiBridge = name => {
    const ready = () => {
      if (!window.unityGame) return setTimeout(ready, 50);
      window.unityGame.SendMessage(name, 'ready');
    };
    window.commercialBreak = () => window.unityGame.SendMessage(name, 'commercialBreakCompleted');
    window.rewardedBreak = () => window.unityGame.SendMessage(name, 'rewardedBreakCompleted', 'false');
    window.shareableURL = () => window.unityGame.SendMessage(name, 'shareableURLResolved', gameBase.href);
    ready();
  };
})();
