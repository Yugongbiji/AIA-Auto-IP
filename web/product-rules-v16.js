// 产品规则 V16：增强 IP 档案刷新恢复；统一视频号/抖音简介末尾合规顺序并去重。
(function () {
  const PROFILE_CACHE_KEY = 'aia-auto-ip-profile-cache-v1';

  function readCache() {
    try { return JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || 'null'); }
    catch (_) { return null; }
  }

  function writeCache(profile) {
    if (!profile?.name || !profile?.agentId) return;
    try {
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
        name: profile.name,
        agentId: profile.agentId,
        profile,
        savedAt: Date.now(),
      }));
    } catch (_) { /* local cache is only a refresh fallback */ }
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
      if (state.matched) {
        writeCache(state.profile);
        Promise.resolve(persistMatchedProfile()).catch(() => {});
      }
      return baseCompleteProfileV16();
    };
  }

  const DECLARATION = '📌 本账号上所陈述或表达的内容仅为我个人意见，并不代表友邦人寿的意见';

  function normalizeDepartment(profile) {
    const value = String(profile?.department || '').trim();
    return value ? `营销服务部：${value}` : '营销服务部：待补充';
  }

  function normalizeLicense(profile) {
    const known = String(profile?.licenseNumber || profile?.practiceLicense || '').trim();
    return `执业证编号：${known || '000'}`;
  }

  function isComplianceLine(line) {
    const text = String(line || '').replace(/\s+/g, '');
    return /个人意见|友邦人寿|营销服务部|执业证|执业编号|职业编号|从业编号/.test(text);
  }

  function normalizeVideoBios(proposal, profile) {
    const variants = proposal?.bios?.videoDouyin;
    if (!Array.isArray(variants)) return;
    variants.forEach((variant) => {
      if (!variant || !Array.isArray(variant.lines)) return;
      const body = variant.lines
        .map((line) => String(line || '').trim())
        .filter(Boolean)
        .filter((line) => !isComplianceLine(line));
      variant.lines = [
        ...body,
        DECLARATION,
        normalizeDepartment(profile),
        normalizeLicense(profile),
      ];
    });
  }

  if (typeof renderProposal === 'function') {
    const baseRenderProposalV16 = renderProposal;
    renderProposal = function renderProposalV16(proposal, version) {
      normalizeVideoBios(proposal, state.profile || {});
      return baseRenderProposalV16(proposal, version);
    };
  }

  window.normalizeVideoBiosV16 = normalizeVideoBios;
})();
