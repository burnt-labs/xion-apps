#!/bin/bash
# Add a new submodule to the monorepo
# Usage: ./scripts/add-submodule.sh <repo-url> <local-path>

set -e

if [ $# -ne 2 ]; then
    echo "Usage: $0 <repo-url> <local-path>"
    echo "Example: $0 https://github.com/burnt-labs/new-app new-app"
    exit 1
fi

repo_url=$1
local_path=$2

echo "📦 Adding new submodule..."
echo "  Repository: $repo_url"
echo "  Local path: $local_path"
echo ""

# Add the submodule
git submodule add "$repo_url" "$local_path"

# Initialize and update the new submodule
git submodule update --init --recursive "$local_path"

echo "✅ Submodule added successfully!"
echo ""
echo "📝 Next steps:"
echo "  1. Review the changes: git status"
echo "  2. Commit the changes: git commit -m \"Add $local_path submodule\""
echo "  3. Push to remote: git push"