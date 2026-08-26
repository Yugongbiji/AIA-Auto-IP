// 推荐昵称唯一 Owner。
// 最终顺序：人工首选 → 人工备选 → 受控自然候选 → DeepSeek 受控兜底。
// 用户可见理由只解释“这个昵称为什么好”，不得暴露人工验收、排序权或 AI fallback 等内部产品逻辑。
(function(){
  'use strict';
  const BANNED=/保险|友邦|\bAIA\b|金融|理财|贷款|股票|基金|医疗/i;
  const GENERIC_SUFFIXES=['的小世界','小世界','的日常','聊生活','看世界'];
  const t=v=>String(v??'').trim();
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const missing=v=>/^(无|没有|暂无|未填|未填写|未设置|未提供|不知道|不详|0|NA|N\/A|null|none)$/i.test(t(v));
  const hasChinese=name=>/[\u4e00-\u9fa5]/.test(t(name));
  function normalizeSearchable(name){return t(name).replace(/\s+/g,'').replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g,'');}
  function fullEnglish(name){const n=normalizeSearchable(name);return !!n&&/^[A-Za-z0-9]+$/.test(n)&&/[A-Za-z]/.test(n)&&!/[\u4e00-\u9fa5]/.test(n)&&!/^[0-9]+$/.test(n);}

  function peerAnchors(p){return (p.peerReviewSummary?.topNicknames||[]).filter(x=>!missing(x?.label)).sort((a,b)=>Number(b?.count||1)-Number(a?.count||1)).map(x=>t(x.label));}
  function preferredAnchors(p){const v=t(p.preferredName);return v&&!missing(v)?[v]:[];}
  function existingPersonAnchors(p){const out=[];[p.videoNickname,p.xiaohongshuNickname].map(t).filter(v=>v&&!missing(v)&&!BANNED.test(v)).forEach(value=>{const matches=value.match(/(?:小[\u4e00-\u9fa5]{1,2}|阿[\u4e00-\u9fa5]{1,2}|[\u4e00-\u9fa5]{1,3}(?:姐|哥|老师|妈妈|妈|爸爸|爸|总)|[A-Za-z]{2,12}(?:姐|哥)?)/g)||[];out.push(...matches);});return uniq(out);}
  function naturalNameAnchors(p){const n=t(p.name),out=[];if(!n)return out;if(n.length>=3)out.push(n.slice(-2));out.push(n);return uniq(out).filter(x=>x.length>=2);}
  function anchors(p){return uniq([...peerAnchors(p),...preferredAnchors(p),...existingPersonAnchors(p),...naturalNameAnchors(p)]).filter(x=>x&&!BANNED.test(x)&&x.length<=12);}
  function pickAnchor(p){return anchors(p)[0]||'';}

  function familyIdentity(p){const s=[p.selfIntro,p.identity,p.familyIdentity,p.lifeRoles].map(t).join(' ');return ['四娃爸爸','四个儿子的父亲','二宝妈妈','二孩宝妈','二孩妈妈','宝妈','妈妈','二孩宝爸','二孩爸爸','宝爸','爸爸'].find(x=>s.includes(x))||'';}
  function memorablePeerDescriptor(p){const quotes=(p.peerReviewSummary?.representativeQuotes||[]).map(v=>t(v?.label??v)).join(' '),own=[p.selfIntro,p.strengths].map(t).join(' '),s=`${quotes} ${own}`;return ['有料有趣','爱笑','拼命姑娘','人间清醒','有梗','目标清晰','学霸','情绪稳定'].find(x=>s.includes(x))||'';}
  function descriptorOptions(profile,anchor){const d=memorablePeerDescriptor(profile);return d?[{name:`${d}的${anchor}`,angle:'突出记忆点',reason:`“${d}”来自真实资料或他人反馈，和人物称呼组合后更有辨识度，也比单独称呼更容易记住`,memoryKind:'descriptor'}]:[];}
  function distinctiveOptions(profile,anchor){const s=[profile.selfIntro,profile.interests,profile.hobbies,profile.lifeRoles,Array.isArray(profile.secondaryContent)?profile.secondaryContent.join(' '):profile.secondaryContent].map(t).join(' '),out=[];const add=(name,reason)=>{if(name&&!out.some(x=>x.name===name))out.push({name,angle:'突出记忆点',reason,memoryKind:'distinctive'});};if(/八块腹肌/.test(s)){add(`八块腹肌${anchor}`,'真实、具体的健身特点本身就有强记忆点，和人物称呼放在一起容易形成稳定识别');add(`${anchor}练起来`,'保留人物称呼，同时把长期健身特点变成更自然、更有网感的表达');}if(/手帐/.test(s))add(`手帐控${anchor}`,'长期手帐兴趣鲜明、可持续，昵称短而好记');if(/纪录片/.test(s))add(`纪录片迷${anchor}`,'长期纪录片兴趣有辨识度，能让陌生人快速记住人物特点');if(/攀岩/.test(s))add(`爱攀岩的${anchor}`,'真实长期兴趣和人物称呼结合，自然且有生活记忆点');if(/滑雪/.test(s))add(`爱滑雪的${anchor}`,'真实长期兴趣和人物称呼结合，自然且有生活记忆点');if(/网球/.test(s))add(`网球搭子${anchor}`,'“搭子”表达更生活化，网球又是本人真实长期兴趣，兼顾网感和记忆点');if(/羽毛球/.test(s))add(`羽球搭子${anchor}`,'羽毛球兴趣真实持续，“搭子”表达自然、有亲和力');if(/足球|踢球/.test(s))add(`足球迷${anchor}`,'真实长期兴趣明确，短而容易记');if(/读书|阅读/.test(s))add(`爱读书的${anchor}`,'长期阅读兴趣能形成稳定人物侧面，表达自然');if(/插花/.test(s))add(`爱插花的${anchor}`,'真实兴趣鲜明，昵称有生活感且容易形成画面');if(/咖啡/.test(s))add(`咖啡${anchor}`,'咖啡是本人明确兴趣，组合短、顺口、容易搜索');if(/钓鱼/.test(s))add(`钓鱼${anchor}`,'长期钓鱼兴趣辨识度高，昵称简短直接');return out.slice(0,3);}
  function neutralTopic(p){const s=[p.selfIntro,p.hobbies,Array.isArray(p.secondaryContent)?p.secondaryContent.join(' '):p.secondaryContent].map(t).join(' ');return ['育儿','读书','旅行','跑步','骑行','摄影','户外','运动'].find(x=>s.includes(x))||'';}

  function awkward(name,profile,anchor,{existing=false}={}){const n=t(name).replace(/\s+/g,'');if(!n)return true;const full=t(profile.name).replace(/\s+/g,'');if(full&&anchor&&full!==anchor&&n.includes(full)&&n.includes(anchor))return true;if(new RegExp(`^${anchor}(打|跑|去|做|学|玩|吃|喝|逛)`).test(n))return true;if(!existing&&GENERIC_SUFFIXES.some(s=>n===`${anchor}${s}`))return true;return false;}
  function safeName(name,anchor){const n=normalizeSearchable(name);if(!n||BANNED.test(n)||!anchor||!n.includes(normalizeSearchable(anchor)))return '';if(fullEnglish(n)||!hasChinese(n)||n.length>18)return '';const a=normalizeSearchable(anchor);if(n.split(a).length-1!==1)return '';return n;}
  function existingNickname(profile,anchor){for(const raw of [profile.videoNickname,profile.xiaohongshuNickname].map(t).filter(v=>v&&!missing(v)&&!BANNED.test(v))){const value=normalizeSearchable(raw),a=normalizeSearchable(anchor);if(!value||fullEnglish(value)||!hasChinese(value)||!a)continue;if(value.includes(a)&&value.split(a).length-1===1&&!GENERIC_SUFFIXES.some(s=>value===`${a}${normalizeSearchable(s)}`))return value;}return '';}

  function reasonFor(name,profile,anchor,{existing=false}={}){const n=normalizeSearchable(name),a=normalizeSearchable(anchor),reasons=[];if(a&&n.includes(a)){const peer=peerAnchors(profile).some(x=>normalizeSearchable(x)===a);reasons.push(peer?'用了大家真实叫你的称呼，人物感强，也容易和本人对应':'保留了清晰的人物称呼，识别成本低');}const extra=a?n.replace(a,''):n;if(extra&&extra.length>=2&&!GENERIC_SUFFIXES.some(s=>n.endsWith(normalizeSearchable(s))))reasons.push('称呼之外还有真实记忆点，比单独本名更有辨识度');if(/搭子|控|迷|爱|有梗|人间清醒|练起来/.test(n))reasons.push('表达自然、有一定网感，像真实社交昵称');if(existing)reasons.push('原昵称已经具有人物识别，继续使用有利于保留已有用户记忆');if(n.length<=10)reasons.push('长度利落，好记、好输入，也方便搜索');return uniq(reasons).slice(0,2).join('；')||'中文表达自然、简洁，人物识别和搜索成本较低';}
  function presetReason(name,profile){const matched=anchors(profile).filter(a=>normalizeSearchable(name).includes(normalizeSearchable(a))).sort((a,b)=>b.length-a.length)[0]||'';return reasonFor(name,profile,matched);}
  function approvedPresetOptions(profile){const preset=profile?.nicknamePreset;if(!preset||t(preset.status)!=='approved')return [];const alternatives=Array.isArray(preset.alternatives)?preset.alternatives:(Array.isArray(preset.candidates)?preset.candidates:[]);const names=uniq([t(preset.primary),...alternatives.map(t)]).filter(name=>name&&!BANNED.test(name)&&hasChinese(name)&&name.length<=18);return names.map((name,index)=>({name,angle:index===0?'首选推荐':'备选推荐',reason:presetReason(name,profile),memoryKind:'preset'}));}
  function memoryScore(item,profile,anchor,existing){let score=0;const name=t(item?.name),kind=t(item?.memoryKind);if(kind==='preset')score+=100;if(existing&&name===existing)score+=8;if(kind==='distinctive')score+=6;if(kind==='descriptor')score+=5;if(kind==='plain')score+=1;const peer=peerAnchors(profile).some(x=>normalizeSearchable(x)===normalizeSearchable(anchor));if(peer&&anchor&&name.includes(normalizeSearchable(anchor)))score+=2;if(/\d{3,}$/.test(name))score-=3;if(fullEnglish(name))score-=5;if(GENERIC_SUFFIXES.some(s=>name.endsWith(normalizeSearchable(s))))score-=8;return score;}
  function rankByMemory(candidates,profile,anchor,existing){return candidates.map((item,index)=>({...item,memoryScore:memoryScore(item,profile,anchor,existing),_order:index})).sort((a,b)=>b.memoryScore-a.memoryScore||a._order-b._order).map(({_order,...item})=>item);}

  function controlledOptions(profile){const preset=approvedPresetOptions(profile),a=pickAnchor(profile);if(!a)return preset.slice(0,5);const candidates=[];preset.forEach(item=>{if(!candidates.some(x=>x.name===item.name))candidates.push(item);});const add=(raw,angle,opts={})=>{const name=safeName(raw,a);if(!name||awkward(name,profile,a,opts)||candidates.some(x=>x.name===name))return;candidates.push({name,angle,reason:reasonFor(name,profile,a,opts),memoryKind:opts.memoryKind||''});};const existing=existingNickname(profile,a);if(existing)add(existing,'优先保留',{existing:true,memoryKind:'existing'});descriptorOptions(profile,a).forEach(item=>{const name=safeName(item.name,a);if(name&&!awkward(name,profile,a)&&!candidates.some(x=>x.name===name))candidates.push(item);});distinctiveOptions(profile,a).forEach(item=>{const name=safeName(item.name,a);if(name&&!awkward(name,profile,a)&&!candidates.some(x=>x.name===name))candidates.push(item);});const family=familyIdentity(profile);if(family)add(`${family}${a}`,'突出生活身份',{memoryKind:'distinctive'});const topic=neutralTopic(profile);if(topic&&!['生活','成长'].includes(topic))add(`${topic}搭子${a}`,'突出真实兴趣',{memoryKind:'distinctive'});add(a,'突出人物',{memoryKind:'plain'});return rankByMemory(candidates,profile,a,existing).slice(0,5);}
  function aiFallbackOptions(rawOptions,profile,anchor){if(!anchor||!Array.isArray(rawOptions))return [];const result=[];rawOptions.forEach(item=>{const name=safeName(item?.name??item,anchor);if(!name||awkward(name,profile,anchor)||result.some(x=>x.name===name))return;result.push({name,angle:'补充推荐',reason:reasonFor(name,profile,anchor),memoryKind:'ai'});});return result;}
  function enforce(proposal,profile){
    if(!proposal)return proposal;
    const p=profile||{},raw=Array.isArray(proposal.nicknameOptions)?proposal.nicknameOptions:[],a=pickAnchor(p),controlled=controlledOptions(p);
    const allowAi=p.nicknamePreset?.allowAiFallback!==false;
    if(allowAi&&a&&controlled.length<3)aiFallbackOptions(raw,p,a).forEach(item=>{if(controlled.length<5&&!controlled.some(x=>x.name===item.name))controlled.push(item);});
    const existing=existingNickname(p,a);
    proposal.nicknameOptions=rankByMemory(controlled,p,a,existing).slice(0,5);
    proposal.nicknameNeedsIdentity=!a&&!approvedPresetOptions(p).length;
    return proposal;
  }

  if(typeof renderProposal==='function'){const base=renderProposal;renderProposal=function nicknameOwnerRender(proposal,version){enforce(proposal,state.profile||{});return base(proposal,version);};}
  window.aiaNicknamePolicyV1=Object.freeze({controlledOptions,enforce,BANNED,anchors,pickAnchor,aiFallbackOptions,naturalNameAnchors,awkward,distinctiveOptions,memorablePeerDescriptor,descriptorOptions,normalizeSearchable,fullEnglish,memoryScore,rankByMemory,approvedPresetOptions,presetReason,reasonFor});
})();
