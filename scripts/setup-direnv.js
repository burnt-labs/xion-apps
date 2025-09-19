#!/usr/bin/env node
/**
 * Directory Environment Setup - Automatic Git operations via direnv
 * Creates .envrc files that override Git behavior for seamless automation
 */

const { execCommand, execQuiet, logger, gitUtils, fileUtils, icons } = require('./utils');
const fs = require('fs');
const path = require('path');

class DirectoryEnvironmentSetup {
  constructor() {
    this.direnvTemplates = {
      root: this.getRootEnvrcTemplate(),
      submodule: this.getSubmoduleEnvrcTemplate(),
      service: this.getServiceEnvrcTemplate()
    };
  }

  async setupDirectoryEnvironments() {
    logger.header('🏗️ Setting up Directory Environment Automation');

    // Check if direnv is installed
    if (!this.checkDirenvInstalled()) {
      logger.warning('direnv not installed. Install with: brew install direnv (macOS) or apt install direnv (Ubuntu)');
      logger.info('Add to shell profile: eval "$(direnv hook bash)" or eval "$(direnv hook zsh)"');
    }

    // Setup root .envrc
    await this.setupRootEnvironment();

    // Setup submodule .envrc files
    await this.setupSubmoduleEnvironments();

    // Create Git helper scripts
    await this.createGitHelperScripts();

    // Setup Git hooks integration
    await this.setupGitHooksIntegration();

    logger.success('Directory environment automation setup complete');
  }

  checkDirenvInstalled() {
    try {
      execQuiet('which direnv');
      return true;
    } catch (error) {
      return false;
    }
  }

  async setupRootEnvironment() {
    logger.step('Setting up root .envrc', icons.settings);

    const envrcPath = '.envrc';
    const content = this.direnvTemplates.root;

    fs.writeFileSync(envrcPath, content);

    // Allow the .envrc file
    try {
      execCommand('direnv allow .');
      logger.success('Root .envrc created and allowed');
    } catch (error) {
      logger.warning('Could not auto-allow .envrc - run: direnv allow .');
    }
  }

  async setupSubmoduleEnvironments() {
    logger.step('Setting up submodule .envrc files', icons.package);

    const submodules = gitUtils.getSubmodules();

    for (const submodule of submodules) {
      await this.setupSubmoduleEnvironment(submodule.path);
    }
  }

  async setupSubmoduleEnvironment(submodulePath) {
    if (!fs.existsSync(submodulePath)) {
      logger.warning(`Submodule ${submodulePath} does not exist, skipping`);
      return;
    }

    logger.info(`Setting up environment for ${submodulePath}`);

    const envrcPath = path.join(submodulePath, '.envrc');
    const content = this.getServiceEnvrcTemplate(submodulePath);

    fs.writeFileSync(envrcPath, content);

    // Allow the .envrc file
    try {
      execCommand(`cd ${submodulePath} && direnv allow .`);
    } catch (error) {
      logger.warning(`Could not auto-allow ${submodulePath}/.envrc`);
    }
  }

  async createGitHelperScripts() {
    logger.step('Creating Git helper scripts', icons.git);

    // Create scripts directory for Git helpers
    const scriptsDir = 'scripts/git-helpers';
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
    }

    // Auto-commit helper
    const autoCommitScript = `#!/bin/bash
# Auto-commit with standardized message
set -e

SERVICE_NAME="\${PWD##*/}"
COMMIT_TYPE="\${1:-feat}"
COMMIT_MESSAGE="\${2:-automated update}"

# Check if we're in a submodule
if git rev-parse --show-superproject-working-tree > /dev/null 2>&1; then
  echo "🤖 Auto-committing in \$SERVICE_NAME"

  # Stage all changes
  git add .

  # Check if there are changes to commit
  if git diff --cached --quiet; then
    echo "No changes to commit"
    exit 0
  fi

  # Generate standardized commit message
  FULL_MESSAGE="\$COMMIT_TYPE(\$SERVICE_NAME): \$COMMIT_MESSAGE

Co-Authored-By: Automation <automation@burnt.com>"

  git commit -m "\$FULL_MESSAGE"
  echo "✅ Auto-committed changes in \$SERVICE_NAME"
else
  echo "Not in a submodule, skipping auto-commit"
fi
`;

    fs.writeFileSync(path.join(scriptsDir, 'auto-commit.sh'), autoCommitScript);
    execCommand(`chmod +x ${scriptsDir}/auto-commit.sh`);

    // Auto-push helper
    const autoPushScript = `#!/bin/bash
# Auto-push with safety checks
set -e

SERVICE_NAME="\${PWD##*/}"
BRANCH="\${1:-\$(git branch --show-current)}"

echo "🚀 Auto-pushing \$SERVICE_NAME to \$BRANCH"

# Safety checks
if [[ "\$BRANCH" == "main" || "\$BRANCH" == "master" ]]; then
  echo "⚠️ Pushing to main branch, running safety checks..."

  # Run tests if they exist
  if [ -f "package.json" ] && npm run test --if-present > /dev/null 2>&1; then
    npm run test
  fi

  # Run linting if available
  if [ -f "package.json" ] && npm run lint --if-present > /dev/null 2>&1; then
    npm run lint
  fi
fi

# Push with lease protection
git push --force-with-lease origin "\$BRANCH"
echo "✅ Successfully pushed \$SERVICE_NAME"
`;

    fs.writeFileSync(path.join(scriptsDir, 'auto-push.sh'), autoPushScript);
    execCommand(`chmod +x ${scriptsDir}/auto-push.sh`);

