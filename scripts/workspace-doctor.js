#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function execCommand(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf8', ...options });
  } catch (error) {
    return null;
  }
}

function getPackageManager() {
  if (fs.existsSync('pnpm-lock.yaml')) return 'pnpm';
  if (fs.existsSync('yarn.lock')) return 'yarn';
  if (fs.existsSync('package-lock.json')) return 'npm';
  return 'npm'; // default
}

function checkWorkspaceHealth() {
  console.log('🏥 Running workspace health check...\n');

  const issues = [];
  const packageManager = getPackageManager();
  console.log(`📦 Detected package manager: ${packageManager}`);

  // 1. Check workspace configuration consistency
  console.log('\n🔧 Checking workspace configuration...');

  const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const hasNpmWorkspaces = rootPkg.workspaces;
  const hasPnpmWorkspaces = fs.existsSync('pnpm-workspace.yaml');

  if (packageManager === 'pnpm' && !hasPnpmWorkspaces) {
    issues.push({
      type: 'error',
      message: 'Using pnpm but missing pnpm-workspace.yaml',
      fix: 'Create pnpm-workspace.yaml file'
    });
  }

  if ((packageManager === 'npm' || packageManager === 'yarn') && !hasNpmWorkspaces) {
    issues.push({
      type: 'error',
      message: `Using ${packageManager} but missing workspaces field in package.json`,
      fix: 'Add workspaces field to package.json'
    });
  }

  // 2. Check for workspace dependency issues
  console.log('🔗 Checking workspace dependencies...');

  const workspaces = [];
  if (hasNpmWorkspaces) {
    const workspaceList = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : rootPkg.workspaces.packages;
    workspaces.push(...workspaceList.filter(ws => !ws.includes('*')));
  }

  const packageNames = new Set();
  const duplicateNames = new Set();

  for (const workspace of workspaces) {
    const pkgPath = path.join(workspace, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

        if (packageNames.has(pkg.name)) {
          duplicateNames.add(pkg.name);
        }
        packageNames.add(pkg.name);

        // Check for workspace protocol usage
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        Object.entries(deps).forEach(([name, version]) => {
          if (typeof version === 'string') {
            if (version.startsWith('workspace:') && !version.includes('*')) {
              // Check if the referenced package exists
              if (!packageNames.has(name)) {
                issues.push({
                  type: 'warning',
                  message: `${workspace}: workspace dependency "${name}" not found in workspace`,
                  fix: 'Ensure the referenced workspace package exists'
                });
              }
            }
          }
        });

      } catch (error) {
        issues.push({
          type: 'error',
          message: `${workspace}: Invalid package.json - ${error.message}`,
          fix: 'Fix JSON syntax errors'
        });
      }
    }
  }

  if (duplicateNames.size > 0) {
    issues.push({
      type: 'error',
      message: `Duplicate package names found: ${Array.from(duplicateNames).join(', ')}`,
      fix: 'Rename packages to have unique names'
    });
  }

  // 3. Check for hoisting issues
  console.log('📤 Checking dependency hoisting...');

  const rootDeps = { ...rootPkg.dependencies, ...rootPkg.devDependencies };
  const commonDeps = new Map();

  for (const workspace of workspaces) {
    const pkgPath = path.join(workspace, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        Object.entries(deps).forEach(([name, version]) => {
          if (!version.startsWith('workspace:')) {
            if (commonDeps.has(name)) {
              commonDeps.get(name).push({ workspace, version });
            } else {
              commonDeps.set(name, [{ workspace, version }]);
            }
          }
        });
      } catch (error) {
        // Already handled above
      }
    }
  }

  // Find dependencies used by multiple workspaces with different versions
  for (const [depName, usages] of commonDeps) {
    if (usages.length > 2) { // Used by 3+ workspaces
      const versions = new Set(usages.map(u => u.version));
      if (versions.size > 1) {
        issues.push({
          type: 'warning',
          message: `Dependency "${depName}" has version conflicts across workspaces`,
          fix: 'Consider hoisting to root or standardizing versions'
        });
      } else if (!rootDeps[depName]) {
        issues.push({
          type: 'optimization',
          message: `Dependency "${depName}" used by ${usages.length} workspaces, consider hoisting`,
          fix: `Move to root package.json and use workspace: protocol in workspaces`
        });
      }
    }
  }

  // 4. Check for build order issues
  console.log('🏗️  Checking build order...');

  const buildablePackages = [];
  for (const workspace of workspaces) {
    const pkgPath = path.join(workspace, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.scripts?.build) {
          buildablePackages.push({
            name: pkg.name,
            workspace,
            dependencies: Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
              .filter(dep => packageNames.has(dep))
          });
        }
      } catch (error) {
        // Already handled above
      }
    }
  }

  // Simple cycle detection
  function hasCycle(packages) {
    const visited = new Set();
    const recursionStack = new Set();

    function dfs(packageName) {
      if (recursionStack.has(packageName)) return true;
      if (visited.has(packageName)) return false;

      visited.add(packageName);
      recursionStack.add(packageName);

      const pkg = packages.find(p => p.name === packageName);
      if (pkg) {
        for (const dep of pkg.dependencies) {
          if (dfs(dep)) return true;
        }
      }

      recursionStack.delete(packageName);
      return false;
    }

    for (const pkg of packages) {
      if (dfs(pkg.name)) return true;
    }
    return false;
  }

  if (hasCycle(buildablePackages)) {
    issues.push({
      type: 'error',
      message: 'Circular dependencies detected between workspace packages',
      fix: 'Restructure dependencies to remove cycles'
    });
  }

  // 5. Check package manager specific issues
  console.log(`🛠️  Checking ${packageManager}-specific issues...`);

  if (packageManager === 'pnpm') {
    // Check for .npmrc conflicts
    if (fs.existsSync('.npmrc')) {
      const npmrc = fs.readFileSync('.npmrc', 'utf8');
      if (npmrc.includes('hoist') && !npmrc.includes('shamefully-hoist')) {
        issues.push({
          type: 'warning',
          message: 'pnpm with hoisting configuration may cause issues',
          fix: 'Review .npmrc hoisting settings for pnpm compatibility'
        });
      }
    }
  }

  // 6. Check for common anti-patterns
  console.log('🚨 Checking for anti-patterns...');

  for (const workspace of workspaces) {
    const pkgPath = path.join(workspace, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

        // Check for postinstall scripts in workspace packages
        if (pkg.scripts?.postinstall) {
          issues.push({
            type: 'warning',
            message: `${workspace}: postinstall script may cause workspace issues`,
            fix: 'Move postinstall logic to root or use different lifecycle hook'
          });
        }

        // Check for conflicting peer dependencies
        if (pkg.peerDependencies && pkg.dependencies) {
          const conflicts = Object.keys(pkg.peerDependencies)
            .filter(dep => pkg.dependencies[dep]);

          if (conflicts.length > 0) {
            issues.push({
              type: 'warning',
              message: `${workspace}: peer dependencies also listed as dependencies: ${conflicts.join(', ')}`,
              fix: 'Remove from dependencies or peerDependencies to avoid conflicts'
            });
          }
        }

      } catch (error) {
        // Already handled above
      }
    }
  }

  return issues;
}

