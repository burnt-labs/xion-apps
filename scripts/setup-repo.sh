#!/bin/bash
# Setup script for new developers
# Run this once after cloning the repository

set -e

echo "🚀 Setting up xion-apps monorepo..."

# Configure git to use our custom hooks
echo "📝 Configuring git hooks..."
git config core.hooksPath .githooks

# Initialize and update all submodules
echo "📦 Initializing submodules (this may take a few minutes)..."
git submodule update --init --recursive --jobs=8 --progress

# Configure git aliases for common submodule operations
echo "⚙️  Setting up git aliases..."
git config alias.sub-status 'submodule status'
git config alias.sub-update 'submodule update --recursive --jobs=8'
git config alias.sub-pull 'submodule foreach "git pull origin \$(git rev-parse --abbrev-ref HEAD) || git pull origin main || git pull origin master"'
git config alias.sub-push 'submodule foreach "git push || echo \"Skipping push for \$name (no changes or no push access)\""'

echo "✅ Repository setup complete!"
echo ""
echo "📚 Useful commands:"
echo "  git sub-status    - Show status of all submodules"
echo "  git sub-update    - Update all submodules to committed versions"
echo "  git sub-pull      - Pull latest changes for all submodules"
echo "  ./scripts/update-submodules.sh - Update and commit submodule changes"
echo ""
echo "🎯 The repository is now ready for development!"