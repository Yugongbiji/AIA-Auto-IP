(() => {
 const $=id=>document.getElementById(id);
 const state={active:false,keyword:"",page:1,hasMore:false,pageNotes:[],loaded:new Map(),localSort:null,localDirection:"desc",busy:false,lastSearchKey:""};
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const count=v=>Number(v||0).toLocaleString("zh-CN");
 const date=v=>v?new Date(Number(v)*1000).toLocaleDateString("zh-CN"):"—";
 const allLoaded=()=>Array.from(state.loaded.values());
 function sorted(items){if(!state.localSort)return items;const k=state.localSort;return [...items].sort((a,b)=>(Number(a[k]||0)-Number(b[k]||0))*(state.localDirection==="asc"?1:-1));}
 function status(msg,kind){const n=$("xhs-note-search-status");n.textContent=msg;n.className="xhs-note-search-status"+(kind?" "+kind:"");}
 function renderRows(){
  const body=$("xhs-note-results-body"),items=sorted(state.pageNotes);
  if(!items.length){body.innerHTML='<tr><td colspan="8" class="xhs-note-empty">没有找到笔记，请尝试更换关键词或筛选条件。</td></tr>';return;}
  body.innerHTML=items.map(n=>'<tr><td class="xhs-note-title-cell"><button type="button" class="xhs-note-title" data-note-id="'+esc(n.id)+'">'+esc(n.title||"（无标题）")+'</button></td><td>'+(n.type==="video"?"视频":"图文")+'</td><td>'+esc(n.author||"—")+'</td><td>'+date(n.timestamp)+'</td><td class="numeric">'+count(n.liked_count)+'</td><td class="numeric">'+count(n.collected_count)+'</td><td class="numeric">'+count(n.comments_count)+'</td><td class="numeric">'+count(n.shared_count)+'</td></tr>').join("");
  body.querySelectorAll("[data-note-id]").forEach(b=>b.addEventListener("click",()=>openDrawer(state.loaded.get(b.dataset.noteId))));
 }
 function updateMeta(){
  $("xhs-note-result-summary").textContent=state.keyword?"关键词："+state.keyword+" · 已获取 "+state.loaded.size+" 条":"输入关键词开始搜索";
  $("xhs-note-page-summary").textContent=state.keyword?"第 "+state.page+" 页 · 本页 "+state.pageNotes.length+" 条 · 已加载 "+state.loaded.size+" 条":"尚未搜索";
  $("xhs-note-prev").disabled=state.busy||state.page<=1;$("xhs-note-next").disabled=state.busy||!state.hasMore;
  $("xhs-note-export").disabled=state.loaded.size===0||state.busy;$("xhs-note-export").textContent="导出前"+Math.min(50,state.loaded.size)+"条 Excel";
 }
 async function search(page,fresh=false){
  const keyword=$("xhs-note-keyword").value.trim();if(!keyword){status("请先输入搜索关键词。","error");return;}
  const key=[keyword,$("xhs-note-type").value,$("xhs-note-sort").value,$("xhs-note-time").value].join("|");
  if(fresh||key!==state.lastSearchKey){state.loaded.clear();state.localSort=null;state.localDirection="desc";state.lastSearchKey=key;}
  state.keyword=keyword;state.page=page;state.busy=true;updateMeta();status("正在搜索小红书笔记…");
  const params=new URLSearchParams({keyword,page:String(page),noteType:$("xhs-note-type").value,sortType:$("xhs-note-sort").value,timeFilter:$("xhs-note-time").value});
  try{
   const response=await fetch("/api/xhs-notes/search?"+params.toString()),result=await response.json();
   if(!response.ok||!result.ok)throw new Error(result.error||"搜索失败");
   state.pageNotes=Array.isArray(result.notes)?result.notes:[];state.pageNotes.forEach(n=>{if(n&&n.id)state.loaded.set(String(n.id),n);});
   state.hasMore=Boolean(result.has_more);renderRows();updateMeta();
   status("搜索成功：本页 "+state.pageNotes.length+" 条，累计已加载 "+state.loaded.size+" 条。"+(result.credits_charged?"本次扣除 "+result.credits_charged+" credits。":"费用以 Wellbyte 控制台记录为准。"),"success");
  }catch(e){state.pageNotes=[];state.hasMore=false;renderRows();status(e.message||"搜索失败，请稍后重试。","error");}
  finally{state.busy=false;updateMeta();}
 }
 function openDrawer(n){
  if(!n)return;const cover=n.cover?'<img class="xhs-note-cover" src="'+esc(n.cover)+'" alt="笔记封面" loading="lazy">':"";
  $("xhs-note-drawer-content").innerHTML=cover+'<div class="xhs-note-drawer-meta">'+esc(n.author||"作者未提供")+' · '+date(n.timestamp)+' · '+(n.type==="video"?"视频":"图文")+'</div><div class="xhs-note-drawer-stats"><span>点赞<strong>'+count(n.liked_count)+'</strong></span><span>收藏<strong>'+count(n.collected_count)+'</strong></span><span>评论<strong>'+count(n.comments_count)+'</strong></span><span>分享<strong>'+count(n.shared_count)+'</strong></span></div><h4>'+esc(n.title||"（无标题）")+'</h4><p class="xhs-note-description">'+esc(n.desc||"接口未返回正文摘要。")+'</p><p class="xhs-note-id">笔记ID：'+esc(n.id)+'</p>';
  const original=$("xhs-note-open-original");
  original.removeAttribute("href");original.dataset.noteId=n.id;original.textContent="获取原笔记链接（按需查询）";
  $("xhs-note-copy-id").dataset.noteId=n.id;$("xhs-note-copy-id").textContent="复制笔记ID";
  $("xhs-note-drawer").classList.remove("hidden");$("xhs-note-drawer").setAttribute("aria-hidden","false");document.body.classList.add("xhs-note-drawer-open");
 }
 function closeDrawer(){$("xhs-note-drawer").classList.add("hidden");$("xhs-note-drawer").setAttribute("aria-hidden","true");document.body.classList.remove("xhs-note-drawer-open");}
 async function exportExcel(){
  const notes=sorted(allLoaded()).slice(0,50);if(!notes.length)return;
  $("xhs-note-export").disabled=true;status("正在生成 Excel（"+notes.length+" 条）…");
  try{
   const response=await fetch("/api/xhs-notes/export",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({notes})});
   if(!response.ok){const r=await response.json().catch(()=>({}));throw new Error(r.error||"导出失败");}
   const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="小红书笔记搜索结果.xlsx";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
   status("Excel 已生成，共 "+notes.length+" 条笔记。","success");
  }catch(e){status(e.message||"Excel 导出失败。","error");}finally{updateMeta();}
 }
 function bind(){
  if(state.active)return;state.active=true;
  $("xhs-note-search-form").addEventListener("submit",e=>{e.preventDefault();search(1,true);});
  $("xhs-note-search-clear").addEventListener("click",()=>{$("xhs-note-keyword").value="";state.keyword="";state.page=1;state.hasMore=false;state.pageNotes=[];state.loaded.clear();state.lastSearchKey="";state.localSort=null;renderRows();updateMeta();status("已清空搜索条件。");});
  $("xhs-note-prev").addEventListener("click",()=>{if(state.page>1)search(state.page-1);});
  $("xhs-note-next").addEventListener("click",()=>{if(state.hasMore)search(state.page+1);});
  $("xhs-note-export").addEventListener("click",exportExcel);
  $("xhs-note-open-original").addEventListener("click",async e=>{
   e.preventDefault();const link=$("xhs-note-open-original"),id=link.dataset.noteId;
   if(!id||link.dataset.busy==="1")return;
   if(link.dataset.cachedId===id&&link.dataset.cachedUrl){window.open(link.dataset.cachedUrl,"_blank","noopener,noreferrer");return;}
   link.dataset.busy="1";link.textContent="正在查询原笔记链接…";
   try{
    const response=await fetch("/api/xhs-notes/original-link?"+new URLSearchParams({noteId:id}));
    const result=await response.json();
    if(!response.ok||!result.ok)throw new Error(result.error||"详情接口查询失败");
    if(!result.url){link.textContent="未获取到可验证链接，请复制笔记ID";return;}
    const parsed=new URL(result.url),host=parsed.hostname.toLowerCase();
    if(parsed.protocol!=="https:"&&parsed.protocol!=="http:")throw new Error("链接格式不正确");
    if(host!=="xiaohongshu.com"&&!host.endsWith(".xiaohongshu.com"))throw new Error("链接域名不可信");
    link.dataset.cachedId=id;link.dataset.cachedUrl=result.url;
    link.textContent="打开小红书原笔记 ↗";
    window.open(result.url,"_blank","noopener,noreferrer");
   }catch(error){link.textContent="无法获取链接，请复制笔记ID";status(error.message||"原笔记链接获取失败","error");}
   finally{link.dataset.busy="0";}
  });

  document.querySelectorAll("[data-local-sort]").forEach(b=>b.addEventListener("click",()=>{const k=b.dataset.localSort;state.localDirection=state.localSort===k&&state.localDirection==="desc"?"asc":"desc";state.localSort=k;renderRows();}));
  $("xhs-note-drawer-close").addEventListener("click",closeDrawer);$("xhs-note-drawer-backdrop").addEventListener("click",closeDrawer);
  $("xhs-note-copy-id").addEventListener("click",async()=>{const id=$("xhs-note-copy-id").dataset.noteId||"";try{await navigator.clipboard.writeText(id);$("xhs-note-copy-id").textContent="已复制";}catch(_){$("xhs-note-copy-id").textContent=id;}});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("xhs-note-drawer").classList.contains("hidden"))closeDrawer();});
  renderRows();updateMeta();
 }
 window.activateXhsNoteSearch=bind;
})();