from __future__ import annotations

from backend.script_recommendation_service import build_recommendation_payload, build_script_detail
import script_library_store as store


def recommend(database, payload: dict) -> dict:
    directions = payload.get("contentDirections")
    if not isinstance(directions, list):
        raise ValueError("contentDirections must be a list")
    if len(directions) > 12:
        raise ValueError("too many content directions")
    # 前端每个板块默认展示 5 条，但一次预取最多 10 条候选，供“换一批”本地轮换，避免每点一次都重新请求。
    return build_recommendation_payload(database, directions, limit_per_direction=10)


def library(database, *, level1: str = "", level2: str = "", tag: str = "", page: int = 1, page_size: int = 20) -> dict:
    page = max(1, int(page or 1))
    page_size = max(1, min(50, int(page_size or 20)))
    # tag 保留旧接口兼容；新前端统一使用 level1 / level2。
    level1 = str(level1 or "").strip()
    level2 = str(level2 or tag or "").strip()
    scripts = store.list_active_scripts(database)

    level1_tags = sorted({str(item.get("level1_tag") or "").strip() for item in scripts if str(item.get("level1_tag") or "").strip()})
    level2_by_level1 = {}
    for parent in level1_tags:
        level2_by_level1[parent] = sorted({
            str(item.get("level2_tag") or "").strip()
            for item in scripts
            if str(item.get("level1_tag") or "").strip() == parent and str(item.get("level2_tag") or "").strip()
        })

    if level1:
        scripts = [item for item in scripts if str(item.get("level1_tag") or "").strip() == level1]
    if level2:
        scripts = [item for item in scripts if str(item.get("level2_tag") or "").strip() == level2]

    total = len(scripts)
    pages = max(1, (total + page_size - 1) // page_size) if total else 1
    page = min(page, pages)
    start = (page - 1) * page_size
    items = []
    for script in scripts[start:start + page_size]:
        items.append({
            "script_id": script["script_id"],
            "title": script.get("title_1") or "",
            "level1_tag": script.get("level1_tag") or "",
            "level2_tag": script.get("level2_tag") or "",
            "word_count": int(script.get("word_count") or 0),
            "estimated_minutes": float(script.get("estimated_minutes") or 0),
            "is_hot": bool(script.get("is_hot")),
        })
    return {
        "level1_tags": level1_tags,
        "level2_by_level1": level2_by_level1,
        "tags": sorted({value for values in level2_by_level1.values() for value in values}),
        "level1": level1,
        "level2": level2,
        "tag": level2,
        "page": page,
        "page_size": page_size,
        "total": total,
        "pages": pages,
        "scripts": items,
    }


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
