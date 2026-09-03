"""Writer ownership regression guard.

Final business outputs must have one writer only:
- IP headline / bio: web/ip-policy-core.js
- nickname: web/nickname-policy-v1.js

Compatibility layers may transform display data, but must not rewrite final outputs.
"""
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_ip_core_declares_output_owner():
    content = read("web/ip-policy-core.js")
    assert "IP 核心业务规则唯一 Owner" in content
    assert "proposal.headline" in content
    assert "proposal.bios" in content


def test_nickname_core_declares_output_owner():
    content = read("web/nickname-policy-v1.js")
    assert "推荐昵称唯一 Owner" in content


def test_compatibility_layers_do_not_claim_final_writer_role():
    forbidden_files = [
        "web/product-rules-v9.js",
        "web/product-rules-v12.js",
        "web/product-rules-v16.js",
        "web/product-rules-v24.js",
    ]
    forbidden_patterns = [
        "proposal.headline =",
        "proposal.bios =",
    ]
    for file in forbidden_files:
        path = ROOT / file
        if not path.exists():
            continue
        content = path.read_text(encoding="utf-8")
        for pattern in forbidden_patterns:
            assert pattern not in content, f"{file} still writes final output: {pattern}"
