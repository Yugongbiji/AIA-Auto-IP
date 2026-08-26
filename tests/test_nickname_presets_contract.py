import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_57_human_approved_nickname_presets_are_complete_and_unique():
    payload = json.loads(read("data/nickname_presets_20260825.json"))
    records = payload["records"]
    assert payload["count"] == 57
    assert len(records) == 57
    assert len({item["agent_id"] for item in records}) == 57
    assert len({item["name"] for item in records}) == 57
    assert all(item["status"] == "approved" for item in records)
    assert all(item["primary"].strip() for item in records)
    assert all(item["allowAiFallback"] is True for item in records)


def test_runtime_prefers_human_preset_but_keeps_ai_fallback_open():
    owner = read("web/nickname-policy-v1.js")
    assert "function approvedPresetOptions" in owner
    assert "t(preset.status)!=='approved'" in owner
    assert "memoryKind:'preset'" in owner
    assert "if(kind==='preset')score+=100;" in owner
    assert "const allowAi=p.nicknamePreset?.allowAiFallback!==false;" in owner
    assert "if(allowAi&&a&&controlled.length<3)" in owner
    assert "aiFallbackOptions(raw,p,a)" in owner


def test_importer_merges_nickname_preset_without_overwriting_profile():
    importer = read("scripts/import_nickname_presets.py")
    assert 'SELECT profile_json FROM saved_profiles WHERE agent_id = ?' in importer
    assert 'profile["nicknamePreset"] = {' in importer
    assert 'ON CONFLICT(agent_id) DO UPDATE SET' in importer
    assert 'profile_json=excluded.profile_json' in importer
    assert 'verified: {verified}/57' in importer
    assert 'allowAiFallback' in importer
