"""Runtime ownership contract.

The stable runtime layer may provide approved-output behavior, but final
business ownership must remain explicit. This contract prevents future
reintroduction of hidden runtime writers.
"""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_stable_runtime_does_not_define_business_policy_writers():
    source = (ROOT / "backend" / "stable_runtime.py").read_text(encoding="utf-8")
    forbidden = [
        "headline =",
        "bios =",
        "nickname =",
    ]
    assert not any(token in source for token in forbidden)


def test_runtime_entry_remains_explicit():
    source = (ROOT / "backend" / "script_persona_rules.py").read_text(encoding="utf-8")
    assert "stable_runtime.install" in source
