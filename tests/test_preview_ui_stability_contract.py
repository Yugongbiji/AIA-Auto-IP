from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FLOAT = (ROOT / 'web' / 'profile-float.js').read_text(encoding='utf-8')


def test_floating_ui_does_not_observe_entire_body_subtree():
    compact = FLOAT.replace(' ', '')
    assert "observe(document.body,{subtree:true" not in compact
    assert "['workspace','identity-screen','ip-chat-panel']" in compact
    assert "attributeFilter:['class']" in compact
    assert 'proposal-screen' not in FLOAT
    assert 'content-plan-screen' not in FLOAT
    assert 'script-detail-screen' not in FLOAT


def test_floating_ui_keeps_single_owner_contract():
    assert "owner: 'web/profile-float.js'" in FLOAT
    assert 'ownsProfileData: false' in FLOAT
    assert 'independentDrawer: true' in FLOAT
    assert 'function sync()' in FLOAT
    assert 'function renderProfileDrawer()' in FLOAT
    assert 'floatingOwnerRenderProfile' in FLOAT
    assert "document.querySelector('.profile-panel')" not in FLOAT
