// 产品规则 V16（资料缓存兼容层）：只负责 IP 档案刷新恢复。
// 视频号/抖音简介的合规尾部已迁移到 ip-policy-core.js，禁止在这里再次改 proposal.bios。
(function () {
  'use strict';
  const ENV_SCOPE = window.location.pathname === '/preview' || window.location.pathname.startsWith('/preview/') ? 'preview' : 'production';
  const PROFILE_CACHE_KEY = `aia-auto-ip-profile-cache-v1:${ENV_SCOPE}`;

  function readCache() {
    try { return JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || 'null'); }
    catch (_) { return null; }
  }
  function writeCache(profile) {
    if (!profile?.name || !profile?.agentId) return;
    try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ name: profile.name, agentId: profile.agentId, profile, savedAt: Date.now() })); }
    catch (_) { /* local cache is only a refresh fallback */ }
  }
  function mergeMissingFromCache(profile) {
    const cached = readCache();
    if (!cached?.profile || cached.name !== profile?.name || cached.agentId !== profile?.agentId) return profile;
    const merged = { ...cached.profile, ...profile };
    Object.keys(cached.profile).forEach((key) => {
      const current = profile?.[key];
      if ((current === undefined || current === null || current === '') && cached.profile[key]) merged[key] = cached.profile[key];
    });
    return merged;
  }

  if (typeof persistMatchedProfile === 'function') {
    const basePersistMatchedProfileV16 = persistMatchedProfile;
    persistMatchedProfile = async function persistMatchedProfileV16() {
      const result = await basePersistMatchedProfileV16();
      if (state.matched) writeCache(state.profile);
      return result;
    };
  }
  if (typeof startWorkspace === 'function') {
    const baseStartWorkspaceV16 = startWorkspace;
    startWorkspace = function startWorkspaceV16(profile, matched, history = [], proposals = [], planningHistory = [], contentPlans = [], creativeHistory = []) {
      const resolvedProfile = matched ? mergeMissingFromCache(profile || {}) : profile;
      if (matched) writeCache(resolvedProfile);
      return baseStartWorkspaceV16(resolvedProfile, matched, history, proposals, planningHistory, contentPlans, creativeHistory);
    };
  }
  if (typeof completeProfile === 'function') {
    const baseCompleteProfileV16 = completeProfile;
    completeProfile = function completeProfileV16() {
      if (state.matched) { writeCache(state.profile); Promise.resolve(persistMatchedProfile()).catch(() => {}); }
      return baseCompleteProfileV16();
    };
  }

  window.aiaProfileCacheV16 = Object.freeze({ readCache, writeCache, mergeMissingFromCache, key: PROFILE_CACHE_KEY, environment: ENV_SCOPE, ownsBio:false });
})();
