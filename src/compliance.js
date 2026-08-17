// ============================================================
// compliance.js
// IP人设智能定位工具 —— 合规检测模块（v2 补全版）
// 规则来源：《账号装修合规文档.xlsx》+ 用户补充的修改次数提醒
// 检测维度：昵称 / 简介 / 唯一识别号 / 通用禁区
// ============================================================

// ---------- 1. 敏感词与禁区 ----------
// 简介中绝对不能出现的行业敏感词（小红书平台，严格按合规文档）
// 注意：养老规划师是合规允许的称谓，故"养老规划"不列入敏感词
const BIO_SENSITIVE_WORDS = [
  '保险', '金融', '理财', '贷款', '股票', '基金', '医疗', '护理',
  '教育', '玄学',
];

// 绝对化 / 夸大宣传用语
const ABSOLUTE_WORDS = [
  '最好', '第一', '唯一', '顶级', '绝对', '保证', '稳赚', '无风险',
  ' guaranteed', '100%', '必赚', '躺赚', '闭眼入',
];

// 外部联系方式 / 导流信息
const CONTACT_PATTERNS = [
  /微信[：: ]?\S+/, /微信号/, /手机号/, /电话[：: ]?\d{6,}/,
  /1[3-9]\d{9}/, // 手机号
  /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/, // 邮箱
  /QQ[：: ]?\d+/, /微博/, /二维码/, /加我/, /私信我领/, /关注我送/,
  /扫码/, /引流/,
];

// 品牌字（简介/昵称需谨慎，唯一识别号禁止）
const BRAND_TERMS = ['友邦', '友邦保险', '友邦人寿', 'AIA', 'YOUBANG', 'YOUBANGBAOXIAN'];
const BRAND_ID_FORBIDDEN = [
  '友邦', '友邦保险', '友邦人寿', '友邦上海', 'AIA', 'AIABJ',
  'AIABEIJING', 'YOUBANG', 'YOUBANGBAOXIAN',
];

// 医疗引流 / 招商加盟 风险词
const MEDICAL_RISK = ['问诊', '看病', '治病', '疾病名称', '线上问诊', '中医收徒', '医疗咨询'];
const RECRUIT_RISK = ['招募', '招聘', '招友邦合伙人', '寻找友邦合伙人', '招商加盟', '项目投资'];

// ---------- 2. 合规声明模板 ----------
const COMPLIANCE_STATEMENT = {
  xiaohongshu: '本账号所述内容为个人意见，不代表任何官方意见。',
  videoDouyin: '本账号上所陈述或表达的内容仅为我个人意见，并不代表友邦人寿的意见',
};

// ---------- 3. 修改次数提醒（用户新增）----------
const MODIFICATION_LIMITS = {
  videoNickname: '视频号昵称：每年最多可修改 5 次（昵称确定要慎重）',
  videoBio: '微信视频号简介：目前暂无明确修改次数限制',
  xiaohongshuBio: '小红书个人简介：7 天限修改 3 次（频繁修改影响账号权重）',
};

// ---------- 4. 检测函数 ----------

/**
 * 检测昵称合规性
 * @param {string} nickname 昵称
 * @param {Object} ctx { hasAiaRelation: boolean }
 */
function checkNickname(nickname, ctx = {}) {
  const warnings = [];
  // 英文/拼音检测（尽量不用）
  if (/[a-zA-Z]/.test(nickname)) {
    warnings.push('⚠️ 昵称包含英文/拼音，不便记忆与拼写，建议改为纯中文表达。');
  }
  // 品牌字检测
  for (const t of BRAND_TERMS) {
    if (nickname.includes(t)) {
      if (ctx.hasAiaRelation) {
        warnings.push(`⚠️ 昵称含"${t}"：须清楚说明与友邦关系并明示分支公司（如"友邦人寿上海XXX保险营销团队XXX"），否则请删除。`);
      } else {
        warnings.push(`⚠️ 昵称含"${t}"：未说明与友邦关系，建议移除品牌字。`);
      }
    }
  }
  // 招募/招商
  for (const t of RECRUIT_RISK) {
    if (nickname.includes(t)) warnings.push(`⚠️ 昵称含"${t}"，属招募/招商字样，不符合合规要求。`);
  }
  return warnings;
}

