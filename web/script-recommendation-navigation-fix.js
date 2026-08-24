// 68 根因修复：app.js 的 selectTool 未处理 recommendation，导致点击脚本推荐后面板未显示、数据也未加载。
(function(){
  if(typeof selectTool!=='function')return;
  const baseSelectTool=selectTool;
  selectTool=function(tool){
    if(tool!=='recommendation'){
      document.getElementById('script-recommendation-panel')?.classList.add('hidden');
      return baseSelectTool(tool);
    }
    state.activeTool='recommendation';
    updateWorkspaceHeadings?.();
    document.querySelectorAll('[data-tool]').forEach(button=>button.classList.toggle('active',button.dataset.tool==='recommendation'));
    ['ip-chat-panel','planning-panel','script-panel','xhs-panel','tool-placeholder'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));
    document.getElementById('script-recommendation-panel')?.classList.remove('hidden');
    document.getElementById('generate-button')?.classList.add('hidden');
    document.getElementById('view-proposal')?.classList.add('hidden');
    // 每次进入都按当前 IP/数据库状态加载；失败时推荐模块自己显示明确空态，不再整页空白。
    window.aiaScriptRecommendation?.load?.(true);
  };
})();
