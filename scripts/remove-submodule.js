#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');

function execCommand(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf8', ...options });
  } catch (error) {
    throw error;
  }
}

function removeSubmodule() {
  const args = process.argv.slice(2);

  if (args.length !== 1) {
    console.log('Usage: npm run submodules:remove <local-path>');
    console.log('Example: npm run submodules:remove old-app');
    process.exit(1);
  }

  const localPath = args[0];

  if (!fs.existsSync(localPath)) {
    console.error(`❌ Error: Directory '${localPath}' not found`);
    process.exit(1);
  }

  try {
    execCommand(`git submodule status "${localPath}"`, { stdio: 'pipe' });
  } catch (error) {
    console.error(`❌ Error: '${localPath}' is not a submodule`);
    process.exit(1);
  }

  console.log(`🗑️  Removing submodule: ${localPath}`);
  console.log('');

  try {
    // Remove the submodule
    execCommand(`git submodule deinit -f "${localPath}"`, { stdio: 'inherit' });
    execCommand(`git rm -f "${localPath}"`, { stdio: 'inherit' });

    // Remove git modules directory if it exists
    const gitModulesPath = `.git/modules/${localPath}`;
    if (fs.existsSync(gitModulesPath)) {
      fs.rmSync(gitModulesPath, { recursive: true, force: true });
    }

    console.log('✅ Submodule removed successfully!');
    console.log('');
    console.log('📝 Next steps:');
    console.log('  1. Review the changes: git status');
    console.log(`  2. Commit the changes: git commit -m "Remove ${localPath} submodule"`);
    console.log('  3. Push to remote: git push');

  } catch (error) {
    console.error('❌ Error removing submodule:', error.message);
    process.exit(1);
  }
}

removeSubmodule();