    // Sync helper
    const syncScript = `#!/bin/bash
# Auto-sync with upstream
set -e

SERVICE_NAME="\${PWD##*/}"
echo "🔄 Auto-syncing \$SERVICE_NAME"

# Fetch latest changes
git fetch --all --tags

# Get current branch
CURRENT_BRANCH=\$(git branch --show-current)

# Sync with upstream
if git rev-parse --verify "origin/\$CURRENT_BRANCH" > /dev/null 2>&1; then
  git rebase "origin/\$CURRENT_BRANCH"
  echo "✅ Synced \$SERVICE_NAME with upstream"
else
  echo "⚠️ No upstream branch found for \$CURRENT_BRANCH"
fi
`;

    fs.writeFileSync(path.join(scriptsDir, 'auto-sync.sh'), syncScript);
    execCommand(`chmod +x ${scriptsDir}/auto-sync.sh`);
  }

  async setupGitHooksIntegration() {
    logger.step('Integrating with Git hooks', icons.hook);

    // Update pre-commit hook to use direnv
    const preCommitPath = '.husky/pre-commit';
    if (fs.existsSync(preCommitPath)) {
      let content = fs.readFileSync(preCommitPath, 'utf8');

      // Add direnv loading at the top
      if (!content.includes('direnv exec')) {
        const direnvLine = '\n# Load direnv environment\nif command -v direnv > /dev/null; then\n  eval "$(direnv export bash)"\nfi\n';
        content = content.replace('#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"',
                                 '#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"' + direnvLine);

        fs.writeFileSync(preCommitPath, content);
        logger.success('Updated pre-commit hook with direnv integration');
      }
    }
  }

  getRootEnvrcTemplate() {
    return `# XION Apps Monorepo Environment
# Automatic Git operations and development environment

# Export repository information
export XION_APPS_ROOT="$(pwd)"
export XION_APPS_NAME="xion-apps"

# Git automation settings
export GIT_AUTO_FETCH=true
export GIT_AUTO_COMMIT=false
export GIT_AUTO_PUSH=false

# Development settings
export NODE_ENV=development
export PNPM_HOME="$HOME/.local/share/pnpm"

# Add helper scripts to PATH
PATH_add scripts/git-helpers

# Cloudflare Workers settings
export CLOUDFLARE_ACCOUNT_ID="your-account-id-here"

# Auto-fetch submodules on directory entry
if [[ "$GIT_AUTO_FETCH" == "true" ]]; then
  echo "🔄 Auto-fetching submodule updates..."
  git submodule foreach 'git fetch --quiet || true' &
fi

# Load submodule environment when entering subdirectories
watch_file .gitmodules

echo "🏗️ XION Apps monorepo environment loaded"
echo "📂 Root: $XION_APPS_ROOT"
echo "🔧 Git helpers available: auto-commit.sh, auto-push.sh, auto-sync.sh"
`;
  }

  getSubmoduleEnvrcTemplate() {
    return `# Submodule Environment Template
# This will be customized per service

# Load parent environment
source_up

# Service identification
export SERVICE_NAME="$(basename $(pwd))"
export IS_SUBMODULE=true

# Git automation for this service
export GIT_AUTO_COMMIT=true
export GIT_AUTO_PUSH=false

# Service-specific settings
if [[ -f "package.json" ]]; then
  export HAS_PACKAGE_JSON=true

  # Auto-install dependencies on entry
  if [[ ! -d "node_modules" ]]; then
    echo "📦 Installing dependencies for $SERVICE_NAME..."
    npm install --silent
  fi
fi

# Cloudflare Workers specific
if [[ -f "wrangler.toml" ]]; then
  export IS_WORKER=true
  export WORKER_NAME="$SERVICE_NAME"
fi

echo "🚀 Service environment loaded: $SERVICE_NAME"
`;
  }

  getServiceEnvrcTemplate(servicePath) {
    const serviceName = path.basename(servicePath);

    return `# ${serviceName} Service Environment
# Auto-generated environment configuration

# Load parent environment
source_up

# Service identification
export SERVICE_NAME="${serviceName}"
export SERVICE_PATH="${servicePath}"
export IS_SUBMODULE=true

# Git automation settings
export GIT_AUTO_COMMIT=true
export GIT_AUTO_PUSH=false
export GIT_COMMIT_PREFIX="${serviceName}"

# Service-specific automation
export AUTO_BUILD=false
export AUTO_TEST=false
export AUTO_LINT=true

# Development helpers
alias commit="auto-commit.sh"
alias push="auto-push.sh"
alias sync="auto-sync.sh"
alias deploy="wrangler deploy"

# Auto-actions on directory entry
if [[ -f "package.json" ]] && [[ ! -d "node_modules" ]]; then
  echo "📦 Auto-installing dependencies for ${serviceName}..."
  npm install --silent &
fi

# Git status check
if git status --porcelain | grep -q .; then
  echo "⚠️ ${serviceName} has uncommitted changes"
fi

echo "🔧 ${serviceName} environment ready"
echo "💡 Use: commit, push, sync, deploy"
`;
  }
}

async function main() {
  const setup = new DirectoryEnvironmentSetup();

  try {
    await setup.setupDirectoryEnvironments();

    console.log('\n📋 Next Steps:');
    console.log('1. Install direnv: brew install direnv (macOS) or apt install direnv (Ubuntu)');
    console.log('2. Add to shell: eval "$(direnv hook bash)" or eval "$(direnv hook zsh)"');
    console.log('3. Restart terminal or source your shell profile');
    console.log('4. Navigate to any submodule directory to see automation in action');
    console.log('5. Use helper commands: commit, push, sync, deploy');

  } catch (error) {
    logger.error(`Directory environment setup failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { DirectoryEnvironmentSetup };