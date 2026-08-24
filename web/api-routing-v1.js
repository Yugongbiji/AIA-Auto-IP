// API Routing V1：Preview 所有写入与历史读取统一走 /preview/api，避免刷新后读到正式站历史。
// 仅在 lookup 时从正式 API 只读补充 peerReviewSummary/peerReviewKeywords；不读取正式方案/消息历史。
(function () {
  const nativeFetch = window.fetch.bind(window);
  const preview = window.location.pathname === '/preview' || window.location.pathname.startsWith('/preview/');
  if (!preview || window.__aiaPreviewFetchWrapped) return;
  window.__aiaPreviewFetchWrapped = true;

  function isApiString(input) { return typeof input === 'string' && input.startsWith('/api/'); }
  function previewUrl(url) { return `/preview${url}`; }
  function isLookup(url, init) {
    return String(url || '').startsWith('/api/lookup?') && (!init?.method || String(init.method).toUpperCase() === 'GET');
  }
  async function mergePeerReview(previewResponse, prodPromise) {
    if (!previewResponse.ok) return previewResponse;
    let previewPayload;
    try { previewPayload = await previewResponse.clone().json(); } catch (_) { return previewResponse; }
    if (!previewPayload?.matched || !previewPayload?.profile) return previewResponse;
    try {
      const prodResponse = await prodPromise;
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
      const prodPromise = nativeFetch(input, init); // 只读：仅用于补 peer review 摘要。
      return nativeFetch(previewUrl(input), init).then((response) => mergePeerReview(response, prodPromise));
    }
    return nativeFetch(previewUrl(input), init);
  };
})();
