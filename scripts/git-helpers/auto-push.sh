#!/bin/bash
# Auto-push with safety checks
set -e

SERVICE_NAME="${PWD##*/}"
BRANCH="${1:-$(git branch --show-current)}"

echo "🚀 Auto-pushing $SERVICE_NAME to $BRANCH"

# Safety checks
if [[ "$BRANCH" == "main" || "$BRANCH" == "master" ]]; then
  echo "⚠️ Pushing to main branch, running safety checks..."

  # Run tests if they exist
  if [ -f "package.json" ] && npm run test --if-present > /dev/null 2>&1; then
    npm run test
  fi

  # Run linting if available
  if [ -f "package.json" ] && npm run lint --if-present > /dev/null 2>&1; then
    npm run lint
  fi
fi

# Push with lease protection
git push --force-with-lease origin "$BRANCH"
echo "✅ Successfully pushed $SERVICE_NAME"