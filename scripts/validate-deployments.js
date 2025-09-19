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

function checkPackageJson(packagePath) {
  const issues = [];

  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const dir = path.dirname(packagePath);

    // Check for deployment-breaking patterns

    // 1. Check for workspace protocol dependencies in production
    if (pkg.dependencies) {
      Object.entries(pkg.dependencies).forEach(([name, version]) => {
        if (typeof version === 'string' && version.startsWith('workspace:')) {
          issues.push({
            type: 'error',
            category: 'workspace-dependency',
            message: `Production dependency "${name}" uses workspace protocol: ${version}`,
            fix: 'Use specific version or range instead of workspace: protocol for production dependencies'
          });
        }
      });
    }

    // 2. Check for missing build script if it's a web project
    const hasWebIndicators = [
      pkg.scripts?.dev?.includes('vite'),
      pkg.scripts?.dev?.includes('next'),
      pkg.scripts?.dev?.includes('react-scripts'),
      pkg.dependencies?.react || pkg.devDependencies?.react,
      pkg.dependencies?.vue || pkg.devDependencies?.vue,
      fs.existsSync(path.join(dir, 'index.html')),
      fs.existsSync(path.join(dir, 'public'))
    ].some(Boolean);

    if (hasWebIndicators && !pkg.scripts?.build) {
      issues.push({
        type: 'warning',
        category: 'missing-build',
        message: 'Web project missing build script',
        fix: 'Add a build script for deployment'
      });
    }

    // 3. Check for hardcoded localhost URLs
    const scriptString = JSON.stringify(pkg.scripts || {});
    if (scriptString.includes('localhost') || scriptString.includes('127.0.0.1')) {
      issues.push({
        type: 'warning',
        category: 'hardcoded-localhost',
        message: 'Scripts contain hardcoded localhost URLs',
        fix: 'Use environment variables for URLs in deployment scripts'
      });
    }

    // 4. Check for env file dependencies without fallbacks
    if (pkg.scripts) {
      Object.entries(pkg.scripts).forEach(([scriptName, script]) => {
        if (script.includes('.env') && !script.includes('.env.example')) {
          if (scriptName.includes('build') || scriptName.includes('deploy')) {
            issues.push({
              type: 'warning',
              category: 'env-dependency',
              message: `Build/deploy script "${scriptName}" depends on .env file`,
              fix: 'Ensure .env.example exists and deployment environment provides all required variables'
            });
          }
        }
      });
    }

    // 5. Check for missing main/module fields for library packages
    const isLibrary = pkg.name && (
      pkg.name.startsWith('@') ||
      !hasWebIndicators ||
      pkg.scripts?.prepublishOnly
    );

    if (isLibrary && !pkg.main && !pkg.module && !pkg.exports) {
      issues.push({
        type: 'error',
        category: 'missing-entry',
        message: 'Library package missing main/module/exports field',
        fix: 'Add main, module, or exports field to package.json'
      });
    }

    // 6. Check for conflicting package managers
    const lockFiles = [
      fs.existsSync(path.join(dir, 'package-lock.json')),
      fs.existsSync(path.join(dir, 'yarn.lock')),
      fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))
    ];

    const lockFileCount = lockFiles.filter(Boolean).length;
    if (lockFileCount > 1) {
      issues.push({
        type: 'error',
        category: 'multiple-lockfiles',
        message: 'Multiple package manager lock files detected',
        fix: 'Remove unnecessary lock files and standardize on one package manager'
      });
    }

    // 7. Check for peer dependency issues
    if (pkg.peerDependencies) {
      Object.keys(pkg.peerDependencies).forEach(peerDep => {
        if (pkg.dependencies?.[peerDep] || pkg.devDependencies?.[peerDep]) {
          issues.push({
            type: 'warning',
            category: 'peer-dependency-conflict',
            message: `"${peerDep}" is both a peer dependency and regular dependency`,
            fix: 'Remove from dependencies if it should be provided by consumer'
          });
        }
      });
    }

    // 8. Check for missing repository field for publishable packages
    if (!pkg.private && !pkg.repository) {
      issues.push({
        type: 'warning',
        category: 'missing-repository',
        message: 'Public package missing repository field',
        fix: 'Add repository field for better package management'
      });
    }

    // 9. Check for outdated Node.js version requirements
    if (pkg.engines?.node) {
      const nodeVersion = pkg.engines.node;
      if (nodeVersion.includes('12') || nodeVersion.includes('14')) {
        issues.push({
          type: 'warning',
          category: 'outdated-node',
          message: `Node.js version requirement (${nodeVersion}) may be outdated`,
          fix: 'Consider updating to support newer Node.js versions'
        });
      }
    }

    return { pkg, issues };

  } catch (error) {
    return {
      pkg: null,
      issues: [{
        type: 'error',
        category: 'invalid-json',
        message: `Invalid package.json: ${error.message}`,
        fix: 'Fix JSON syntax errors'
      }]
    };
  }
}

