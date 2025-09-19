#!/usr/bin/env node
/**
 * Unified automation script - handles all monorepo automation tasks
 * Usage: npm run automate <command> [options]
 */

const {
  execCommand,
  execQuiet,
  createPrompt,
  logger,
  fileUtils,
  gitUtils,
  packageUtils,
  handleError,
  validators,
  icons
} = require('./utils');

const { question, close } = createPrompt();

async function updateSubmodules(force = false) {
  logger.step('Checking for submodule updates', icons.git);

  // Get current status
  execCommand('git submodule status > /tmp/before_status.txt');

  // Update all submodules to latest
  execCommand(`git submodule foreach '
    echo "📦 Checking $name..."
    git fetch origin
    DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed "s@^refs/remotes/origin/@@" 2>/dev/null || echo "main")
    CURRENT_COMMIT=$(git rev-parse HEAD)
    LATEST_COMMIT=$(git rev-parse origin/$DEFAULT_BRANCH)

    if [ "$CURRENT_COMMIT" != "$LATEST_COMMIT" ] || [ "${force}" = "true" ]; then
      echo "🔄 Updating $name..."
      git checkout $DEFAULT_BRANCH
      git pull origin $DEFAULT_BRANCH
    else
      echo "✅ $name is up to date"
    fi
  '`);

  // Check if anything changed
  const hasChanges = gitUtils.hasChanges();

  if (hasChanges || force) {
    logger.info('📝 Changes detected!');

    // Update mirror branches
    try {
      execCommand('npm run branches:update');
    } catch (error) {
      logger.warning('Mirror branches not set up, skipping...');
    }

    const shouldCommit = await question('💾 Commit submodule updates? (y/N): ');
    if (shouldCommit.toLowerCase() === 'y') {
      execCommand('git add .');

      const commitMsg = `Update submodules to latest versions

$(git submodule status | grep "^+" | sed 's/^+/- /' | cut -d' ' -f2)

🤖 Generated automatically`;

      execCommand(`git commit -m "${commitMsg}"`);

      const shouldPush = await question('🚀 Push changes? (y/N): ');
      if (shouldPush.toLowerCase() === 'y') {
        execCommand('git push');
      }
    }
  } else {
    logger.success('All submodules are up to date');
  }
}

async function runSecurityCheck() {
  logger.step('Running security check', icons.security);

  let issuesFound = false;
  const results = [];

  // Check main repo
  logger.substep('Checking main repository...');
  const auditCmd = packageUtils.getAuditCommand();
  const mainAudit = execQuiet(auditCmd);
  if (mainAudit) {
    try {
      const audit = JSON.parse(mainAudit);
      const vulnCount = audit.metadata?.vulnerabilities?.total || 0;
      if (vulnCount > 0) {
        issuesFound = true;
        results.push(`Main repo: ${vulnCount} vulnerabilities`);
      }
    } catch (error) {
      // Ignore JSON parse errors
    }
  }

  // Check submodules
  execCommand(`git submodule foreach '
    if [ -f "package.json" ]; then
      echo "🔍 Checking $name..."

      # Determine package manager and install
      if [ -f "pnpm-lock.yaml" ]; then
        pnpm audit --json > /tmp/${name}_audit.json 2>/dev/null || echo "{}" > /tmp/${name}_audit.json
      elif [ -f "yarn.lock" ]; then
        yarn audit --json > /tmp/${name}_audit.json 2>/dev/null || echo "{}" > /tmp/${name}_audit.json
      else
        npm audit --json > /tmp/${name}_audit.json 2>/dev/null || echo "{}" > /tmp/${name}_audit.json
      fi
    fi
  '`);

  // Process submodule results
  const submodules = execQuiet('git submodule status').trim().split('\n')
    .map(line => line.split(' ')[1]).filter(Boolean);

  for (const submodule of submodules) {
    const auditFile = `/tmp/${submodule}_audit.json`;
    if (fs.existsSync(auditFile)) {
      try {
        const audit = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
        const vulnCount = audit.metadata?.vulnerabilities?.total || audit.summary?.total || 0;
        if (vulnCount > 0) {
          issuesFound = true;
          results.push(`${submodule}: ${vulnCount} vulnerabilities`);
        }
      } catch (error) {
        // Ignore JSON parse errors
      }
    }
  }

  if (issuesFound) {
    logger.warning('Security issues found:');
    results.forEach(result => logger.substep(result));

    const shouldFix = await question('🔧 Attempt to auto-fix? (y/N): ');
    if (shouldFix.toLowerCase() === 'y') {
      await applySecurityFixes();
    }
  } else {
    logger.success('No security vulnerabilities found!');
  }
}

