from __future__ import annotations

from backend.script_recommendation_service import build_recommendation_payload, build_script_detail
import script_library_store as store


def recommend(database, payload: dict) -> dict:
    directions = payload.get("contentDirections")
    if not isinstance(directions, list):
        raise ValueError("contentDirections must be a list")
    if len(directions) > 12:
        raise ValueError("too many content directions")
    return build_recommendation_payload(database, directions, limit_per_direction=5)


def detail(database, script_id) -> dict | None:
    try:
        script_id = int(script_id)
    except (TypeError, ValueError) as error:
        raise ValueError("invalid script id") from error
    if script_id <= 0:
        raise ValueError("invalid script id")
    return build_script_detail(database, script_id)


def activity(database, payload: dict) -> dict:
    try:
        script_id = int(payload.get("scriptId"))
    except (TypeError, ValueError) as error:
        raise ValueError("invalid script id") from error
    event_type = str(payload.get("eventType") or "").strip()
    if event_type not in store.VALID_ACTIVITY_EVENTS:
        raise ValueError("invalid activity event")
    ok = store.record_script_activity(
        database,
        script_id=script_id,
        event_type=event_type,
        agent_id=str(payload.get("agentId") or "").strip() or None,
        content_direction=str(payload.get("contentDirection") or "").strip() or None,
        recommendation_batch=str(payload.get("recommendationBatch") or "").strip() or None,
    )
    return {"ok": bool(ok)}
