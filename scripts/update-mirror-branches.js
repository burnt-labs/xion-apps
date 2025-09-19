#!/usr/bin/env node
const { execSync } = require('child_process');

function execCommand(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf8', ...options });
  } catch (error) {
    throw error;
  }
}

function getDefaultBranch(submodulePath) {
  try {
    const originalDir = process.cwd();
    process.chdir(submodulePath);

    try {
      const defaultBranch = execCommand('git symbolic-ref refs/remotes/origin/HEAD', { stdio: 'pipe' })
        .trim()
        .replace('refs/remotes/origin/', '');
      process.chdir(originalDir);
      return defaultBranch;
    } catch (error) {
      try {
        execCommand('git show-ref --verify --quiet refs/remotes/origin/main', { stdio: 'pipe' });
        process.chdir(originalDir);
        return 'main';
      } catch (error) {
        process.chdir(originalDir);
        return 'master';
      }
    }
  } catch (error) {
    return 'main';
  }
}

function updateMirrorBranches() {
  try {
    console.log('🔄 Updating mirror branches...');

    // Get existing mirror branches
    let existingBranches = [];
    try {
      existingBranches = execCommand('git branch --list "*/main" "*/master"', { stdio: 'pipe' })
        .trim()
        .split('\n')
        .map(branch => branch.trim().replace(/^\*?\s*/, ''))
        .filter(branch => branch);
    } catch (error) {
      console.log('ℹ️  No existing mirror branches found');
    }

    if (existingBranches.length === 0) {
      console.log('ℹ️  No mirror branches to update. Run "npm run branches:sync" first.');
      return;
    }

    console.log(`📦 Found ${existingBranches.length} mirror branches to update`);

    // Get list of submodules
    const submoduleStatus = execCommand('git submodule status', { stdio: 'pipe' }).trim();
    const submodules = submoduleStatus
      .split('\n')
      .map(line => {
        const parts = line.trim().split(' ');
        return {
          path: parts[1]
        };
      })
      .filter(sub => sub.path);

    let successCount = 0;
    let errorCount = 0;

    for (const submodule of submodules) {
      try {
        const defaultBranch = getDefaultBranch(submodule.path);
        const branchName = `${submodule.path}/${defaultBranch}`;

        // Check if this mirror branch exists
        if (!existingBranches.includes(branchName)) {
          continue;
        }

        console.log(`🔄 Updating ${branchName}...`);

        // Get the latest commit from the submodule's default branch
        const originalDir = process.cwd();
        process.chdir(submodule.path);

        // Fetch latest changes
        execCommand('git fetch origin', { stdio: 'pipe' });

        // Get the latest commit hash from the default branch
        const latestCommit = execCommand(`git rev-parse origin/${defaultBranch}`, { stdio: 'pipe' }).trim();

        process.chdir(originalDir);

        // Get current commit of the mirror branch
        const currentCommit = execCommand(`git rev-parse ${branchName}`, { stdio: 'pipe' }).trim();

        if (latestCommit === currentCommit) {
          console.log(`  ✅ ${branchName} is up to date`);
        } else {
          // Update the branch to point to the latest commit
          execCommand(`git branch -f ${branchName} ${latestCommit}`, { stdio: 'pipe' });
          console.log(`  🔄 Updated ${branchName}: ${currentCommit.substring(0, 8)} -> ${latestCommit.substring(0, 8)}`);
        }

        successCount++;

      } catch (error) {
        console.log(`  ❌ Error updating ${submodule.path}: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`  ✅ Updated: ${successCount} branches`);
    if (errorCount > 0) {
      console.log(`  ❌ Errors: ${errorCount} submodules`);
    }

  } catch (error) {
    console.error('❌ Error updating mirror branches:', error.message);
    process.exit(1);
  }
}

updateMirrorBranches();