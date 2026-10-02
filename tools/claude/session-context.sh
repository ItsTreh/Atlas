#!/bin/bash
# SessionStart hook (.claude/settings.json): prints the facts CLAUDE.md
# leaves out because they go stale: the current branch and the regions
# painted on Male_Body so far (read from Male_Body.paint.json).
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
echo "ATLAS live state (from the SessionStart hook):"
echo "- Current git branch: $(git branch --show-current 2>/dev/null || echo unknown)"
echo "- Painted on Male_Body so far (Male_Body.paint.json):"
jq -r '.colors | to_entries[] | "    \(.value) (\(.key))"' assets/anatomy/Male_Body.paint.json 2>/dev/null \
  || echo "    (could not read assets/anatomy/Male_Body.paint.json)"
