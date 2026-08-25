from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V25 = (ROOT / 'web' / 'product-rules-v25.js').read_text(encoding='utf-8')
RESET = (ROOT / 'scripts' / 'reset_preview_test_data.py').read_text(encoding='utf-8')
FINALIZE = (ROOT / 'scripts' / 'finalize_preview_release.sh').read_text(encoding='utf-8')
DEPLOY = (ROOT / 'scripts' / 'deploy-preview-local.sh').read_text(encoding='utf-8')


def test_121_preview_stale_session_cannot_override_explicit_identity():
    assert 'explicitIdentitySubmit' in V25
    assert 'staleResumeMayReturn' in V25
    assert "localStorage.removeItem(SESSION_KEY)" in V25
    assert "identityForm?.addEventListener('submit'" in V25
    assert 'startWorkspace = function previewIdentityStartWorkspace' in V25
    assert 'staleResumeMayReturn && !explicitIdentitySubmit && matched && identityVisible' in V25


def test_preview_cleanup_is_sqlite_only_and_preserves_core_source_data():
    assert 'engine != "sqlite"' in RESET
    assert '"preview" not in str(ROOT).lower()' in RESET
    assert 'HISTORY_TABLES' in RESET
    for table in ['conversation_messages','proposals','content_planning_messages','content_plans','creative_tool_messages','script_user_activity']:
        assert table in RESET
    assert 'DELETE FROM "agents"' not in RESET
    assert 'DELETE FROM "peer_reviews"' not in RESET
    assert 'DELETE FROM "script_library"' not in RESET
    assert '"nickname" in normalized' in RESET
    assert 'nicknamePreset' in RESET
    assert 'nickname_presets' in RESET
    assert 'shutil.copy2(DB_PATH, backup)' in RESET


def test_one_command_finalizer_runs_gate_before_data_mutation_and_refuses_rds():
    assert 'DB_ENGINE' in FINALIZE and 'sqlite' in FINALIZE
    assert 'bash scripts/check-preview-local.sh' in FINALIZE
    assert FINALIZE.index('bash scripts/check-preview-local.sh') < FINALIZE.index('reset_preview_test_data.py --apply')
    assert 'systemctl stop "$SERVICE"' in FINALIZE
    assert 'systemctl start "$SERVICE"' in FINALIZE
    assert 'curl -fsS' in FINALIZE
    assert 'DB_ENGINE=sqlite' in DEPLOY
