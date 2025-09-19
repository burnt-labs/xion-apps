#!/bin/bash
# Remove a submodule from the monorepo
# Usage: ./scripts/remove-submodule.sh <local-path>

set -e

if [ $# -ne 1 ]; then
    echo "Usage: $0 <local-path>"
    echo "Example: $0 old-app"
    exit 1
fi

local_path=$1

if [ ! -d "$local_path" ]; then
    echo "❌ Error: Directory '$local_path' not found"
    exit 1
fi

if ! git submodule status "$local_path" &>/dev/null; then
    echo "❌ Error: '$local_path' is not a submodule"
    exit 1
fi

echo "🗑️  Removing submodule: $local_path"
echo ""

# Remove the submodule
git submodule deinit -f "$local_path"
git rm -f "$local_path"
rm -rf ".git/modules/$local_path"

echo "✅ Submodule removed successfully!"
echo ""
echo "📝 Next steps:"
echo "  1. Review the changes: git status"
echo "  2. Commit the changes: git commit -m \"Remove $local_path submodule\""
echo "  3. Push to remote: git push"