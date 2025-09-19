#!/usr/bin/env node
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function execCommand(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'inherit', ...options });
  } catch (error) {
    console.error(`❌ Error executing: ${command}`);
    throw error;
  }
}

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function updateSubmodules() {
  console.log('🔄 Updating all submodules to latest versions...');

  try {
    // Update each submodule
    execCommand(`git submodule foreach --recursive '
      echo "📦 Updating $name...";
      git fetch origin;
      default_branch=$(git symbolic-ref refs/remotes/origin/HEAD | sed "s@^refs/remotes/origin/@@" 2>/dev/null || echo "main");
      if git checkout "$default_branch" 2>/dev/null && git pull origin "$default_branch" 2>/dev/null; then
        echo "✅ Updated $name to latest $default_branch";
      else
        for branch in main master; do
          if git checkout "$branch" 2>/dev/null && git pull origin "$branch" 2>/dev/null; then
            echo "✅ Updated $name to latest $branch";
            break;
          fi;
        done;
      fi
    '`);

    console.log('\n🔍 Checking for submodule changes...');

    // Check if there are changes
    const hasChanges = execCommand('git diff --quiet HEAD -- . || echo "changes"', { stdio: 'pipe' }).trim();

    if (!hasChanges) {
      console.log('ℹ️  No submodule updates available');
      rl.close();
      return;
    }

    // Show what changed
    console.log('📝 Submodule changes:');
    const changedFiles = execCommand('git diff --name-only HEAD -- .', { stdio: 'pipe' }).trim().split('\n');
    changedFiles.forEach(file => {
      if (file) console.log(`  - ${file}`);
    });

    const shouldCommit = await question('\n💾 Commit these submodule updates? (y/N): ');

    if (shouldCommit.toLowerCase() === 'y') {
      execCommand('git add .');

      const submoduleStatus = execCommand('git submodule status', { stdio: 'pipe' });
      const updatedModules = submoduleStatus.split('\n')
        .filter(line => line.startsWith('+'))
        .map(line => `- ${line.substring(1).split(' ')[1]}`)
        .join('\n');

      const commitMsg = `Update submodules to latest versions\n\n${updatedModules}`;
      execCommand(`git commit -m "${commitMsg}"`);
      console.log('✅ Committed submodule updates');

      const shouldPush = await question('🚀 Push changes to remote? (y/N): ');
      if (shouldPush.toLowerCase() === 'y') {
        execCommand('git push');
        console.log('✅ Pushed changes to remote');
      }
    } else {
      console.log('ℹ️  Changes not committed');
    }

  } catch (error) {
    console.error('❌ Error updating submodules:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

updateSubmodules();