function checkDeploymentFiles(dir, pkg) {
  const issues = [];

  // Check for common deployment files
  const deploymentFiles = [
    'Dockerfile',
    'docker-compose.yml',
    'vercel.json',
    'netlify.toml',
    'wrangler.toml',
    '.github/workflows',
    'deploy.yml',
    'deployment.yml'
  ];

  const hasDeploymentConfig = deploymentFiles.some(file =>
    fs.existsSync(path.join(dir, file))
  );

  // Check for env example file
  const hasEnvExample = fs.existsSync(path.join(dir, '.env.example'));
  const hasEnvFile = fs.existsSync(path.join(dir, '.env'));

  if (hasEnvFile && !hasEnvExample) {
    issues.push({
      type: 'warning',
      category: 'missing-env-example',
      message: 'Has .env file but missing .env.example',
      fix: 'Create .env.example with placeholder values for deployment guidance'
    });
  }

  // Check for build output in git
  const gitignoreExists = fs.existsSync(path.join(dir, '.gitignore'));
  if (!gitignoreExists && pkg?.scripts?.build) {
    issues.push({
      type: 'error',
      category: 'missing-gitignore',
      message: 'Build project missing .gitignore file',
      fix: 'Add .gitignore to exclude build outputs and node_modules'
    });
  }

  if (gitignoreExists) {
    const gitignore = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8');
    const buildOutputDirs = ['dist', 'build', '.next', 'out'];
    const missingIgnores = buildOutputDirs.filter(dir =>
      !gitignore.includes(dir) && pkg?.scripts?.build
    );

    if (missingIgnores.length > 0) {
      issues.push({
        type: 'warning',
        category: 'missing-build-ignore',
        message: `Build outputs not ignored: ${missingIgnores.join(', ')}`,
        fix: 'Add build output directories to .gitignore'
      });
    }
  }

  return issues;
}

function validateWorkspaces() {
  console.log('🔍 Validating workspace deployment compatibility...\n');

  const issues = [];
  let totalPackages = 0;
  let packagesWithIssues = 0;

  // Get all workspaces
  const workspaces = [];

  // Read from package.json workspaces
  try {
    const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (rootPkg.workspaces) {
      workspaces.push(...(Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : rootPkg.workspaces.packages));
    }
  } catch (error) {
    console.error('❌ Failed to read root package.json');
    return;
  }

  // Check each workspace
  for (const workspace of workspaces) {
    if (workspace.includes('*')) {
      // Handle glob patterns
      const baseDir = workspace.replace('/*', '');
      if (fs.existsSync(baseDir)) {
        const subdirs = fs.readdirSync(baseDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => path.join(baseDir, dirent.name));

        for (const subdir of subdirs) {
          const packageJsonPath = path.join(subdir, 'package.json');
          if (fs.existsSync(packageJsonPath)) {
            workspaces.push(subdir);
          }
        }
      }
    } else {
      // Direct workspace path
      const packageJsonPath = path.join(workspace, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        totalPackages++;

        console.log(`📦 Checking ${workspace}...`);

        const { pkg, issues: pkgIssues } = checkPackageJson(packageJsonPath);
        const deploymentIssues = checkDeploymentFiles(workspace, pkg);

        const allIssues = [...pkgIssues, ...deploymentIssues];

        if (allIssues.length > 0) {
          packagesWithIssues++;
          console.log(`  ⚠️  Found ${allIssues.length} issue(s):`);

          allIssues.forEach(issue => {
            const icon = issue.type === 'error' ? '❌' : '⚠️ ';
            console.log(`    ${icon} [${issue.category}] ${issue.message}`);
            console.log(`       💡 ${issue.fix}`);
          });

          issues.push({
            workspace,
            package: pkg?.name || 'unknown',
            issues: allIssues
          });
        } else {
          console.log('  ✅ No deployment issues found');
        }

        console.log('');
      }
    }
  }

  // Summary
  console.log('📊 Validation Summary:');
  console.log(`  📦 Total packages: ${totalPackages}`);
  console.log(`  ✅ Clean packages: ${totalPackages - packagesWithIssues}`);
  console.log(`  ⚠️  Packages with issues: ${packagesWithIssues}`);

  const errorCount = issues.reduce((count, pkg) =>
    count + pkg.issues.filter(issue => issue.type === 'error').length, 0
  );
  const warningCount = issues.reduce((count, pkg) =>
    count + pkg.issues.filter(issue => issue.type === 'warning').length, 0
  );

  console.log(`  ❌ Total errors: ${errorCount}`);
  console.log(`  ⚠️  Total warnings: ${warningCount}`);

  if (errorCount > 0) {
    console.log('\n💥 Deployment blockers found! Fix errors before deploying.');
    process.exit(1);
  } else if (warningCount > 0) {
    console.log('\n⚠️  Warnings found. Review before deploying.');
  } else {
    console.log('\n🎉 All packages are deployment-ready!');
  }

  return issues;
}

if (require.main === module) {
  validateWorkspaces();
}

module.exports = { validateWorkspaces, checkPackageJson, checkDeploymentFiles };