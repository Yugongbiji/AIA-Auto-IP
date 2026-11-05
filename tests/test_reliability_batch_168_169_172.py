import os
from pathlib import Path

import server


ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "web" / "app.js").read_text(encoding="utf-8")
ONBOARDING = (ROOT / "web" / "onboarding.js").read_text(encoding="utf-8")


def use_isolated_sqlite(monkeypatch, tmp_path):
    monkeypatch.setenv("DB_ENGINE", "sqlite")
    monkeypatch.setattr(server, "DB_PATH", tmp_path / "persona.sqlite3")
    server.initialize_database()


def test_unlisted_identity_is_saved_once_and_reusable(monkeypatch, tmp_path):
    use_isolated_sqlite(monkeypatch, tmp_path)

    assert server.ensure_guest_agent("王小明", "135792468") is True
    assert server.ensure_guest_agent("王小明", "135792468") is True

    profile = server.merged_profile("135792468")
    assert profile["profile"] == {"name": "王小明", "agentId": "135792468"}
    with server.database() as conn:
        assert conn.execute("SELECT COUNT(*) AS count FROM agents WHERE agent_id = ?", ("135792468",)).fetchone()["count"] == 1


def test_obvious_placeholder_identity_is_not_saved(monkeypatch, tmp_path):
    use_isolated_sqlite(monkeypatch, tmp_path)

    assert server.ensure_guest_agent("测试", "123456789") is False
    assert server.merged_profile("123456789") is None


def test_guest_identity_uses_the_existing_nine_digit_id_format(monkeypatch, tmp_path):
    use_isolated_sqlite(monkeypatch, tmp_path)

    assert server.ensure_guest_agent("王小明", "AIA-20261105") is False


def test_confirmed_profile_change_regenerates_existing_proposal():
    assert "if (state.proposals.length) return generateProposal();" in APP


def test_saved_proposal_restores_a_card_when_message_history_is_missing():
    assert "function ensureLatestProposalCard()" in APP
    assert "ensureLatestProposalCard();" in ONBOARDING
    assert "data-proposal-version" in APP
