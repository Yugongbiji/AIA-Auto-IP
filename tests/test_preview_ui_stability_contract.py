from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FLOAT = (ROOT / 'web' / 'profile-float.js').read_text(encoding='utf-8')
INDEX = (ROOT / 'web' / 'index.html').read_text(encoding='utf-8')
RELEASE_PREVIEW = (ROOT / 'scripts' / 'release_preview_stable.sh').read_text(encoding='utf-8')
RC_CACHE_VERSION = '20260903-rc1'


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


def test_release_candidate_uses_one_fresh_cache_version_for_all_frontend_assets():
    assert '20260826-release1' not in INDEX
    assert '20260902-owner1' not in INDEX
    assert '20260901-stability1' not in INDEX
    asset_refs = [part for part in INDEX.replace('>', '>\n').splitlines() if '?v=' in part]
    assert asset_refs
    assert all(f'?v={RC_CACHE_VERSION}' in ref for ref in asset_refs)
    assert f'CACHE_VERSION="{RC_CACHE_VERSION}"' in RELEASE_PREVIEW
