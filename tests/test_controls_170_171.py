import json

import server


def use_isolated_sqlite(monkeypatch, tmp_path):
    monkeypatch.setenv("DB_ENGINE", "sqlite")
    monkeypatch.setattr(server, "DB_PATH", tmp_path / "persona.sqlite3")
    server.initialize_database()
    with server.database() as conn:
        conn.execute(
            "INSERT INTO agents(agent_id, name, survey_json, imported_at) VALUES (?, ?, ?, ?)",
            ("135792468", "王小明", json.dumps({"name": "王小明", "agentId": "135792468", "selfIntro": "报名时填写的介绍", "peerReviewSummary": {"reviewCount": 2}}), "now"),
        )


def test_reset_dialogue_workspace_keeps_imported_and_feedback_data(monkeypatch, tmp_path):
    use_isolated_sqlite(monkeypatch, tmp_path)
    assert server.save_profile("135792468", {"name": "王小明", "agentId": "135792468", "city": "杭州", "customerGroups": "宝爸宝妈", "generationNotes": "更温暖"})
    assert server.save_conversation_message("135792468", "user", "杭州")
    assert server.save_proposal("135792468", {"headline": "旧方案"}, "test") == 1

    profile = server.reset_dialogue_workspace("135792468")

    assert profile["profile"]["selfIntro"] == "报名时填写的介绍"
    assert profile["profile"]["peerReviewSummary"]["reviewCount"] == 2
    assert "city" not in profile["profile"]
    assert server.conversation_history("135792468") == []
    assert server.proposal_history("135792468") == []


def test_reset_dialogue_workspace_keeps_creative_history(monkeypatch, tmp_path):
    use_isolated_sqlite(monkeypatch, tmp_path)
    assert server.save_creative_tool_message("135792468", "script", "user", "一段脚本")

    server.reset_dialogue_workspace("135792468")

    assert server.creative_tool_history("135792468")[0]["content"] == "一段脚本"


def test_profile_drawer_exposes_edit_and_restart_controls():
    profile_float = (server.ROOT / "web" / "profile-float.js").read_text(encoding="utf-8")
    assert "beginDialogueFieldEdit" in profile_float
    assert "restartDialogueProfile" in profile_float
    assert "/api/profile/reset-dialogue" in profile_float
    assert "generateProposal()" in profile_float


def test_canonical_policy_exports_validation_before_persisting():
    policy = (server.ROOT / "web" / "ip-policy-core.js").read_text(encoding="utf-8")
    assert "validateCanonicalProposal" in policy
    assert "validation.valid" in policy
