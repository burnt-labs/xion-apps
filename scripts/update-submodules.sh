#!/bin/bash
# Update all submodules to their latest versions and commit the changes
# This is useful for maintainers to update all subprojects at once

set -e

echo "🔄 Updating all submodules to latest versions..."

# Function to get the default branch for a submodule
get_default_branch() {
    local submodule_path=$1
    cd "$submodule_path"
    local default_branch=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@' 2>/dev/null || echo "main")
    cd - > /dev/null
    echo "$default_branch"
}

# Store current directory
original_dir=$(pwd)
updated_modules=()

# Update each submodule
git submodule foreach --recursive '
    echo "📦 Updating $name..."
    git fetch origin

    # Get the default branch
    default_branch=$(git symbolic-ref refs/remotes/origin/HEAD | sed "s@^refs/remotes/origin/@@" 2>/dev/null || echo "main")

    # Try to checkout and pull the default branch
    if git checkout "$default_branch" 2>/dev/null && git pull origin "$default_branch" 2>/dev/null; then
        echo "✅ Updated $name to latest $default_branch"
    else
        # Fallback to main/master
        for branch in main master; do
            if git checkout "$branch" 2>/dev/null && git pull origin "$branch" 2>/dev/null; then
                echo "✅ Updated $name to latest $branch"
                break
            fi
        done
    fi
'

echo ""
echo "🔍 Checking for submodule changes..."

# Check if there are any changes to commit
if git diff --quiet HEAD -- . ':!*'; then
    echo "ℹ️  No submodule updates available"
    exit 0
fi

# Show what changed
echo "📝 Submodule changes:"
git diff --name-only HEAD -- . | while read -r module; do
    if [ -d "$module" ]; then
        echo "  - $module"
        updated_modules+=("$module")
    fi
done

echo ""
read -p "💾 Commit these submodule updates? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Add all submodule changes
    git add .

    # Create commit message
    commit_msg="Update submodules to latest versions

$(git submodule status | grep "^+" | sed 's/^+/- /' | cut -d' ' -f2)"

    git commit -m "$commit_msg"
    echo "✅ Committed submodule updates"

    read -p "🚀 Push changes to remote? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git push
        echo "✅ Pushed changes to remote"
    fi
else
    echo "ℹ️  Changes not committed"
fi