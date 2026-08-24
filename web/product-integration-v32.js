// V32 回归修复：脚本推荐入口必须真实切换到推荐面板并触发加载。
// 根因：app.js 的 selectTool() 没有 recommendation 分支；这里在最终集成层统一兜底，避免再出现空白页。
(function(){
  if(typeof selectTool!=='function')return;
  const baseSelectTool=selectTool;

  function recommendationPanel(){return document.getElementById('script-recommendation-panel');}
  function setRecommendationVisible(visible){recommendationPanel()?.classList.toggle('hidden',!visible);}

  selectTool=function(tool){
    if(tool!=='recommendation'){
      setRecommendationVisible(false);
      return baseSelectTool(tool);
    }

    state.activeTool='recommendation';
    if(typeof updateWorkspaceHeadings==='function')updateWorkspaceHeadings();
    document.querySelectorAll('[data-tool]').forEach(button=>button.classList.toggle('active',button.dataset.tool==='recommendation'));

    ['ip-chat-panel','planning-panel','script-panel','xhs-panel','tool-placeholder'].forEach(id=>document.getElementById(id)?.classList.add('hidden'));
    setRecommendationVisible(true);
    document.getElementById('generate-button')?.classList.add('hidden');
    document.getElementById('view-proposal')?.classList.add('hidden');

    // 有 IP 时走个性化推荐；无 IP 时组件内部自动走完整脚本库浏览。
    if(window.aiaScriptRecommendation?.load){
      window.aiaScriptRecommendation.load(false);
    }else{
      const body=document.getElementById('script-recommendation-body');
      if(body)body.innerHTML='<div class="script-recommendation-empty">脚本推荐组件暂时没有加载成功，请刷新页面后重试。</div>';
    }
  };

  window.aiaProductIntegrationV32={setRecommendationVisible};
})();
