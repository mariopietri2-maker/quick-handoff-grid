#!/usr/bin/env bash
# fresh2go rebrand deploy helper
# Commits the fresh2go branding changes and pushes to main,
# triggering the Vercel / Railway auto-deploy for the live site.
#
# Requirements: git on PATH, credentials for origin.
# Run from the repo root (quick-handoff-grid/):
#   ./scripts/deploy-rebrand.sh

set -euo pipefail

if [ ! -d .git ]; then
  echo "No .git here. Run this from the quick-handoff-grid repo root." >&2
  exit 1
fi

command -v git >/dev/null 2>&1 || { echo "git not found on PATH" >&2; exit 1; }

echo "==> Staging ONLY fresh2go-branded files (not git add -A)"
# NOTE: this repo contains OTHER unrelated uncommitted changes (workflows,
# sql, native files, assets). We stage only files that contain the new
# "fresh2go" token so the deploy commit does not sweep divergent work into
# production. The old project never contained "fresh2go", so this is a safe
# and precise marker of the rebrand edits.
mapfile -t staged < <(
  git ls-files -z |
    while IFS= read -r -d '' f; do
      case "$f" in
        *node_modules*|*/dist/*|*/.gradle/*|*/build/*|*/android-*|*/e2e-artifacts/*) continue ;;
      esac
      if grep -qi "fresh2go\|fresh 2go" -- "$f" 2>/dev/null; then printf '%s\n' "$f"; fi
    done
)
printf 'Staged %d fresh2go-branded files.\n' "${#staged[@]}"
printf '  %s\n' "${staged[@]}"
git add -- "${staged[@]}"

echo "==> Staged diff stat (branding only)"
git diff --cached --stat

echo "NOTE: unrelated modified files are left UNSTAGED and will NOT be deployed."
echo "==> Status"
git status --short

echo ""
read -r -p "Confirm and commit/push? (y/n) " resp
if [[ ! "$resp" =~ ^[Yy] ]]; then echo "Aborted."; exit 0; fi

echo "==> Commit"
git commit -m "Rebrand to fresh2go (basket logo) across web, PWA, native apps, supabase"

echo "==> Push to origin/main (triggers Vercel/Railway deploy)"
git push origin main

echo ""
echo "Done. Live deploy triggered."
echo "Vercel:  https://quick-handoff-grid-8qu8.vercel.app"
echo "Railway: https://quick-handoff-grid-production.up.railway.app"
