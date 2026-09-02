import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
IP_CORE = (ROOT / "web" / "ip-policy-core.js").read_text(encoding="utf-8")
NICKNAME_CORE = (ROOT / "web" / "nickname-policy-v1.js").read_text(encoding="utf-8")
MIGRATION_PLAN = (ROOT / "docs" / "project" / "AIA_WRITER_MIGRATION_PLAN.md").read_text(encoding="utf-8")
LOAD_TARGET = (ROOT / "docs" / "project" / "AIA_RUNTIME_LOAD_TARGET.md").read_text(encoding="utf-8")


def runtime_scripts():
    return [
        src.split("?", 1)[0]
        for src in re.findall(r'<script\s+src="([^"]+)"', INDEX)
    ]


def test_runtime_script_entries_are_unique():
    scripts = runtime_scripts()
    assert scripts
    assert len(scripts) == len(set(scripts)), "index.html must not load a runtime script twice"


def test_declared_business_owners_load_before_runtime_contracts():
    scripts = runtime_scripts()
    nickname_owner = scripts.index("nickname-policy-v1.js")
    ip_owner = scripts.index("ip-policy-core.js")
    onboarding_contract = scripts.index("ip-onboarding-contract-v1.js")
    runtime_contract = scripts.index("ip-runtime-contract-v1.js")

    assert nickname_owner < ip_owner
    assert ip_owner < onboarding_contract < runtime_contract


def test_code_chain_does_not_grow_with_new_patch_generations():
    scripts = runtime_scripts()
    forbidden = [
        script
        for script in scripts
        if re.fullmatch(r"product-rules-v(?:3[0-9]|[4-9][0-9]+)\.js", script)
        or re.fullmatch(r"product-integration-v\d+\.js", script)
    ]
    assert forbidden == [], f"new patch-style runtime scripts are forbidden: {forbidden}"


def test_owner_modules_declare_their_canonical_scope():
    assert "IP 核心业务规则唯一 Owner" in IP_CORE
    assert "proposal.headline / proposal.bios" in IP_CORE
    assert "昵称规则唯一 Owner" in NICKNAME_CORE
    assert "proposal.nicknameOptions" in NICKNAME_CORE


def test_phase_two_runtime_governance_documents_are_committed():
    assert "Writer 迁移仅在以下条件全部满足时完成" in MIGRATION_PLAN
    assert "非 Owner 不写最终业务字段" in LOAD_TARGET
    assert "Production 未修改" in MIGRATION_PLAN
    assert "Production 未修改、未重启、未部署" in LOAD_TARGET
