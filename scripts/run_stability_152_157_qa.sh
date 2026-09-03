#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

log(){ printf '\n=== %s ===\n' "$1"; }

log "QA dependency preflight"
if ! python3 -m pytest --version >/dev/null 2>&1; then
  python3 -m pip install -q -r requirements-dev.txt
fi
python3 -m pytest --version

log "Contract / release blockers"
python3 -m pytest -q \
  tests/test_stability_152_157_contract.py \
  tests/test_release_blockers_114_119.py \
  tests/test_ip_policy_contract.py \
  tests/test_stable_ip_baseline.py

log "Backend script recommendation"
python3 -m unittest \
  tests/test_script_recommendation.py \
  tests/backend/test_script_library_store.py \
  tests/backend/test_script_api.py

log "Playwright focused stability journeys"
npx playwright test \
  tests/e2e/expression-style.spec.js \
  tests/e2e/ip-policy-stability-152-157.spec.js \
  --project=desktop-chromium

log "Historical E2E regression"
npx playwright test --project=desktop-chromium

printf '\nAIA_STABILITY_152_157_QA_GREEN=1\n'
