"""Beijing five-person Harness pilot configuration.

This file contains identifiers and source-presence metadata only. Raw personal
source text stays in the import package; operational lead metrics are excluded.
No Production write is permitted.
"""
PILOT_AGENT_IDS=("110082604","110952886","111061705","110922683","110384739")
PILOT_NAMES={"110082604":"唐运富","110952886":"陈娟","111061705":"虞璐","110922683":"饶奋波","110384739":"王颖博"}
SELF_REGISTRATION={"110082604":True,"110952886":True,"111061705":True,"110922683":False,"110384739":False}
PEER_REVIEW_COUNTS={"110082604":66,"110952886":30,"111061705":11,"110922683":88,"110384739":1}
PRODUCTION_WRITE=False

def preflight(agent_id):
    aid=str(agent_id)
    if aid not in PILOT_AGENT_IDS: return {"ok":False,"reason":"not_in_beijing_pilot"}
    return {"ok":True,"agentId":aid,"name":PILOT_NAMES[aid],"hasSelfRegistration":SELF_REGISTRATION[aid],
            "peerReviewCount":PEER_REVIEW_COUNTS[aid],"productionWrite":False,
            "excludedOperationalMetrics":["6月留资总数","7月总留资数","8月留资总数","6月7月8月累计留资数"]}
