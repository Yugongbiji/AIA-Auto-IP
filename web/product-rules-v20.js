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

  function chip(text) { const node=document.createElement('span'); node.className='strategy-chip'; node.textContent=text; return node; }
  function renderDirectionSection(content, proposal) {
    if (!content) return;
    content.querySelector('.ip-content-strategy')?.remove();
    const dirs = window.currentIpContentDirectionsV20(proposal);
    const section=document.createElement('section'); section.className='ip-content-strategy';
    const head=document.createElement('div'); head.className='ip-strategy-head';
    const words=document.createElement('div'); const eyebrow=document.createElement('p'); eyebrow.className='eyebrow'; eyebrow.textContent='接下来发什么'; const title=document.createElement('h2'); title.textContent='内容方向'; const intro=document.createElement('p'); intro.textContent='根据当前阶段目标和真实资料，确定一个保险主线和一个内容支线。'; words.append(eyebrow,title,intro); head.appendChild(words); section.appendChild(head);
    const grid=document.createElement('div'); grid.className='ip-strategy-grid';
    const insurance=document.createElement('article'); insurance.className='ip-strategy-line ip-strategy-insurance'; const ih=document.createElement('h3'); ih.textContent='保险主线'; const il=document.createElement('div'); il.className='strategy-chip-list'; (dirs.insurance.length?dirs.insurance:['暂未确定']).forEach(x=>il.appendChild(chip(x))); insurance.append(ih,il); grid.appendChild(insurance);
    const branch=document.createElement('article'); branch.className='ip-strategy-line ip-strategy-general'; const bh=document.createElement('h3'); bh.textContent='内容支线'; const bl=document.createElement('div'); bl.className='strategy-chip-list'; (dirs.branch.length?dirs.branch:['暂未确定']).forEach(x=>bl.appendChild(chip(x))); branch.append(bh,bl); if(dirs.branchSource){const source=document.createElement('p'); source.className='strategy-source-note'; source.textContent=`来源：${dirs.branchSource}`; branch.appendChild(source);} grid.appendChild(branch); section.appendChild(grid);
    const action=document.createElement('div'); action.className='ip-to-recommendation'; const button=document.createElement('button'); button.type='button'; button.className='primary'; button.textContent='查看推荐脚本'; button.addEventListener('click',async()=>{document.getElementById('proposal-screen')?.classList.add('hidden');selectTool('recommendation');await window.scriptRecommendationV1?.loadRecommendations?.(true);}); action.appendChild(button); section.appendChild(action); content.appendChild(section);
  }

  if (!document.getElementById('ip-direction-v20-style')) { const style=document.createElement('style'); style.id='ip-direction-v20-style'; style.textContent='.ip-to-recommendation{display:flex;justify-content:center;padding:22px 0 4px}.ip-to-recommendation .primary{min-width:180px}'; document.head.appendChild(style); }
  if (typeof renderProposal === 'function') { const baseRender=renderProposal; renderProposal=function renderProposalV20View(proposal,version){const result=baseRender(proposal,version);renderDirectionSection(document.getElementById('proposal-content'),proposal);return result;}; }
  if (typeof selectTool === 'function') { const baseSelect=selectTool; selectTool=function selectToolV20(tool){const result=baseSelect(tool);if(tool==='recommendation')Promise.resolve(window.scriptRecommendationV1?.loadRecommendations?.(true)).catch(()=>{});return result;}; }
  window.aiaContentDirectionViewV20=Object.freeze({renderDirectionSection,ownsBusinessRules:false});
})();