function generateHealthReport() {
  const issues = checkWorkspaceHealth();

  console.log('\n📊 Health Report Summary:');

  const errors = issues.filter(i => i.type === 'error');
  const warnings = issues.filter(i => i.type === 'warning');
  const optimizations = issues.filter(i => i.type === 'optimization');

  console.log(`  ❌ Errors: ${errors.length}`);
  console.log(`  ⚠️  Warnings: ${warnings.length}`);
  console.log(`  💡 Optimizations: ${optimizations.length}`);

  if (issues.length === 0) {
    console.log('\n🎉 Workspace is healthy!');
    return;
  }

  console.log('\n📋 Issues Found:');

  const groupedIssues = { error: errors, warning: warnings, optimization: optimizations };

  Object.entries(groupedIssues).forEach(([type, typeIssues]) => {
    if (typeIssues.length > 0) {
      const icon = type === 'error' ? '❌' : type === 'warning' ? '⚠️ ' : '💡';
      console.log(`\n${icon} ${type.toUpperCase()}S:`);

      typeIssues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue.message}`);
        console.log(`     💊 Fix: ${issue.fix}`);
      });
    }
  });

  if (errors.length > 0) {
    console.log('\n💥 Critical issues found! Fix errors before deploying.');
    process.exit(1);
  }
}

if (require.main === module) {
  generateHealthReport();
}

module.exports = { checkWorkspaceHealth, generateHealthReport };