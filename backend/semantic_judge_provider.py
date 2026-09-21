"""Independent semantic judge provider for frozen PRD rule tasks.

Generation and judging are separate calls. Missing key/provider/output never
defaults to PASS. This module has no DB or Production write path.
"""
from __future__ import annotations
import json, os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
API_URL="https://api.deepseek.com/chat/completions"

def _call(task):
    key=str(os.getenv("DEEPSEEK_API_KEY","")).strip()
    if not key: raise RuntimeError("semantic judge unavailable: DEEPSEEK_API_KEY missing")
    payload={"model":os.getenv("AIA_SEMANTIC_JUDGE_MODEL",os.getenv("DEEPSEEK_MODEL","deepseek-v4-flash")),
      "thinking":{"type":"disabled"},"max_tokens":900,"response_format":{"type":"json_object"},
      "messages":[
        {"role":"system","content":"你是独立的AIA Persona PRD语义审查器。你不是生成器，不得改写候选结果，不得补充事实。严格逐Rule ID判定。只输出JSON。"},
        {"role":"user","content":json.dumps(task,ensure_ascii=False)}
      ]}
    req=Request(API_URL,data=json.dumps(payload,ensure_ascii=False).encode(),headers={"Authorization":f"Bearer {key}","Content-Type":"application/json"},method="POST")
    try:
        with urlopen(req,timeout=90) as resp: body=json.loads(resp.read().decode())
    except HTTPError as e:
        detail=e.read().decode(errors="replace")[:500]; raise RuntimeError(f"semantic judge HTTP {e.code}: {detail}") from e
    except URLError as e: raise RuntimeError("semantic judge network unavailable") from e
    raw=body.get("choices",[{}])[0].get("message",{}).get("content","").strip()
    try: row=json.loads(raw)
    except Exception as e: raise RuntimeError("semantic judge returned invalid JSON") from e
    if row.get("ruleId")!=task["ruleId"] or row.get("status") not in {"PASS","FAIL"} or not str(row.get("evidence") or "").strip() or not str(row.get("reason") or "").strip():
        raise RuntimeError(f"semantic judge malformed result for {task['ruleId']}")
    return row

def judge_tasks(tasks):
    results=[]
    for task in tasks:
        try: results.append(_call(task))
        except Exception as e:
            results.append({"ruleId":task["ruleId"],"status":"FAIL","evidence":"judge_unavailable","reason":str(e)})
    return results
