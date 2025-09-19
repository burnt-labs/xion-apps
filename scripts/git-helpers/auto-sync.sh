#!/bin/bash
# Auto-sync with upstream
set -e

SERVICE_NAME="${PWD##*/}"
echo "🔄 Auto-syncing $SERVICE_NAME"

# Fetch latest changes
git fetch --all --tags

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)

# Sync with upstream
if git rev-parse --verify "origin/$CURRENT_BRANCH" > /dev/null 2>&1; then
  git rebase "origin/$CURRENT_BRANCH"
  echo "✅ Synced $SERVICE_NAME with upstream"
else
  echo "⚠️ No upstream branch found for $CURRENT_BRANCH"
fi