#!/bin/bash
# Auto-commit with standardized message
set -e

SERVICE_NAME="${PWD##*/}"
COMMIT_TYPE="${1:-feat}"
COMMIT_MESSAGE="${2:-automated update}"

# Check if we're in a submodule
if git rev-parse --show-superproject-working-tree > /dev/null 2>&1; then
  echo "🤖 Auto-committing in $SERVICE_NAME"

  # Stage all changes
  git add .

  # Check if there are changes to commit
  if git diff --cached --quiet; then
    echo "No changes to commit"
    exit 0
  fi

  # Generate standardized commit message
  FULL_MESSAGE="$COMMIT_TYPE($SERVICE_NAME): $COMMIT_MESSAGE

Co-Authored-By: Automation <automation@burnt.com>"

  git commit -m "$FULL_MESSAGE"
  echo "✅ Auto-committed changes in $SERVICE_NAME"
else
  echo "Not in a submodule, skipping auto-commit"
fi