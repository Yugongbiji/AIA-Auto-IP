# AIA PRD → Code / Prompt / Validator Coverage Audit — 2026-09-20

## Scope and safety
- Audit baseline: `docs/product/AIA_IP_PERSONA_PRD_V1.md`
- Frozen commit: `c0255a6467e9deaa5daf1c522ab3cecdb603063d`
- Frozen PRD Git blob: `6cac1ca714ac7fe72ddc1796aed3a1d43e55fdd6`
- Frozen PRD contains **152 Rule IDs**: GOV 7, DATA 20, EVID 9, STABLE 11, NICK 30, HEAD 13, BIO 17, COMP 10, UI 14, CONTENT 9, ENG 7, ACC 5.
- This branch is isolated and must not deploy to Production. Import Harness V1 has Production writes disabled.

## Executive finding
The repository has substantial rule implementation, but the frozen PRD is **not yet the executable source of truth**. Rules are duplicated/hard-coded across Prompt, Python validator/runtime and browser JavaScript. Therefore a PRD rule can exist while generation or validation does not enforce it.

### Critical gaps found
1. **Development harness priority is stale.** `AGENTS.md` still points first to `CURRENT_EFFECTIVE_REQUIREMENTS_LEDGER_20260825.md`, while frozen PRD GOV-001 declares `AIA_IP_PERSONA_PRD_V1.md` the single source of truth.
2. **Runtime generation does not consume the frozen PRD/contract.** `backend/ip_persona_generator.py` reads `prompts/ip-persona-prompt.md`; the prompt is a manually maintained summary and contains historical #104–#114/#103 wording rather than a generated representation of all 152 Rule IDs.
3. **Stable validator is only a partial gate.** `backend/stable_ip.py::validate_output()` deterministically checks a useful subset (person content present, headline present/no vertical bar, selected low-value terms, XHS banned terms, cross-platform headline consistency and fixed footer presence), but it does not prove full PRD compliance.
4. **Canonical owners are hard-coded separately.** `web/ip-policy-core.js` and `web/nickname-policy-v1.js` contain many product rules directly in JavaScript. They are not generated from, nor coverage-checked against, the frozen PRD.
5. **Nickname implementation contains examples/heuristics as code.** This is useful behavior but can drift from NICK-001…030 because there is no Rule-ID-level execution report.
6. **Existing rule matrix is historical audit evidence, not executable coverage.** It contains older IDs/ranges that no longer exactly match the frozen 152-rule registry; it must not be treated as the runtime contract.

## Harness V1 decision
Introduce a fail-closed machine registry at `contracts/aia_ip_persona_contract_v1.json`.

The first gate is intentionally simple and strong:
- parse every Rule ID from the frozen PRD;
- require exact 1:1 presence in the machine registry;
- reject missing, unknown or duplicate Rule IDs;
- verify the exact frozen PRD Git blob SHA;
- default unknown/missing rules to BLOCK;
- keep Production mutation disabled.

This prevents the first failure mode: “the PRD contains a rule but the machine contract silently forgot it.”

## Enforcement layers
Every PRD rule must ultimately have one execution owner:
- **deterministic** — Python/JS code can prove pass/fail;
- **structural** — schema/data model/transaction constraint;
- **semantic** — constrained judge checks a specific Rule ID against evidence;
- **journey** — Playwright/user-flow assertion;
- **architecture/process** — CI/repository/release gate.

“Semantic” never means optional. It means the rule needs an evidence-bound judge instead of a regex.

## Next implementation slice (Import Harness V1)
Before tomorrow's batch import, implement the import-side pipeline without touching Production runtime:

`raw files → normalized facts → evidence ledger → asset competition → candidate output → deterministic contract gates → semantic rule gates → dry-run report`

The report must identify failures by Rule ID and agent ID. A candidate with any hard-gate failure is BLOCKED; it must never be patched field-by-field merely to pass a later gate.

### Mandatory import invariants
- raw facts are immutable source evidence;
- new confirmed facts merge; they do not replace unrelated existing facts;
- peer reviews never create unknown agents;
- agent ID never becomes license number;
- proposals are append-only;
- current stable output is not overwritten by import preparation;
- XHS/headline/video are treated as a linked canonical output group;
- generated output must be evidence-traceable;
- Production commit remains a separate explicit step after dry-run, backup and verification.

## Definition of done for V1
1. Frozen PRD exact coverage check passes: 152/152.
2. Contract tests pass.
3. Tianjin sanitized regression fixture reproduces the known batch invariants without real personal data in Git.
4. Harness produces a Rule-ID-level report.
5. Harness cannot write Production.
6. No Production service, DB schema, runtime owner, Prompt or deployed code is changed by this branch.


## Harness V1 executable closure — 2026-09-21

The frozen registry now has **152/152 executable Rule IDs and 0 pending**.

Execution is intentionally split instead of pretending every product rule is a regex:

- **53 deterministic/structural rules** execute directly in Python contracts for facts, evidence, stable protection, headline/bio structure, compliance and candidate reporting.
- **99 fail-closed executor rules** execute through `backend/prd_rule_executor.py`. A rule cannot PASS without an explicit executor result containing `ruleId + PASS/FAIL + evidence + reason`.
- Semantic NICK/HEAD/BIO/CONTENT rules are emitted one Rule ID at a time by `backend/semantic_judge_contract.py`; the judge is not allowed to create facts and must judge only the supplied candidate/evidence/ranking.
- UI/ACC rules require journey evidence; GOV/ENG rules require architecture evidence. Missing evidence is BLOCK, never implicit PASS.
- `tools/aia_prd_contract_check.py` now fails unless the frozen PRD has exactly full executable coverage and `pendingV1 == 0`.

This is **machine-executable coverage**, not a claim that all 152 rules are deterministic. Semantic and journey rules deliberately remain evidence-bearing executor checks.

### Beijing fallback-generation gate

Before a Beijing candidate can be marked READY:
1. frozen PRD provenance must match;
2. fact merge and source separation must pass;
3. evidence ledger and asset ranking must pass;
4. headline/bio deterministic gates must pass;
5. all required semantic/journey/architecture executor results must be present and PASS;
6. Candidate Report must contain no BLOCKED rule;
7. no Production write occurs.

The first business review should use 3–5 representative people. Only after human quality acceptance should the full import package be produced.
