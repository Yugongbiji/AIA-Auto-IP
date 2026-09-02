"""Canonical stable runtime provider.

Migration phase A:
- keep install(core_module) as a compatibility entry point;
- move stable behavior ownership into StableRuntime;
- avoid spreading runtime behavior across anonymous wrapper functions.
"""
from __future__ import annotations

from copy import deepcopy

from backend import stable_ip


class StableRuntime:
    def __init__(self, core_module):
        self.core_module = core_module

    def current_snapshot(self, agent_id: str):
        agent_id = str(agent_id or "").strip()
        if not agent_id:
            return None
        with self.core_module.database() as conn:
            return stable_ip.current_output(conn, agent_id)

    def proposal_from_snapshot(self, snapshot):
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

    def history(self, agent_id, fallback):
        snapshot = self.current_snapshot(agent_id)
        history = fallback(agent_id)
        proposal = self.proposal_from_snapshot(snapshot)
        if not proposal:
            return history
        version = int(snapshot.get("proposalVersion") or 0)
        return [
            {
                "version": version,
                "proposal": proposal,
                "model": "human-approved",
                "createdAt": snapshot.get("approvedAt") or snapshot.get("updatedAt") or "",
            }
        ] + [item for item in history if int(item.get("version") or 0) != version]

    def generate(self, profile, fallback):
        profile = profile if isinstance(profile, dict) else {}
        snapshot = self.current_snapshot(profile.get("agentId"))
        proposal = self.proposal_from_snapshot(snapshot)
        if proposal:
            return {
                "proposal": proposal,
                "model": "human-approved",
                "usage": {},
                "stable": True,
            }
        return fallback(profile)

    def save(self, agent_id, proposal, model, fallback):
        meta = proposal.get("_stableMeta") if isinstance(proposal, dict) else None
        if isinstance(meta, dict) and meta.get("approved"):
            snapshot = self.current_snapshot(agent_id)
            if snapshot:
                return int(snapshot.get("proposalVersion") or 0) or None
        return fallback(agent_id, proposal, model)

    def install(self):
        core = self.core_module
        if getattr(core, "__aia_stable_runtime_installed__", False):
            return

        runtime = self
        original_history = core.proposal_history
        original_generate = core.deepseek_generate
        original_save = core.save_proposal

        core.proposal_history = lambda agent_id: runtime.history(agent_id, original_history)
        core.deepseek_generate = lambda profile: runtime.generate(profile, original_generate)
        core.save_proposal = lambda agent_id, proposal, model: runtime.save(agent_id, proposal, model, original_save)
        core.__aia_stable_runtime__ = runtime
        core.__aia_stable_runtime_installed__ = True


def install(core_module) -> None:
    """Compatibility entry retained during runtime migration."""
    StableRuntime(core_module).install()
