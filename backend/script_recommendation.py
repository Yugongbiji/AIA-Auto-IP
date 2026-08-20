from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MAPPING_PATH = ROOT / "rules" / "script-recommendation-map.json"


@dataclass(frozen=True)
class DirectionMatch:
    direction: str
    score: float


def load_mapping(path: Path | str = DEFAULT_MAPPING_PATH) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _normalize(value) -> str:
    return str(value or "").strip()


def _direction_config(direction: str, mapping: dict) -> tuple[str | None, dict | None]:
    direction = _normalize(direction)
    configs = mapping.get("directions", {})
    if direction in configs:
        return direction, configs[direction]
    for canonical, config in configs.items():
        aliases = {_normalize(x) for x in config.get("aliases", [])}
        if direction in aliases:
            return canonical, config
    return None, None


def score_script_for_direction(script: dict, direction: str, mapping: dict) -> DirectionMatch:
    canonical, config = _direction_config(direction, mapping)
    if not canonical or not config:
        return DirectionMatch(direction=direction, score=0.0)

    level1 = _normalize(script.get("level1_tag"))
    level2 = _normalize(script.get("level2_tag"))
    defaults = mapping.get("defaults", {})
    level1_score = float(defaults.get("level1_match_score", 1.0))
    level2_score = float(defaults.get("level2_match_score", 2.0))
    hot_bonus = float(defaults.get("hot_bonus", 0.25))

    best = 0.0
    for pair in config.get("pairs", []):
        if not pair:
            continue
        pair_level1 = _normalize(pair[0])
        pair_level2 = _normalize(pair[1] if len(pair) > 1 else "")
        score = 0.0
        if level1 and level1 == pair_level1:
            score += level1_score
            if pair_level2 and level2 == pair_level2:
                score += level2_score
        best = max(best, score)

    # 热点只是同等内容匹配下的轻量加分，不能让不相关脚本跨方向硬插入。
    if best > 0 and bool(script.get("is_hot")):
        best += hot_bonus
    return DirectionMatch(direction=canonical, score=best)


def allocate_recommendations(
    scripts: Iterable[dict],
    content_directions: Iterable[str],
    mapping: dict | None = None,
    limit_per_direction: int | None = None,
) -> list[dict]:
    """Return direction groups with cross-direction dedupe.

    Each script is assigned to the direction where it has the highest score.
    A script can therefore appear at most once in a recommendation batch.
    """
    mapping = mapping or load_mapping()
    limit = int(limit_per_direction or mapping.get("defaults", {}).get("limit_per_direction", 5))
    directions = [_normalize(x) for x in content_directions if _normalize(x)]
    groups = {direction: [] for direction in directions}

    candidates = []
    for script in scripts:
        if _normalize(script.get("status") or "active") != "active":
            continue
        best_direction = None
        best_score = 0.0
        for direction in directions:
            match = score_script_for_direction(script, direction, mapping)
            if match.score > best_score:
                best_score = match.score
                best_direction = direction
        if best_direction and best_score > 0:
            candidates.append((best_score, best_direction, script))

    # V1 稳定排序：匹配度 > 热点 > script_id。后续再叠加业务节奏、近期曝光/使用降权。
    candidates.sort(
        key=lambda item: (
            -item[0],
            -int(bool(item[2].get("is_hot"))),
            str(item[2].get("script_id") or ""),
        )
    )

    used_ids = set()
    for score, direction, script in candidates:
        sid = script.get("script_id") or script.get("content_hash")
        if sid in used_ids or len(groups[direction]) >= limit:
            continue
        used_ids.add(sid)
        groups[direction].append({**script, "recommendation_score": round(score, 3)})

    return [
        {
            "content_direction": direction,
            "reason": f"和你的「{direction}」内容主线匹配",
            "scripts": groups[direction],
        }
        for direction in directions
    ]
