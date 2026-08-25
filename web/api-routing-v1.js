// API / environment routing：Preview 所有写入、历史读取与本地会话均与正式站隔离。
// lookup 允许短时只读补充正式库 peer review；正式站不可用时 Preview 必须独立继续。
(function () {
  'use strict';
  const nativeFetch = window.fetch.bind(window);
  const preview = window.location.pathname === '/preview' || window.location.pathname.startsWith('/preview/');
  if (!preview || window.__aiaPreviewFetchWrapped) return;
  window.__aiaPreviewFetchWrapped = true;

  const SESSION_KEY = 'aia-auto-ip-session';
  const PREVIEW_SESSION_KEY = 'aia-auto-ip-session:preview';
  if (!window.__aiaPreviewStorageScoped && typeof Storage !== 'undefined') {
    window.__aiaPreviewStorageScoped = true;
    const proto = Storage.prototype;
    const nativeGet = proto.getItem;
    const nativeSet = proto.setItem;
    const nativeRemove = proto.removeItem;
    proto.getItem = function aiaScopedGetItem(key) {
      return nativeGet.call(this, this === window.localStorage && key === SESSION_KEY ? PREVIEW_SESSION_KEY : key);
    };
    proto.setItem = function aiaScopedSetItem(key, value) {
      return nativeSet.call(this, this === window.localStorage && key === SESSION_KEY ? PREVIEW_SESSION_KEY : key, value);
    };
    proto.removeItem = function aiaScopedRemoveItem(key) {
      return nativeRemove.call(this, this === window.localStorage && key === SESSION_KEY ? PREVIEW_SESSION_KEY : key);
    };
  }

  function isApiString(input) { return typeof input === 'string' && input.startsWith('/api/'); }
  function previewUrl(url) { return `/preview${url}`; }
  function isLookup(url, init) {
    return String(url || '').startsWith('/api/lookup?') && (!init?.method || String(init.method).toUpperCase() === 'GET');
  }
  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('optional production lookup timeout')), ms)),
    ]);
  }
  async function mergePeerReview(previewResponse, prodPromise) {
    if (!previewResponse.ok) return previewResponse;
    let previewPayload;
    try { previewPayload = await previewResponse.clone().json(); } catch (_) { return previewResponse; }
    if (!previewPayload?.matched || !previewPayload?.profile) return previewResponse;
    try {
      const prodResponse = await withTimeout(prodPromise, 800);
      if (!prodResponse?.ok) return previewResponse;
      const prodPayload = await prodResponse.json();
      const prodProfile = prodPayload?.profile || {};
      if (prodPayload?.matched && (prodProfile.peerReviewSummary || prodProfile.peerReviewKeywords)) {
        previewPayload.profile = {
          ...previewPayload.profile,
          ...(prodProfile.peerReviewSummary ? { peerReviewSummary: prodProfile.peerReviewSummary } : {}),
          ...(prodProfile.peerReviewKeywords ? { peerReviewKeywords: prodProfile.peerReviewKeywords } : {}),
        };
        return new Response(JSON.stringify(previewPayload), {
          status: previewResponse.status,
          statusText: previewResponse.statusText,
          headers: { 'Content-Type': 'application/json', 'X-AIA-Environment': 'preview' },
        });
      }
    } catch (_) {}
    return previewResponse;
  }

  window.fetch = function aiaEnvironmentFetch(input, init) {
    if (!isApiString(input)) return nativeFetch(input, init);
    if (isLookup(input, init)) {
      const prodPromise = nativeFetch(input, init); // optional read-only supplement; never blocks Preview for long.
      return nativeFetch(previewUrl(input), init).then((response) => mergePeerReview(response, prodPromise));
    }
    return nativeFetch(previewUrl(input), init);
  };
})();
