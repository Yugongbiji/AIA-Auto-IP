// 产品规则 V20（内容方向展示层）：只把 ip-policy-core.js 的最终结果渲染到页面，并提供跳转推荐脚本入口。
// 不再自行判断拓客/增员、主线或支线。
(function () {
  'use strict';
  const OMIT = /^(其他|其它|不希望填写|跳过|暂不填写|不愿填写|不想填写)$/;
  if (Array.isArray(questions)) questions.forEach((question) => {
    if (Array.isArray(question.chips)) question.chips = question.chips.filter((chip) => !OMIT.test(String(chip || '').trim()));
  });

  function asList(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (!value) return [];
    return String(value).split(/[｜|、,，;；/\n]+/).map((x) => x.trim()).filter(Boolean);
  }

  window.currentIpContentDirectionsV20 = function (proposal) {
    const p = proposal || state.proposals?.[0]?.proposal || {};
    const insurance = asList(p.contentMainline);
    const branch = asList(p.secondaryContent);
    return { insurance, branch, branchTitle: branch.length ? `内容支线 · ${branch[0]}` : '内容支线', branchSource: p.secondaryContentSource || '', all: [...new Set([...insurance, ...branch])] };
  };

  const COLLECTION_NAMES = Object.freeze({
    '家庭保障':'家庭保障','重疾保障':'重疾保障','医疗保障':'医疗保障','养老规划':'养老规划','财富规划':'财富规划','教育规划':'教育规划','保险知识':'保险科普','增员与职业发展':'职业成长',
    '育儿':'育儿手记','升学教育':'升学攻略','健康养生':'健康日常','创业经营':'创业笔记','财务常识':'财务常识','职场成长':'职场成长','法律常识':'法律常识','科技职场':'科技职场','高尔夫':'高尔夫','网球':'网球日记','骑行':'骑行日记','滑雪':'滑雪日记','运动健身':'运动日记','旅行':'旅行日记','汽车':'汽车生活','摄影':'摄影日记','户外':'户外日记','跑步':'跑步日记','读书':'读书笔记','美食':'美食日记','宠物':'宠物日常','影视娱乐':'影视随笔','智能家居':'智能家居','家居改造':'家居改造','生活日常':'生活日常'
  });

  function chip(text, cls='strategy-chip') { const node=document.createElement('span'); node.className=cls; node.textContent=text; return node; }
  function block(title, values, cls='strategy-chip') {
    const wrap=document.createElement('div'); wrap.className='strategy-block';
    const strong=document.createElement('strong'); strong.textContent=title; wrap.appendChild(strong);
    const list=document.createElement('div'); list.className='strategy-chip-list';
    (values.length?values:['暂未确定']).forEach(value=>list.appendChild(chip(value,cls))); wrap.appendChild(list); return wrap;
  }
  function collectionNames(values){return values.map(v=>{const name=COLLECTION_NAMES[v]||String(v).slice(0,5);return /^《.*》$/.test(name)?name:`《${name}》`;});}
  function renderLine(title, values, kind, source='') {
    const card=document.createElement('article'); card.className=`ip-strategy-line ip-strategy-${kind}`;
    const h=document.createElement('h3'); h.textContent=title; card.appendChild(h);
    card.appendChild(block('内容方向',values));
    card.appendChild(block('合集推荐',collectionNames(values),'strategy-collection-chip'));
    const roles=kind==='insurance'?['建立专业信任','吸引目标客户','推动咨询']:['扩大受众','增加活人感','建立长期记忆点'];
    const action=document.createElement('div'); action.className='strategy-block'; const at=document.createElement('strong'); at.textContent='对账号的作用'; action.appendChild(at);
    const actionList=document.createElement('div'); actionList.className='strategy-action-list'; roles.forEach(v=>actionList.appendChild(chip(v,'strategy-action-tag'))); action.appendChild(actionList); card.appendChild(action);
    if(source){const note=document.createElement('p'); note.className='strategy-source-note'; note.textContent=`来源：${source}`; card.appendChild(note);}
    return card;
  }
  function renderDirectionSection(content, proposal) {
    if (!content) return;
    content.querySelector('.ip-content-strategy')?.remove();
    const dirs = window.currentIpContentDirectionsV20(proposal);
    const section=document.createElement('section'); section.className='ip-content-strategy';
    const head=document.createElement('div'); head.className='ip-strategy-head';
    const words=document.createElement('div'); const eyebrow=document.createElement('p'); eyebrow.className='eyebrow'; eyebrow.textContent='接下来发什么'; const title=document.createElement('h2'); title.textContent='内容方向'; const intro=document.createElement('p'); intro.textContent='根据当前阶段目标和真实资料，确定保险主线和内容支线；生活兴趣不会进入保险主线。'; words.append(eyebrow,title,intro); head.appendChild(words); section.appendChild(head);
    const grid=document.createElement('div'); grid.className='ip-strategy-grid';
    grid.appendChild(renderLine('保险主线',dirs.insurance,'insurance'));
    grid.appendChild(renderLine('内容支线',dirs.branch,'general',dirs.branchSource));
    section.appendChild(grid);
    const reminder=document.createElement('div'); reminder.className='strategy-focus-reminder'; const rt=document.createElement('strong'); rt.textContent='📌 内容聚焦提醒'; const rp=document.createElement('p'); rp.textContent='保险主线负责建立专业信任，内容支线负责增加真实感和长期记忆点；两条线各司其职，不混成一条。'; reminder.append(rt,rp); section.appendChild(reminder);
    const action=document.createElement('div'); action.className='ip-to-recommendation'; const button=document.createElement('button'); button.type='button'; button.className='primary'; button.textContent='查看推荐脚本'; button.addEventListener('click',()=>{document.getElementById('proposal-screen')?.classList.add('hidden');selectTool('recommendation');}); action.appendChild(button); section.appendChild(action); content.appendChild(section);
  }

  if (!document.getElementById('ip-direction-v20-style')) { const style=document.createElement('style'); style.id='ip-direction-v20-style'; style.textContent='.ip-to-recommendation{display:flex;justify-content:center;padding:22px 0 4px}.ip-to-recommendation .primary{min-width:180px}.strategy-block{margin-top:14px}.strategy-block>strong{display:block;margin-bottom:7px}.strategy-action-list{display:flex;flex-wrap:wrap;gap:8px}.strategy-action-tag{display:inline-flex;padding:5px 9px;border-radius:999px;background:#f7f4f5;color:#6a5f63;font-size:12px}.strategy-collection-chip{display:inline-flex;padding:6px 9px;border-radius:999px;background:#fff4f7;color:#a10f39;font-size:12px}.strategy-focus-reminder{margin-top:18px;padding:16px 18px;border:1px solid #eedee3;border-radius:14px;background:#fff}.strategy-focus-reminder p{margin:6px 0 0;color:#6a5f63}'; document.head.appendChild(style); }
  if (typeof renderProposal === 'function') { const baseRender=renderProposal; renderProposal=function renderProposalV20View(proposal,version){const result=baseRender(proposal,version);renderDirectionSection(document.getElementById('proposal-content'),proposal);return result;}; }
  if (typeof selectTool === 'function') { const baseSelect=selectTool; selectTool=function selectToolV20(tool){const result=baseSelect(tool);if(tool==='recommendation')Promise.resolve(window.aiaScriptRecommendation?.load?.(true)).catch(()=>{});return result;}; }
  window.aiaContentDirectionViewV20=Object.freeze({renderDirectionSection,ownsBusinessRules:false});
})();
