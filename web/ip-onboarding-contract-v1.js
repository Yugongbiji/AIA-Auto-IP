// IP Onboarding Contract V1 — 问卷配置与缺失项补问唯一运行时契约。
(function () {
  'use strict';

  const CITY_OPTIONS = Object.freeze([
    '北京','常州','成都','东莞','佛山','广州','杭州','合肥','淮安','惠州','济南','江门','揭阳','廊坊','泸州','茂名','梅州','南京','南通','清远','汕头','上海','韶关','深圳','石家庄','苏州','泰州','唐山','天津','无锡','武汉','襄阳','徐州','盐城','扬州','宜昌','湛江','肇庆','镇江','郑州','中山','重庆','珠海'
  ]);

  const CONTENT_TONE_OPTIONS = Object.freeze([
    '专业理性','亲和温暖','风趣幽默','干练直接','犀利直接','生活化真诚','观点鲜明','沉稳可信','轻松有梗'
  ]);

  const REQUIRED_PROFILE_FIELDS = Object.freeze([
    'primaryGoal','city','customerGroups|recruitmentGroups','customerAges|recruitmentAges',
    'insuranceYears','strengths','honors','education','schoolTier','overseas','contentTone',
    'previousCareer','lifeRoles','hobbies','services','department'
  ]);

  const EXPLICIT_SKIP = new Set(['跳过','不希望填写','暂不填写','不愿填写','不想填写']);

  function usable(value) {
    if (Array.isArray(value)) return value.some((item) => usable(item));
    const normalized = String(value ?? '').trim();
    return Boolean(normalized) || EXPLICIT_SKIP.has(normalized);
  }

  function listRef() {
    if (Array.isArray(typeof questions !== 'undefined' ? questions : null)) return questions;
    if (Array.isArray(window.questions)) return window.questions;
    return null;
  }

  function insertBeforeDepartment(question) {
    const list = listRef();
    if (!list || list.some((item) => item.key === question.key)) return;
    const departmentIndex = list.findIndex((item) => item.key === 'department');
    list.splice(departmentIndex >= 0 ? departmentIndex : list.length, 0, question);
  }

  function ensureIdentityBeforeGoal() {
    const list = listRef();
    if (!list) return;
    const agentIdIndex = list.findIndex((item) => item?.key === 'agentId');
    const goalIndex = list.findIndex((item) => item?.key === 'primaryGoal');
    if (agentIdIndex < 0 || goalIndex < 0 || goalIndex === agentIdIndex + 1) return;
    const [goal] = list.splice(goalIndex, 1);
    const currentAgentIdIndex = list.findIndex((item) => item?.key === 'agentId');
    list.splice(currentAgentIdIndex + 1, 0, goal);
  }

  function ensureQuestionShape() {
    insertBeforeDepartment({
      key: 'previousCareer', label: '过往职业/经历',
      ask: '你过去做过什么工作，或有哪些比较有代表性的长期经历？真实积累也可以帮助确定内容支线。可多选，也可以自己补充。',
      chips: ['教育/教师','医疗健康','法律','财务/会计','互联网/科技','企业经营'], multiple: true, collectIfMissing: true,
    });
    insertBeforeDepartment({
      key: 'lifeRoles', label: '家庭与生活身份',
      ask: '除了保险从业者之外，你还有哪些长期身份？比如宝爸宝妈、创业者、职场人等。可多选，也可以自己补充。',
      chips: ['宝爸','宝妈','创业者','职场人'], multiple: true, collectIfMissing: true,
    });
    insertBeforeDepartment({
      key: 'hobbies', label: '个人爱好',
      ask: '你有哪些真正愿意持续分享的爱好？可多选，也可以自己补充。',
      chips: ['运动健身','骑行','跑步','户外','旅行','摄影','读书','美食'], multiple: true, collectIfMissing: true,
    });
    insertBeforeDepartment({
      key: 'services', label: '可提供服务',
      ask: '你目前真实可以提供哪些服务？可多选，也可以自己补充；只填写你确实能提供的内容。',
      chips: ['保障规划','养老规划','教育规划','财富规划','理赔协助','保单检视'], multiple: true, collectIfMissing: true,
    });
  }

  function configureQuestions() {
    const list = listRef();
    if (!list) return;
    ensureQuestionShape();
    ensureIdentityBeforeGoal();

    const city = list.find((item) => item.key === 'city');
    if (city) {
      city.label = '所在城市';
      city.ask = '请补充你主要服务的城市。';
      city.chips = [...CITY_OPTIONS];
      city.multiple = false;
      city.collectIfMissing = true;
    }

    const education = list.find((item) => item.key === 'education');
    if (education) {
      education.label = '学历';
      education.ask = '你的最高学历是什么？';
      education.chips = ['大专','本科','硕士','博士'];
      education.collectIfMissing = true;
    }

    const tone = list.find((item) => item.key === 'contentTone');
    if (tone) {
      tone.label = '账号表达风格';
      tone.ask = '你希望自己的内容说起话来是什么感觉？可以选 1～2 个最像你的风格，也可以自己补充。这个选择会影响后续的脚本改写风格。';
      tone.chips = [...CONTENT_TONE_OPTIONS];
      tone.multiple = true;
      tone.collectIfMissing = true;
    }

    ['insuranceYears','strengths','honors','schoolTier','overseas','previousCareer','lifeRoles','hobbies','services','department'].forEach((key) => {
      const question = list.find((item) => item.key === key);
      if (question) question.collectIfMissing = true;
    });

    if (typeof labels !== 'undefined') {
      labels.contentTone = '账号表达风格';
      labels.previousCareer = '过往职业/经历';
      labels.lifeRoles = '家庭与生活身份';
      labels.hobbies = '个人爱好';
      labels.services = '可提供服务';
    }
  }

  function firstMissingIndex() {
    const list = listRef();
    if (!list) return -1;
    return list.findIndex((question) => {
      if (!question || question.collectIfMissing === false) return false;
      return !usable(state?.profile?.[question.key]);
    });
  }

  function missingQuestionKeys() {
    const list = listRef();
    if (!list) return [];
    return list.filter((question) => question && question.collectIfMissing !== false && !usable(state?.profile?.[question.key])).map((question) => question.key);
  }

  configureQuestions();

  if (typeof presentQuestion === 'function') {
    const basePresentQuestion = presentQuestion;
    presentQuestion = function contractedPresentQuestion() {
      configureQuestions();
      const missing = firstMissingIndex();
      if (missing >= 0) {
        state.done = false;
        state.currentQuestion = missing;
      }
      return basePresentQuestion();
    };
  }

  window.aiaIpOnboardingContract = Object.freeze({
    cities: CITY_OPTIONS,
    contentToneOptions: CONTENT_TONE_OPTIONS,
    requiredProfileFields: REQUIRED_PROFILE_FIELDS,
    configureQuestions,
    firstMissingIndex,
    missingQuestionKeys,
  });
})();
