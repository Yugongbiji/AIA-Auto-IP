from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from backend.script_recommendation import allocate_recommendations
import script_library_store as store


def new_recommendation_batch() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"rec-{stamp}-{uuid4().hex[:8]}"


def _card(script: dict) -> dict:
    """Return only fields needed by recommendation cards; body stays on detail API."""
    return {
        "script_id": script["script_id"],
        "title": script.get("title_1") or "",
        "level1_tag": script.get("level1_tag") or "",
        "level2_tag": script.get("level2_tag") or "",
        "word_count": int(script.get("word_count") or 0),
        "estimated_minutes": float(script.get("estimated_minutes") or 0),
        "is_hot": bool(script.get("is_hot")),
        "recommendation_score": script.get("recommendation_score"),
    }


def build_recommendation_payload(database, content_directions, *, limit_per_direction: int = 5) -> dict:
    directions = [str(x or "").strip() for x in content_directions or [] if str(x or "").strip()]
    # Keep order from the IP plan while removing duplicate directions.
    directions = list(dict.fromkeys(directions))
    if not directions:
        return {"recommendation_batch": new_recommendation_batch(), "groups": []}

    scripts = store.list_active_scripts(database)
    groups = allocate_recommendations(
        scripts,
        directions,
        limit_per_direction=limit_per_direction,
    )
    return {
        "recommendation_batch": new_recommendation_batch(),
        "groups": [
            {
                "content_direction": group["content_direction"],
                "reason": group["reason"],
                "scripts": [_card(script) for script in group["scripts"]],
            }
            for group in groups
        ],
    }


def build_script_detail(database, script_id: int) -> dict | None:
    script = store.get_script(database, int(script_id))
    if not script:
        return None
    return {
        "script_id": script["script_id"],
        "title_1": script.get("title_1") or "",
        "title_2": script.get("title_2"),
        "title_3": script.get("title_3"),
        "body": script.get("body") or "",
        "level1_tag": script.get("level1_tag") or "",
        "level2_tag": script.get("level2_tag") or "",
        "word_count": int(script.get("word_count") or 0),
        "estimated_minutes": float(script.get("estimated_minutes") or 0),
        "is_hot": bool(script.get("is_hot")),
        "reviewed_at": script.get("reviewed_at"),
    }
