// ============================================================
// compliance.js
// IP人设智能定位工具 —— 合规检测模块（v3）
// 规则来源：《账号装修合规文档.xlsx》+ 用户补充规则
// 检测维度：昵称 / 简介 / 唯一识别号 / 通用禁区
// ============================================================

const BIO_SENSITIVE_WORDS = [
  '保险', '金融', '理财', '贷款', '股票', '基金', '医疗', '护理',
  '教育', '玄学',
];

const ABSOLUTE_WORDS = [
  '最好', '第一', '唯一', '顶级', '绝对', '保证', '稳赚', '无风险',
  ' guaranteed', '100%', '必赚', '躺赚', '闭眼入',
];

const CONTACT_PATTERNS = [
  /微信[：: ]?\S+/, /微信号/, /手机号/, /电话[：: ]?\d{6,}/,
  /1[3-9]\d{9}/,
  /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/,
  /QQ[：: ]?\d+/, /微博/, /二维码/, /加我/, /私信我领/, /关注我送/,
  /扫码/, /引流/,
];

const BRAND_TERMS = ['友邦', '友邦保险', '友邦人寿', 'AIA', 'YOUBANG', 'YOUBANGBAOXIAN'];
const BRAND_ID_FORBIDDEN = [
  '友邦', '友邦保险', '友邦人寿', '友邦上海', 'AIA', 'AIABJ',
  'AIABEIJING', 'YOUBANG', 'YOUBANGBAOXIAN',
];

const MEDICAL_RISK = ['问诊', '看病', '治病', '疾病名称', '线上问诊', '中医收徒', '医疗咨询'];
const RECRUIT_RISK = ['招募', '招聘', '招友邦合伙人', '寻找友邦合伙人', '招商加盟', '项目投资'];

const COMPLIANCE_STATEMENT = {
  xiaohongshu: '本账号所述内容为个人意见，不代表任何官方意见。',
  videoDouyin: '本账号上所陈述或表达的内容仅为我个人意见，并不代表友邦人寿的意见',
};

const MODIFICATION_LIMITS = {
  videoNickname: '视频号昵称：每年最多可修改 5 次（昵称确定要慎重）',
  videoBio: '微信视频号简介：目前暂无明确修改次数限制',
  xiaohongshuBio: '小红书个人简介：7 天限修改 3 次（频繁修改影响账号权重）',
};

function checkNickname(nickname, ctx = {}) {
  const warnings = [];
  if (/[a-zA-Z]/.test(nickname)) warnings.push('⚠️ 昵称包含英文/拼音，不便记忆与拼写，建议改为纯中文表达。');
  for (const t of BRAND_TERMS) {
    if (nickname.includes(t)) {
      if (ctx.hasAiaRelation) warnings.push(`⚠️ 昵称含"${t}"：须清楚说明与友邦关系并明示分支公司，否则请删除。`);
      else warnings.push(`⚠️ 昵称含"${t}"：未说明与友邦关系，建议移除品牌字。`);
    }
  }
  for (const t of RECRUIT_RISK) {
    if (nickname.includes(t)) warnings.push(`⚠️ 昵称含"${t}"，属招募/招商字样，不符合合规要求。`);
  }
  return warnings;
}

/**
 * @param {string} platform 'xiaohongshu' | 'videoDouyin'
 * @param {string} bio
 * @param {Object} ctx { department, licenseId }
 */
function checkBio(platform, bio, ctx = {}) {
  const warnings = [];

  for (const p of CONTACT_PATTERNS) {
    if (p.test(bio)) warnings.push(`⚠️ 简介含外部联系方式/导流信息（${p}），小红书严禁导流，易被清空。`);
  }
  for (const w of BIO_SENSITIVE_WORDS) {
    if (bio.includes(w)) warnings.push(`⚠️ 简介含敏感行业词"${w}"，可能触发平台合规。`);
  }
  for (const w of ABSOLUTE_WORDS) {
    if (bio.includes(w)) warnings.push(`⚠️ 简介含夸大/绝对化用语"${w}"，禁止过度营销。`);
  }

  if (platform === 'xiaohongshu' && /执业证编号|执业编号|资格证号[：: ]?\S+/.test(bio)) {
    warnings.push('⚠️ 小红书简介含执业证编号，请删除。');
  }
  for (const w of MEDICAL_RISK) {
    if (bio.includes(w)) warnings.push(`⚠️ 简介含"${w}"，疑似医疗引流，高风险。`);
  }
  for (const w of RECRUIT_RISK) {
    if (bio.includes(w)) warnings.push(`⚠️ 简介含"${w}"，禁止以个人名义招募/招商。`);
  }

  let bioForBrandCheck = bio;
  if (platform === 'videoDouyin') bioForBrandCheck = bio.replace(COMPLIANCE_STATEMENT.videoDouyin, '');
  for (const t of BRAND_TERMS) {
    if (bioForBrandCheck.includes(t)) warnings.push(`⚠️ 简介含"${t}"：简介中不可写友邦/AIA（强制合规声明除外）。`);
  }

  const lines = String(bio || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (platform === 'xiaohongshu') {
    if (lines.at(-1) !== COMPLIANCE_STATEMENT.xiaohongshu) {
      warnings.push(`⚠️ 小红书简介最后一句必须是："${COMPLIANCE_STATEMENT.xiaohongshu}"`);
    }
  }

  if (platform === 'videoDouyin') {
    const expectedDepartment = `营销服务部：${ctx.department || 'XXX'}`;
    const expectedLicense = `执业证编号：${ctx.licenseId || '000'}`;
    const tail = lines.slice(-3);
    if (tail[0] !== COMPLIANCE_STATEMENT.videoDouyin || tail[1] !== expectedDepartment || tail[2] !== expectedLicense) {
      warnings.push('⚠️ 视频号/抖音简介末尾必须连续按顺序放置：个人意见声明 → 营销服务部 → 执业证编号。');
    }
  }
  return warnings;
}

function checkUniqueId(idValue) {
  const warnings = [];
  for (const t of BRAND_ID_FORBIDDEN) {
    if (idValue && idValue.toLowerCase().includes(t.toLowerCase())) warnings.push(`⚠️ 账号唯一识别号含"${t}"，公司合规禁止（含拼音/大小写）。`);
  }
  return warnings;
}

function getModificationReminders() {
  return Object.values(MODIFICATION_LIMITS);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    checkNickname, checkBio, checkUniqueId,
    getModificationReminders, COMPLIANCE_STATEMENT, MODIFICATION_LIMITS,
  };
}
