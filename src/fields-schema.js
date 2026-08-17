// ============================================================
// fields-schema.js
// IP人设智能定位工具 —— 字段来源与采集规范（v3）
// 标记每个字段的来源：questionnaire(问卷) / backendExcel(后台Excel) / toCollect(建议收集)
// ============================================================

const FIELD_SCHEMA = {
  // A. 来自已收回问卷（57人，持续补充）
  name:              { label: '姓名',                  source: 'questionnaire', note: '与后台Excel交叉校验' },
  agentId:           { label: '营销员编号',            source: 'questionnaire', note: '' },
  trainingConfirm:   { label: '培训确认',              source: 'questionnaire', note: '全勤线下培训+社群陪跑要求' },
  selfIntro:         { label: '简单自我介绍(自媒体优势)', source: 'questionnaire', note: '★核心输入，喂判断轮' },
  videoNickname:     { label: '微信视频号昵称',        source: 'questionnaire', note: '' },
  videoId:           { label: '微信视频号ID',          source: 'questionnaire', note: '唯一识别号，禁含友邦拼音' },
  videoFans:         { label: '微信视频号粉丝数',      source: 'questionnaire', note: '' },
  xhsId:             { label: '小红书号',              source: 'questionnaire', note: '唯一识别号，禁含友邦拼音' },
  xhsFans:           { label: '小红书粉丝数',          source: 'questionnaire', note: '' },
  xhsLink:           { label: '小红书主页链接',        source: 'questionnaire', note: '' },
  results:           { label: '自媒体成效(缘故/转介绍/业绩)', source: 'questionnaire', note: '喂成就维度' },
  purpose:           { label: '做自媒体主要目的',      source: 'questionnaire', note: '★喂简介诉求段' },
  status:            { label: '当前账号运营状态',      source: 'questionnaire', note: '' },
  painpoints:        { label: '运营卡点(可多选)',      source: 'questionnaire', note: 'Phase2内容规划用' },
  timeInvest:        { label: '每周愿投入时间',        source: 'questionnaire', note: '' },
  planB:             { label: '未达预期打算',          source: 'questionnaire', note: '' },

  // B. 来自后台 Excel（可批量获取）
  age:               { label: '年龄',                  source: 'backendExcel', note: '建议收集(若后台无)' },
  city:              { label: '城市',                  source: 'backendExcel', note: '★喂地域维度' },

  // C. 建议补充收集（决定人设深度，优先收集）
  education:         { label: '学历',                  source: 'toCollect', note: '本科/硕士/博士' },
  schoolTier:        { label: '最高学校背景',          source: 'toCollect', note: '985/211/QS50/QS100/校名；学历维度关键' },
  overseas:          { label: '是否有留学背景',        source: 'toCollect', note: '是/否+留学院校；留学=学历可突出' },
  insuranceYears:    { label: '保险从业时间',          source: 'toCollect', note: '喂专业维度' },
  honors:            { label: '荣誉',                  source: 'toCollect', note: 'MDRT/TOT/COT/五星会员；喂成就维度' },
  skills:            { label: '擅长领域',              source: 'toCollect', note: '教育金/养老/资产传承；喂专业维度' },
};

// 按来源分组，便于前端渲染
function fieldsBySource() {
  const groups = { questionnaire: [], backendExcel: [], toCollect: [] };
  for (const [key, v] of Object.entries(FIELD_SCHEMA)) groups[v.source].push({ key, ...v });
  return groups;
}

// 浏览器环境下导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FIELD_SCHEMA, fieldsBySource };
}