async function applySecurityFixes() {
  console.log('🔧 Applying security fixes...');

  // Fix main repo
  try {
    execCommand('npm audit fix --force');
    console.log('✅ Applied fixes to main repo');
  } catch (error) {
    console.log('⚠️  Could not auto-fix main repo');
  }

  // Fix submodules
  execCommand(`git submodule foreach '
    if [ -f "package.json" ]; then
      echo "🔧 Fixing $name..."

      if [ -f "pnpm-lock.yaml" ]; then
        pnpm audit fix || echo "Could not auto-fix $name"
      elif [ -f "yarn.lock" ]; then
        yarn audit fix || echo "Could not auto-fix $name"
      else
        npm audit fix --force || echo "Could not auto-fix $name"
      fi

      # Commit if changes were made
      if ! git diff --quiet; then
        git add .
        git commit -m "🔒 Apply security fixes (automated)"
      fi
    fi
  '`);

  console.log('🔄 Updating submodule pointers...');
  execCommand('git add .');

  if (!execQuiet('git diff --quiet HEAD')) {
    execCommand('git commit -m "🔒 Apply security fixes across submodules"');
  }
}

async function runHealthCheck() {
  console.log('🏥 Running health check...');

  let allHealthy = true;

  try {
    execCommand('npm run workspace:doctor');
    console.log('✅ Workspace health: GOOD');
  } catch (error) {
    console.log('❌ Workspace health: ISSUES FOUND');
    allHealthy = false;
  }

  try {
    execCommand('npm run workspace:validate');
    console.log('✅ Deployment readiness: GOOD');
  } catch (error) {
    console.log('❌ Deployment readiness: ISSUES FOUND');
    allHealthy = false;
  }

  if (!allHealthy) {
    const shouldFix = await question('🔧 Attempt to auto-fix workspace issues? (y/N): ');
    if (shouldFix.toLowerCase() === 'y') {
      await fixWorkspaceIssues();
    }
  }

  return allHealthy;
}

async function fixWorkspaceIssues() {
  console.log('🔧 Attempting to fix workspace issues...');

  // Sync workspace configurations
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const workspaces = packageJson.workspaces || [];

  // Update pnpm-workspace.yaml
  const pnpmContent = `packages:
  # All submodule directories as workspace packages
${workspaces.filter(ws => !ws.includes('*')).map(ws => `  - "${ws}"`).join('\n')}

  # Wildcard pattern for any new packages
  - "packages/*"
`;

  fs.writeFileSync('pnpm-workspace.yaml', pnpmContent);

  // Remove conflicting lock files
  if (fs.existsSync('pnpm-lock.yaml')) {
    execQuiet('find . -name "package-lock.json" -delete');
    execQuiet('find . -path "./node_modules" -prune -o -name "yarn.lock" -delete');
  }

  console.log('✅ Applied workspace fixes');
}

async function createRelease(version, type = 'minor') {
  console.log(`🏷️  Creating ${type} release: ${version}`);

  // Validate inputs
  if (!version.match(/^v?\d+\.\d+\.\d+/)) {
    console.error('❌ Invalid version format. Use semver (e.g., v1.0.0)');
    return;
  }

  // Check working directory
  if (!execQuiet('git diff --quiet HEAD')) {
    const proceed = await question('⚠️  Working directory has changes. Continue? (y/N): ');
    if (proceed.toLowerCase() !== 'y') {
      console.log('ℹ️  Release cancelled');
      return;
    }
  }

  const message = await question(`📝 Release message for ${version} (Enter for default): `);
  const releaseMessage = message.trim() || `Release ${version}`;

  // Update package.json version
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = version.replace(/^v/, '');
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

  // Commit version bump
  execCommand(`git add package.json`);
  execCommand(`git commit -m "🔖 Bump version to ${version}"`);

  // Create and push release
  execCommand(`npm run release ${version}`);

  console.log(`🎉 Release ${version} created successfully!`);
}

async function dailyMaintenance() {
  console.log('🌅 Running daily maintenance...');

  console.log('\n1️⃣  Updating submodules...');
  await updateSubmodules();

  console.log('\n2️⃣  Running health check...');
  const healthy = await runHealthCheck();

  console.log('\n3️⃣  Security check...');
  await runSecurityCheck();

  console.log('\n📊 Daily maintenance complete!');
  console.log(`   Health: ${healthy ? '✅ Good' : '⚠️  Issues found'}`);
}

function showHelp() {
  console.log(`
🤖 Monorepo Automation Tool

Usage: npm run automate <command> [options]

Commands:
  update              Update all submodules to latest
  security            Run security audit and fixes
  health              Run workspace health check
  release <version>   Create a new release
  daily               Run daily maintenance (update + health + security)

Examples:
  npm run automate update
  npm run automate security
  npm run automate health
  npm run automate release v1.2.0
  npm run automate daily

Options:
  --force             Force operations even if no changes detected
  --auto-fix          Automatically apply fixes without prompting
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const options = {
    force: args.includes('--force'),
    autoFix: args.includes('--auto-fix')
  };

  console.log('🤖 Monorepo Automation Tool\n');

  try {
    switch (command) {
      case 'update':
        await updateSubmodules(options.force);
        break;
      case 'security':
        await runSecurityCheck();
        break;
      case 'health':
        await runHealthCheck();
        break;
      case 'release':
        const version = args[1];
        if (!version) {
          console.error('❌ Version required for release command');
          process.exit(1);
        }
        await createRelease(version);
        break;
      case 'daily':
        await dailyMaintenance();
        break;
      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;
      default:
        console.error('❌ Unknown command:', command);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('💥 Automation failed:', error.message);
    process.exit(1);
  } finally {
    close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { updateSubmodules, runSecurityCheck, runHealthCheck, createRelease };