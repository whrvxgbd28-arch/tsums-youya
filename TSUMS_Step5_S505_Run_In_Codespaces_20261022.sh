#!/usr/bin/env bash
# Safe review-only patch execution: does NOT commit, push, alter main or change ports.
set -euo pipefail
cd /workspaces/tsums-youya
branch="$(git branch --show-current)"
if [[ -z "$branch" || "$branch" == main ]]; then echo 'FAIL: REVIEW_BRANCH_REQUIRED'; exit 1; fi
if [[ ! -s qa-evidence/20261022-step4/manifest.txt || ! -s qa-evidence/20261022-step4/test.log ]]; then echo 'FAIL: STEP4_QA_NOT_PRESENT'; exit 1; fi
if ! grep -Fxq 'PASS: STEP4_SYNTHETIC_TEST' qa-evidence/20261022-step4/test.log; then echo 'FAIL: STEP4_QA_NOT_PASS'; exit 1; fi
INPUT="${1:-}"
if [[ -z "$INPUT" ]]; then
  mapfile -t candidates < <(find . -maxdepth 1 -type f -name 'index.field-runtime-p0-v5*.html' ! -name '*s505*' | sort)
  if [[ "${#candidates[@]}" -ne 1 ]]; then
    printf 'FAIL: EXACT_V5_INPUT_REQUIRED; candidates=%s\n' "${#candidates[@]}"
    printf '%s\n' "${candidates[@]}"
    echo 'Use: bash TSUMS_Step5_S505_Run_In_Codespaces_20261022.sh exact-input-file.html'
    exit 1
  fi
  INPUT="${candidates[0]}"
fi
[[ -f "$INPUT" ]] || { echo 'FAIL: INPUT_NOT_FOUND'; exit 1; }
OUT='index.field-runtime-p0-v5-s505-review.html'
[[ ! -e "$OUT" ]] || { echo 'FAIL: OUTPUT_ALREADY_EXISTS; preserve prior review'; exit 1; }
mkdir -p qa-evidence/20261022-step5
node TSUMS_Step5_S505_Atomic_Fix_20261022.cjs "$INPUT" "$OUT" \
  | tee qa-evidence/20261022-step5/s505-patch-result.json
set -o pipefail
node TSUMS_Step5_S505_Atomic_Unit_QA_20261022.cjs "$OUT" \
  | tee qa-evidence/20261022-step5/s505-unit-result.json
{
 echo "TSUMS STEP5 S5-05 REVIEW BINDING"
 date -u +'%Y-%m-%dT%H:%M:%SZ'
 git branch --show-current
 git rev-parse HEAD
 sha256sum "$INPUT" "$OUT" TSUMS_Step5_S505_Atomic_Fix_20261022.cjs TSUMS_Step5_S505_Atomic_Unit_QA_20261022.cjs
} > qa-evidence/20261022-step5/s505-manifest.txt
echo 'PASS: S505_ATOMIC_UNIT_QA'
echo 'INFO: CODESPACES_REAL_INDEXEDDB_BROWSER_QA_PENDING'
echo 'INFO: NO_COMMIT_NO_PUSH_MAIN_UNCHANGED_PORT_UNTOUCHED'
git status --short