/**
 * 检测简介合规性
 * @param {string} platform 'xiaohongshu' | 'videoDouyin'
 * @param {string} bio 简介文本
 * @param {Object} ctx { department, agentId }
 */
function checkBio(platform, bio, ctx = {}) {
  const warnings = [];

  // 联系方式 / 导流
  for (const p of CONTACT_PATTERNS) {
    if (p.test(bio)) warnings.push(`⚠️ 简介含外部联系方式/导流信息（${p}），小红书严禁导流，易被清空。`);
  }
  // 行业敏感词（小红书尤甚）
  for (const w of BIO_SENSITIVE_WORDS) {
    if (bio.includes(w)) warnings.push(`⚠️ 简介含敏感行业词"${w}"，可能触发平台合规（简介里"保险"尤忌）。`);
  }
  // 绝对化用语
  for (const w of ABSOLUTE_WORDS) {
    if (bio.includes(w)) warnings.push(`⚠️ 简介含夸大/绝对化用语"${w}"，禁止过度营销。`);
  }
  // 执业证编号
  if (/执业证编号|执业编号|资格证号[：: ]?\S+/.test(bio)) {
    warnings.push('⚠️ 简介含执业证编号，小红书平台禁止，请删除。');
  }
  // 医疗引流
  for (const w of MEDICAL_RISK) {
    if (bio.includes(w)) warnings.push(`⚠️ 简介含"${w}"，疑似医疗引流，高风险。`);
  }
  // 招募/招商
  for (const w of RECRUIT_RISK) {
    if (bio.includes(w)) warnings.push(`⚠️ 简介含"${w}"，禁止以个人名义招募/招商。`);
  }
  // 品牌字（简介禁友邦/AIA；但视频号合规声明含"友邦人寿"属强制合规，不算违规）
  let bioForBrandCheck = bio;
  if (platform === 'videoDouyin') {
    bioForBrandCheck = bio.replace('并不代表友邦人寿的意见', ''); // 合规声明中的不算违规
  }
  for (const t of BRAND_TERMS) {
    if (bioForBrandCheck.includes(t)) {
      warnings.push(`⚠️ 简介含"${t}"：简介中不可写友邦/AIA（视频和图文笔记可以，简介例外）。`);
    }
  }
  // 合规声明完整性
  if (platform === 'xiaohongshu') {
    if (!bio.includes(COMPLIANCE_STATEMENT.xiaohongshu)) {
      warnings.push('⚠️ 小红书简介缺少合规声明："本账号所述内容为个人意见，不代表任何官方意见。"');
    }
  }
  if (platform === 'videoDouyin') {
    if (!bio.includes('并不代表友邦人寿的意见')) {
      warnings.push('⚠️ 视频号/抖音简介缺少合规声明："并不代表友邦人寿的意见" + 营销服务部 + 编号。');
    }
    if (ctx.department && !bio.includes(ctx.department)) {
      warnings.push(`⚠️ 简介未注明营销服务部（应为：${ctx.department}）。`);
    }
    if (ctx.agentId && !bio.includes(ctx.agentId)) {
      warnings.push(`⚠️ 简介未注明营销员编号（应为：${ctx.agentId}）。`);
    }
  }
  return warnings;
}

/**
 * 检测账号唯一识别号（微信号/小红书号/抖音号）
 */
function checkUniqueId(idValue) {
  const warnings = [];
  for (const t of BRAND_ID_FORBIDDEN) {
    if (idValue && idValue.toLowerCase().includes(t.toLowerCase())) {
      warnings.push(`⚠️ 账号唯一识别号含"${t}"，公司合规禁止（含拼音/大小写）。`);
    }
  }
  return warnings;
}

/**
 * 汇总提醒（修改次数）
 */
function getModificationReminders() {
  return Object.values(MODIFICATION_LIMITS);
}

// 浏览器环境下导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    checkNickname, checkBio, checkUniqueId,
    getModificationReminders, COMPLIANCE_STATEMENT, MODIFICATION_LIMITS,
  };
}
