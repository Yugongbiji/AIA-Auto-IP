(() => {
 const $=id=>document.getElementById(id);
 const state={active:false,keyword:"",page:1,hasMore:false,pageNotes:[],loaded:new Map(),localSort:null,localDirection:"desc",busy:false,lastSearchKey:"",total:0,pageSize:0,totalPages:0};
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const count=v=>Number(v||0).toLocaleString("zh-CN");
 const date=v=>v?new Date(Number(v)*1000).toLocaleDateString("zh-CN"):"—";
 const allLoaded=()=>Array.from(state.loaded.values());
 function sorted(items){if(!state.localSort)return items;const k=state.localSort;return [...items].sort((a,b)=>(Number(a[k]||0)-Number(b[k]||0))*(state.localDirection==="asc"?1:-1));}
 function status(msg,kind){const n=$("xhs-note-search-status");n.textContent=msg;n.className="xhs-note-search-status"+(kind?" "+kind:"");}
 function renderRows(){
  const body=$("xhs-note-results-body"),items=sorted(state.pageNotes);
  if(!items.length){body.innerHTML='<tr><td colspan="8" class="xhs-note-empty">没有找到笔记，请尝试更换关键词或筛选条件。</td></tr>';return;}
  body.innerHTML=items.map(n=>'<tr><td class="xhs-note-title-cell"><button type="button" class="xhs-note-title" data-note-id="'+esc(n.id)+'" title="点击直接打开小红书原笔记">'+esc(n.title||"（无标题）")+'</button></td><td>'+(n.type==="video"?"视频":"图文")+'</td><td>'+esc(n.author||"—")+'</td><td>'+date(n.timestamp)+'</td><td class="numeric">'+count(n.liked_count)+'</td><td class="numeric">'+count(n.collected_count)+'</td><td class="numeric">'+count(n.comments_count)+'</td><td class="numeric">'+count(n.shared_count)+'</td></tr>').join("");
  body.querySelectorAll("[data-note-id]").forEach(b=>b.addEventListener("click",()=>openOriginal(state.loaded.get(b.dataset.noteId),b)));
 }
 function updateMeta(){
  const totalText=state.total>0?"接口返回总数约 "+count(state.total)+" 条":"接口未提供可用总数";
  $("xhs-note-result-summary").textContent=state.keyword?"关键词："+state.keyword+" · "+totalText:"输入关键词开始搜索";
  const pagesText=state.totalPages>0?"预计共 "+state.totalPages+" 页":"总页数待接口确认";
  const pageText=state.keyword?("第 "+state.page+" 页 / "+pagesText+" · 本页 "+state.pageNotes.length+" 条 · 已加载 "+state.loaded.size+" 条 · "+(state.hasMore?"还有下一页":"已到当前结果末页")):"搜索后显示页码与累计数量";
  $("xhs-note-page-summary").textContent=pageText;
  $("xhs-note-prev").disabled=state.busy||state.page<=1;
  $("xhs-note-next").disabled=state.busy||!state.hasMore;
  $("xhs-note-export").disabled=state.loaded.size===0||state.busy;
  $("xhs-note-export").textContent="导出前"+Math.min(50,state.loaded.size)+"条 Excel";
 }
 async function search(page,fresh=false){
  const keyword=$("xhs-note-keyword").value.trim();if(!keyword){status("请先输入搜索关键词。","error");return;}
  const key=[keyword,$("xhs-note-type").value,$("xhs-note-sort").value,$("xhs-note-time").value].join("|");
  if(fresh||key!==state.lastSearchKey){state.loaded.clear();state.localSort=null;state.localDirection="desc";state.total=0;state.pageSize=0;state.totalPages=0;state.lastSearchKey=key;}
  state.keyword=keyword;state.page=page;state.busy=true;updateMeta();status("正在搜索小红书笔记…");
  const params=new URLSearchParams({keyword,page:String(page),noteType:$("xhs-note-type").value,sortType:$("xhs-note-sort").value,timeFilter:$("xhs-note-time").value});
  try{
   const response=await fetch("/api/xhs-notes/search?"+params.toString()),result=await response.json();
   if(!response.ok||!result.ok)throw new Error(result.error||"搜索失败");
   state.pageNotes=Array.isArray(result.notes)?result.notes:[];
   state.pageNotes.forEach(n=>{if(n&&n.id)state.loaded.set(String(n.id),n);});
   state.hasMore=Boolean(result.has_more);state.total=Number(result.total||0);if(page===1){state.pageSize=state.pageNotes.length;state.totalPages=state.total>0&&state.pageSize>0?Math.ceil(state.total/state.pageSize):0;}
   renderRows();updateMeta();
   status("搜索成功：本页 "+state.pageNotes.length+" 条，累计已加载 "+state.loaded.size+" 条。"+(result.credits_charged?"本次扣除 "+result.credits_charged+" credits。":"费用以 Wellbyte 控制台记录为准。"),"success");
  }catch(e){state.pageNotes=[];state.hasMore=false;renderRows();updateMeta();status(e.message||"搜索失败，请稍后重试。","error");}
  finally{state.busy=false;updateMeta();}
 }
 async function openOriginal(note,button){
  if(!note)return;
  const tab=window.open("about:blank","_blank");
  if(!tab){status("浏览器拦截了新标签页，请允许本站弹出窗口后重试。","error");return;}
  button.disabled=true;status("正在获取原笔记链接…");
  try{
   let url=note.resolvedUrl||"";
   if(!url){
    const response=await fetch("/api/xhs-notes/original-link?"+new URLSearchParams({noteId:note.id}));
    const result=await response.json();
    if(!response.ok||!result.ok||!result.url)throw new Error(result.error||"暂时无法获取原笔记链接");
    const parsed=new URL(result.url),host=parsed.hostname.toLowerCase();
    if(parsed.protocol!=="https:"||(host!=="xiaohongshu.com"&&!host.endsWith(".xiaohongshu.com")))throw new Error("返回的原笔记链接无效");
    url=result.url;note.resolvedUrl=url;
   }
   tab.location.replace(url);status("已打开小红书原笔记。","success");
  }catch(error){
   tab.close();status((error.message||"原笔记链接获取失败")+"；可以稍后重试。","error");
  }finally{button.disabled=false;}
 }
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
  $("xhs-note-search-clear").addEventListener("click",()=>{$("xhs-note-keyword").value="";state.keyword="";state.page=1;state.hasMore=false;state.pageNotes=[];state.loaded.clear();state.lastSearchKey="";state.localSort=null;state.total=0;state.pageSize=0;state.totalPages=0;renderRows();updateMeta();status("已清空搜索条件。");});
  $("xhs-note-prev").addEventListener("click",()=>{if(state.page>1)search(state.page-1);});
  $("xhs-note-next").addEventListener("click",()=>{if(state.hasMore)search(state.page+1);});
  $("xhs-note-export").addEventListener("click",exportExcel);
  document.querySelectorAll("[data-local-sort]").forEach(b=>b.addEventListener("click",()=>{const k=b.dataset.localSort;state.localDirection=state.localSort===k&&state.localDirection==="desc"?"asc":"desc";state.localSort=k;renderRows();}));
  renderRows();updateMeta();
 }
 window.activateXhsNoteSearch=bind;
})();