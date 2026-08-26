"""Runtime adapter that makes current_ip_outputs the authoritative approved IP source.

This module is intentionally narrow for release closure:
- /api/lookup sees the approved current output first through proposal_history.
- /api/generate returns the approved current output without calling DeepSeek.
- save_proposal does not create a duplicate proposal version for that stable output.

Unmatched agents keep the existing generation path unchanged.
"""
from __future__ import annotations

from copy import deepcopy

from backend import stable_ip


def _text(value) -> str:
    return str(value or "").strip()


def current_snapshot(core_module, agent_id: str):
    agent_id = _text(agent_id)
    if not agent_id:
        return None
    try:
        with core_module.database() as conn:
            return stable_ip.current_output(conn, agent_id)
    except Exception:
        # Absence of the stable table/output must not break legacy users.
        return None


def proposal_from_snapshot(snapshot: dict | None):
    if not snapshot:
        return None
    proposal = deepcopy(snapshot.get("output") or {})
    proposal["_stableMeta"] = {
        "approved": True,
        "source": snapshot.get("source") or "human_approved_baseline",
        "qualityScore": int(snapshot.get("qualityScore") or 0),
        "proposalVersion": int(snapshot.get("proposalVersion") or 0),
    }
    return proposal


def history_entry(snapshot: dict | None):
    proposal = proposal_from_snapshot(snapshot)
    if not proposal:
        return None
    return {
        "version": int(snapshot.get("proposalVersion") or 0),
        "proposal": proposal,
        "model": "human-approved",
        "createdAt": snapshot.get("approvedAt") or snapshot.get("updatedAt") or "",
    }


def install(core_module) -> None:
    """Install stable-first behavior onto the legacy core module once."""
    if getattr(core_module, "__aia_stable_runtime_installed__", False):
        return

    original_history = core_module.proposal_history
    original_generate = core_module.deepseek_generate
    original_save = core_module.save_proposal

    def stable_first_history(agent_id: str):
        snapshot = current_snapshot(core_module, agent_id)
        history = original_history(agent_id)
        entry = history_entry(snapshot)
        if not entry:
            return history
        version = int(entry["version"] or 0)
        return [entry] + [item for item in history if int(item.get("version") or 0) != version]

    def stable_first_generate(profile: dict):
        profile = profile if isinstance(profile, dict) else {}
        snapshot = current_snapshot(core_module, profile.get("agentId"))
        proposal = proposal_from_snapshot(snapshot)
        if proposal:
            return {
                "proposal": proposal,
                "model": "human-approved",
                "usage": {},
                "stable": True,
            }
        return original_generate(profile)

    def stable_aware_save(agent_id: str, proposal: dict, model: str):
        meta = proposal.get("_stableMeta") if isinstance(proposal, dict) else None
        if isinstance(meta, dict) and meta.get("approved"):
            snapshot = current_snapshot(core_module, agent_id)
            if snapshot:
                return int(snapshot.get("proposalVersion") or 0) or None
        return original_save(agent_id, proposal, model)

    stable_first_history.__aia_stable_runtime__ = True
    stable_first_generate.__aia_stable_runtime__ = True
    stable_aware_save.__aia_stable_runtime__ = True
    core_module.proposal_history = stable_first_history
    core_module.deepseek_generate = stable_first_generate
    core_module.save_proposal = stable_aware_save
    core_module.__aia_stable_runtime_installed__ = True
