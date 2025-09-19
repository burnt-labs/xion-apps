#!/usr/bin/env node
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function execCommand(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf8', ...options });
  } catch (error) {
    throw error;
  }
}

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function getDefaultBranch(submodulePath) {
  try {
    const originalDir = process.cwd();
    process.chdir(submodulePath);

    // Try to get the default branch from remote HEAD
    try {
      const defaultBranch = execCommand('git symbolic-ref refs/remotes/origin/HEAD', { stdio: 'pipe' })
        .trim()
        .replace('refs/remotes/origin/', '');
      process.chdir(originalDir);
      return defaultBranch;
    } catch (error) {
      // Fallback: check if main exists, otherwise use master
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
    return 'main'; // Default fallback
  }
}

async function syncMainBranches() {
  try {
    console.log('🌿 Syncing submodule main branches...');

    // Get list of submodules
    const submoduleStatus = execCommand('git submodule status', { stdio: 'pipe' }).trim();

    if (!submoduleStatus) {
      console.log('ℹ️  No submodules found');
      rl.close();
      return;
    }

    const submodules = submoduleStatus
      .split('\n')
      .map(line => {
        const parts = line.trim().split(' ');
        return {
          commit: parts[0].replace(/^[+-]/, ''),
          path: parts[1],
          ref: parts[2] || ''
        };
      })
      .filter(sub => sub.path);

    console.log(`📦 Found ${submodules.length} submodules`);

    const shouldProceed = await question(`\n🔄 Create/update main branch mirrors for all submodules? (y/N): `);

    if (shouldProceed.toLowerCase() !== 'y') {
      console.log('ℹ️  Operation cancelled');
      rl.close();
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const submodule of submodules) {
      console.log(`\n📦 Processing ${submodule.path}...`);

      try {
        // Get the default branch name for this submodule
        const defaultBranch = getDefaultBranch(submodule.path);
        const branchName = `${submodule.path}/${defaultBranch}`;

        console.log(`  🌿 Default branch: ${defaultBranch}`);
        console.log(`  🔗 Creating branch: ${branchName}`);

        // Check if branch already exists
        try {
          execCommand(`git show-ref --verify --quiet refs/heads/${branchName}`, { stdio: 'pipe' });
          console.log(`  ♻️  Branch ${branchName} already exists, updating...`);

          // Delete existing branch
          execCommand(`git branch -D ${branchName}`, { stdio: 'pipe' });
        } catch (error) {
          // Branch doesn't exist, which is fine
        }

        // Get the latest commit from the submodule's default branch
        const originalDir = process.cwd();
        process.chdir(submodule.path);

        // Fetch latest changes
        execCommand('git fetch origin', { stdio: 'pipe' });

        // Get the latest commit hash from the default branch
        const latestCommit = execCommand(`git rev-parse origin/${defaultBranch}`, { stdio: 'pipe' }).trim();

        process.chdir(originalDir);

        // Create the branch pointing to the submodule's latest commit
        execCommand(`git branch ${branchName} ${latestCommit}`, { stdio: 'pipe' });

        console.log(`  ✅ Created ${branchName} -> ${latestCommit.substring(0, 8)}`);
        successCount++;

      } catch (error) {
        console.log(`  ❌ Error processing ${submodule.path}: ${error.message}`);
        errorCount++;
      }
    }

    // Show all created branches
    console.log('\n🌿 Mirror branches created:');
    try {
      const branches = execCommand('git branch --list "*/main" "*/master"', { stdio: 'pipe' })
        .trim()
        .split('\n')
        .filter(branch => branch.trim());

      branches.forEach(branch => {
        console.log(`  ${branch.trim()}`);
      });
    } catch (error) {
      // Ignore if no branches found
    }

    console.log('\n📊 Summary:');
    console.log(`  ✅ Successful: ${successCount} branches`);
    if (errorCount > 0) {
      console.log(`  ❌ Errors: ${errorCount} submodules`);
    }

    console.log('\n💡 Usage tips:');
    console.log('  git branch --list "*/main" "*/master"  # List all mirror branches');
    console.log('  git log assets/main                    # View assets main branch history');
    console.log('  git diff HEAD assets/main              # Compare current state to assets main');

  } catch (error) {
    console.error('❌ Error syncing branches:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

syncMainBranches();