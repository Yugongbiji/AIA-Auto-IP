// IP Onboarding Contract V1 — 问卷配置与缺失项补问唯一运行时契约。
(function () {
  'use strict';

  const CITY_OPTIONS = Object.freeze([
    '北京','常州','成都','东莞','佛山','广州','杭州','合肥','淮安','惠州','济南','江门','揭阳','廊坊','泸州','茂名','梅州','南京','南通','清远','汕头','上海','韶关','深圳','石家庄','苏州','泰州','唐山','天津','无锡','武汉','襄阳','徐州','盐城','扬州','宜昌','湛江','肇庆','镇江','郑州','中山','重庆','珠海'
  ]);

  const CONTENT_TONE_OPTIONS = Object.freeze([
    '专业理性','亲和温暖','风趣幽默','干练直接','犀利直接','生活化真诚','观点鲜明','沉稳可信','轻松有梗'
  ]);

  const EXPLICIT_SKIP = new Set(['跳过','不希望填写','暂不填写','不愿填写','不想填写']);

  function usable(value) {
    if (Array.isArray(value)) return value.some((item) => usable(item));
    const normalized = String(value ?? '').trim();
    return Boolean(normalized) || EXPLICIT_SKIP.has(normalized);
  }

  function configureQuestions() {
    if (!Array.isArray(window.questions || (typeof questions !== 'undefined' ? questions : null))) return;
    const list = typeof questions !== 'undefined' ? questions : window.questions;

    const city = list.find((item) => item.key === 'city');
    if (city) {
      city.label = '所在城市';
      city.ask = '请补充你主要服务的城市。';
      city.chips = [...CITY_OPTIONS];
      city.multiple = false;
      city.collectIfMissing = true;
    }

    const tone = list.find((item) => item.key === 'contentTone');
    if (tone) {
      tone.label = '账号表达风格';
      tone.ask = '你希望自己的内容说起话来是什么感觉？可以选 1～2 个最像你的风格，也可以自己补充。这个选择会影响后续的脚本改写风格。';
      tone.chips = [...CONTENT_TONE_OPTIONS];
      tone.multiple = true;
      tone.collectIfMissing = true;
    }

    if (typeof labels !== 'undefined') labels.contentTone = '账号表达风格';
  }

  function firstMissingIndex() {
    if (!Array.isArray(questions)) return -1;
    return questions.findIndex((question) => {
      if (!question || question.collectIfMissing === false) return false;
      return !usable(state?.profile?.[question.key]);
    });
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
    configureQuestions,
    firstMissingIndex,
  });
})();
