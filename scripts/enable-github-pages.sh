#!/usr/bin/env bash
set -euo pipefail

OWNER="${1:-drsklgfa}"
REPOSITORY="${2:-pulseflow}"
BRANCH="${3:-main}"
REPO="$OWNER/$REPOSITORY"

command -v gh >/dev/null 2>&1 || { echo "GitHub CLI (gh) is required." >&2; exit 1; }
gh auth status >/dev/null
gh repo view "$REPO" --json nameWithOwner,defaultBranchRef >/dev/null

if gh api "repos/$REPO/pages" >/dev/null 2>&1; then
  gh api --method PUT "repos/$REPO/pages" -f build_type=workflow -F https_enforced=true >/dev/null
else
  gh api --method POST "repos/$REPO/pages" -f build_type=workflow >/dev/null
fi

gh workflow enable pages.yml --repo "$REPO" >/dev/null
gh workflow run pages.yml --repo "$REPO" --ref "$BRANCH" >/dev/null
SITE_URL="https://$OWNER.github.io/$REPOSITORY/"
gh repo edit "$REPO" --homepage "$SITE_URL" >/dev/null

echo "GitHub Pages configured: $SITE_URL"
echo "Workflow: https://github.com/$REPO/actions/workflows/pages.yml"
