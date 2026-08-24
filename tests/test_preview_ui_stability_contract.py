from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FLOAT = (ROOT / 'web' / 'profile-float.js').read_text(encoding='utf-8')


def test_floating_ui_does_not_observe_entire_body_subtree():
    assert "observe(document.body,{subtree:true" not in FLOAT.replace(' ', '')
    assert "visibilityNodes" in FLOAT
    for node_id in [
        'workspace', 'identity-screen', 'ip-chat-panel',
        'proposal-screen', 'content-plan-screen', 'script-detail-screen',
    ]:
        assert node_id in FLOAT
    assert "attributeFilter:['class']" in FLOAT.replace(' ', '')


def test_floating_ui_keeps_single_owner_contract():
    assert 'ownsProfileData:false' in FLOAT
    assert 'syncVisibility' in FLOAT
    assert 'renderProfile=function floatingUiRenderProfile' in FLOAT
