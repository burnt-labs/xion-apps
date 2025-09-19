/**
 * Shared utilities for monorepo CLI scripts
 * Common patterns: exec commands, user input, file operations, logging
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Icons for consistent messaging
const icons = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  rocket: '🚀',
  package: '📦',
  security: '🔒',
  health: '🏥',
  automation: '🤖',
  git: '🔄',
  branch: '🌿',
  tag: '🏷️',
  build: '🏗️',
  test: '🧪',
  lint: '🔍',
  fix: '🔧',
  docs: '📚'
};

/**
 * Execute a command with proper error handling and output
 */
function execCommand(command, options = {}) {
  const defaultOptions = {
    encoding: 'utf8',
    stdio: 'inherit'
  };

  try {
    return execSync(command, { ...defaultOptions, ...options });
  } catch (error) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

/**
 * Execute a command silently (for checking/testing)
 */
function execQuiet(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      ...options
    });
  } catch (error) {
    return null;
  }
}

/**
 * Check if a command exists and is executable
 */
function commandExists(command) {
  try {
    execQuiet(`which ${command}`);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Prompt user for input with readline
 */
function createPrompt() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => {
    return new Promise(resolve => rl.question(query, resolve));
  };

  const close = () => rl.close();

  return { question, close };
}

/**
 * Logging utilities with consistent formatting
 */
const logger = {
  info: (message, icon = icons.info) => {
    console.log(`${icon} ${message}`);
  },

  success: (message, icon = icons.success) => {
    console.log(`${colors.green}${icon} ${message}${colors.reset}`);
  },

  error: (message, icon = icons.error) => {
    console.error(`${colors.red}${icon} ${message}${colors.reset}`);
  },

  warning: (message, icon = icons.warning) => {
    console.log(`${colors.yellow}${icon} ${message}${colors.reset}`);
  },

  step: (message, icon = icons.git) => {
    console.log(`\n${colors.cyan}${icon} ${message}${colors.reset}`);
  },

  substep: (message) => {
    console.log(`  ${colors.dim}${message}${colors.reset}`);
  },

  header: (message) => {
    console.log(`\n${colors.bright}${colors.blue}${message}${colors.reset}\n`);
  }
};

/**
 * File system utilities
 */
const fileUtils = {
  exists: (filePath) => fs.existsSync(filePath),

  readJson: (filePath) => {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      throw new Error(`Failed to read JSON file ${filePath}: ${error.message}`);
    }
  },

  writeJson: (filePath, data, indent = 2) => {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, indent) + '\n');
    } catch (error) {
      throw new Error(`Failed to write JSON file ${filePath}: ${error.message}`);
    }
  },

  readText: (filePath) => {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  },

  writeText: (filePath, content) => {
    try {
      fs.writeFileSync(filePath, content);
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error.message}`);
    }
  }
};

/**
 * Git utilities
 */
const gitUtils = {
  hasChanges: () => {
    return !execQuiet('git diff --quiet HEAD');
  },

  getCurrentBranch: () => {
    return execQuiet('git rev-parse --abbrev-ref HEAD')?.trim();
  },

  getCommitHash: (ref = 'HEAD') => {
    return execQuiet(`git rev-parse ${ref}`)?.trim();
  },

  getSubmodules: () => {
    const status = execQuiet('git submodule status');
    if (!status) return [];

    return status.trim().split('\n').map(line => {
      const parts = line.trim().split(' ');
      return {
        commit: parts[0].replace(/^[+-]/, ''),
        path: parts[1],
        ref: parts[2] || ''
      };
    }).filter(sub => sub.path);
  },

  isGitRepo: () => {
    return execQuiet('git rev-parse --git-dir') !== null;
  },

  configureBot: () => {
    execCommand('git config --global user.name "github-actions[bot]"');
    execCommand('git config --global user.email "github-actions[bot]@users.noreply.github.com"');
  }
};

/**
 * Package manager detection and utilities
 */
const packageUtils = {
  detectPackageManager: () => {
    if (fileUtils.exists('pnpm-lock.yaml')) return 'pnpm';
    if (fileUtils.exists('yarn.lock')) return 'yarn';
    if (fileUtils.exists('package-lock.json')) return 'npm';
    return 'npm'; // default
  },

  getInstallCommand: (packageManager = null) => {
    const pm = packageManager || packageUtils.detectPackageManager();
    const commands = {
      npm: 'npm ci',
      yarn: 'yarn install --frozen-lockfile',
      pnpm: 'pnpm install --frozen-lockfile'
    };
    return commands[pm] || commands.npm;
  },

  getAuditCommand: (packageManager = null) => {
    const pm = packageManager || packageUtils.detectPackageManager();
    const commands = {
      npm: 'npm audit --json',
      yarn: 'yarn audit --json',
      pnpm: 'pnpm audit --json'
    };
    return commands[pm] || commands.npm;
  },

  getFixCommand: (packageManager = null) => {
    const pm = packageManager || packageUtils.detectPackageManager();
    const commands = {
      npm: 'npm audit fix --force',
      yarn: 'yarn audit fix',
      pnpm: 'pnpm audit fix'
    };
    return commands[pm] || commands.npm;
  }
};

/**
 * Workspace utilities
 */
const workspaceUtils = {
  getWorkspaces: () => {
    try {
      const pkg = fileUtils.readJson('package.json');
      return pkg.workspaces || [];
    } catch (error) {
      return [];
    }
  },

  getWorkspacePackages: () => {
    const workspaces = workspaceUtils.getWorkspaces();
    const packages = [];

    for (const workspace of workspaces) {
      if (workspace.includes('*')) {
        // Handle glob patterns
        const baseDir = workspace.replace('/*', '');
        if (fileUtils.exists(baseDir)) {
          const subdirs = fs.readdirSync(baseDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => path.join(baseDir, dirent.name));

          for (const subdir of subdirs) {
            if (fileUtils.exists(path.join(subdir, 'package.json'))) {
              packages.push(subdir);
            }
          }
        }
      } else {
        // Direct workspace path
        if (fileUtils.exists(path.join(workspace, 'package.json'))) {
          packages.push(workspace);
        }
      }
    }

    return packages;
  }
};

/**
 * Error handling utilities
 */
function handleError(error, context = 'Operation') {
  logger.error(`${context} failed: ${error.message}`);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
}

/**
 * Progress indicator for long operations
 */
function createSpinner(message) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let index = 0;

  const interval = setInterval(() => {
    process.stdout.write(`\r${frames[index]} ${message}`);
    index = (index + 1) % frames.length;
  }, 80);

  return {
    stop: (finalMessage = '') => {
      clearInterval(interval);
      process.stdout.write(`\r${finalMessage ? finalMessage : message}\n`);
    }
  };
}

/**
 * Validation utilities
 */
const validators = {
  semver: (version) => {
    return /^v?\d+\.\d+\.\d+/.test(version);
  },

  required: (value, name) => {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      throw new Error(`${name} is required`);
    }
    return true;
  },

  oneOf: (value, options, name) => {
    if (!options.includes(value)) {
      throw new Error(`${name} must be one of: ${options.join(', ')}`);
    }
    return true;
  }
};

module.exports = {
  execCommand,
  execQuiet,
  commandExists,
  createPrompt,
  logger,
  fileUtils,
  gitUtils,
  packageUtils,
  workspaceUtils,
  handleError,
  createSpinner,
  validators,
  colors,
  icons
};