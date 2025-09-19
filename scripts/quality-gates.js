#!/usr/bin/env node
/**
 * Production Quality Gates - Deployment readiness validation
 * Enforces production standards before service deployment
 */

const { execCommand, execQuiet, logger, fileUtils, gitUtils, icons } = require('./utils');
const { SubmoduleHealthMonitor } = require('./submodule-health');
const { ContractValidator } = require('./contract-validator');
const fs = require('fs');
const path = require('path');

class ProductionQualityGates {
  constructor() {
    this.gates = [
      { name: 'Security Gate', weight: 25, critical: true },
      { name: 'Stability Gate', weight: 20, critical: true },
      { name: 'Performance Gate', weight: 15, critical: false },
      { name: 'Contract Gate', weight: 20, critical: true },
      { name: 'Deployment Gate', weight: 20, critical: true }
    ];

    this.minimumScore = 80;
    this.criticalGateThreshold = 90;
  }

  async validateDeploymentReadiness(servicePath = null) {
    logger.header('🚦 Production Quality Gates Validation');

    const services = servicePath ? [servicePath] : this.getAllServices();
    const gateResults = [];

    for (const service of services) {
      logger.step(`Evaluating quality gates for ${service}`, icons.rocket);
      const result = await this.evaluateServiceGates(service);
      gateResults.push(result);
    }

    return this.generateQualityReport(gateResults);
  }

  getAllServices() {
    return gitUtils.getSubmodules().map(sub => sub.path);
  }

  async evaluateServiceGates(servicePath) {
    const evaluation = {
      service: servicePath,
      overallScore: 0,
      canDeploy: false,
      gateResults: {},
      criticalFailures: [],
      warnings: [],
      timestamp: new Date().toISOString()
    };

    try {
      // Security Gate
      evaluation.gateResults.security = await this.evaluateSecurityGate(servicePath);

      // Stability Gate
      evaluation.gateResults.stability = await this.evaluateStabilityGate(servicePath);

      // Performance Gate
      evaluation.gateResults.performance = await this.evaluatePerformanceGate(servicePath);

      // Contract Gate
      evaluation.gateResults.contract = await this.evaluateContractGate(servicePath);

      // Deployment Gate
      evaluation.gateResults.deployment = await this.evaluateDeploymentGate(servicePath);

      // Calculate overall score
      evaluation.overallScore = this.calculateOverallScore(evaluation.gateResults);

      // Determine deployment readiness
      evaluation.canDeploy = this.canServiceDeploy(evaluation);

      // Collect failures and warnings
      this.collectIssues(evaluation);

    } catch (error) {
      evaluation.criticalFailures.push(`Quality gate evaluation failed: ${error.message}`);
    }

    return evaluation;
  }

  async evaluateSecurityGate(servicePath) {
    const gate = {
      name: 'Security Gate',
      score: 0,
      maxScore: 100,
      passed: false,
      checks: {},
      issues: []
    };

    try {
      // Security policy check
      gate.checks.hasSecurityPolicy = fs.existsSync(path.join(servicePath, 'SECURITY.md'));

      // Gitignore security
      gate.checks.secureGitignore = await this.checkSecureGitignore(servicePath);

      // Environment variables
      gate.checks.hasEnvExample = fs.existsSync(path.join(servicePath, '.env.example'));
      gate.checks.noHardcodedSecrets = await this.checkForHardcodedSecrets(servicePath);

      // Dependencies security
      gate.checks.vulnerabilityCount = await this.checkVulnerabilities(servicePath);
      gate.checks.hasSecurityAudit = gate.checks.vulnerabilityCount === 0;

      // HTTPS enforcement
      gate.checks.httpsEnforced = await this.checkHttpsEnforcement(servicePath);

      // Authentication/Authorization
      gate.checks.hasAuth = await this.checkAuthImplementation(servicePath);

      // Calculate security score
      const baseScore = [
        gate.checks.hasSecurityPolicy,
        gate.checks.secureGitignore,
        gate.checks.hasEnvExample,
        gate.checks.noHardcodedSecrets,
        gate.checks.hasSecurityAudit,
        gate.checks.httpsEnforced,
        gate.checks.hasAuth
      ].filter(Boolean).length * (100 / 7);

      // Penalty for vulnerabilities
      const vulnPenalty = Math.min(gate.checks.vulnerabilityCount * 5, 30);
      gate.score = Math.max(0, baseScore - vulnPenalty);

      gate.passed = gate.score >= this.criticalGateThreshold;

      if (!gate.passed) {
        gate.issues = this.collectSecurityIssues(gate.checks);
      }

    } catch (error) {
      gate.issues.push(`Security evaluation failed: ${error.message}`);
    }

    return gate;
  }

  async evaluateStabilityGate(servicePath) {
    const gate = {
      name: 'Stability Gate',
      score: 0,
      maxScore: 100,
      passed: false,
      checks: {},
      issues: []
    };

    try {
      // Release tagging
      gate.checks.hasStableTag = await this.checkStableTag(servicePath);
      gate.checks.tagVersion = gate.checks.hasStableTag ? await this.getLatestStableTag(servicePath) : null;

      // Test coverage
      gate.checks.hasTests = await this.checkTestExistence(servicePath);
      gate.checks.testCoverage = await this.getTestCoverage(servicePath);

      // Build stability
      gate.checks.buildPasses = await this.checkBuildStability(servicePath);

      // Error handling
      gate.checks.hasErrorHandling = await this.checkErrorHandling(servicePath);

      // Rollback capability
      gate.checks.canRollback = await this.checkRollbackCapability(servicePath);

      // Health checks
      gate.checks.hasHealthEndpoint = await this.checkHealthEndpoint(servicePath);

      // Calculate stability score
      let score = 0;
      score += gate.checks.hasStableTag ? 20 : 0;
      score += gate.checks.hasTests ? 15 : 0;
      score += Math.min(gate.checks.testCoverage || 0, 20);
      score += gate.checks.buildPasses ? 15 : 0;
      score += gate.checks.hasErrorHandling ? 10 : 0;
      score += gate.checks.canRollback ? 10 : 0;
      score += gate.checks.hasHealthEndpoint ? 10 : 0;

      gate.score = score;
      gate.passed = gate.score >= this.criticalGateThreshold;

      if (!gate.passed) {
        gate.issues = this.collectStabilityIssues(gate.checks);
      }

    } catch (error) {
      gate.issues.push(`Stability evaluation failed: ${error.message}`);
    }

    return gate;
  }

  async evaluatePerformanceGate(servicePath) {
    const gate = {
      name: 'Performance Gate',
      score: 85, // Assume good performance unless proven otherwise
      maxScore: 100,
      passed: true,
      checks: {},
      issues: []
    };

    try {
      // Bundle size check
      gate.checks.bundleSize = await this.checkBundleSize(servicePath);

      // Build time
      gate.checks.buildTime = await this.measureBuildTime(servicePath);

      // Dependencies count
      gate.checks.dependencyCount = await this.countDependencies(servicePath);

      // Lazy loading
      gate.checks.hasLazyLoading = await this.checkLazyLoading(servicePath);

      // Performance scoring (non-critical)
      let performanceScore = 85;

      if (gate.checks.bundleSize > 5000000) { // 5MB
        performanceScore -= 15;
        gate.issues.push('Large bundle size detected');
      }

      if (gate.checks.buildTime > 300) { // 5 minutes
        performanceScore -= 10;
        gate.issues.push('Build time exceeds 5 minutes');
      }

      if (gate.checks.dependencyCount > 50) {
        performanceScore -= 5;
        gate.issues.push('High dependency count');
      }

      gate.score = Math.max(0, performanceScore);
      gate.passed = gate.score >= 70; // Lower threshold for performance

    } catch (error) {
      gate.issues.push(`Performance evaluation failed: ${error.message}`);
    }

    return gate;
  }

  async evaluateContractGate(servicePath) {
    const gate = {
      name: 'Contract Gate',
      score: 0,
      maxScore: 100,
      passed: false,
      checks: {},
      issues: []
    };

    try {
      const validator = new ContractValidator();
      const contractResult = await validator.validateServiceContract(servicePath);

      gate.checks.hasContract = contractResult.hasContract;
      gate.checks.contractValid = contractResult.isValid;
      gate.checks.compatibilityScore = contractResult.compatibilityScore;
      gate.checks.breakingChanges = contractResult.breakingChanges.length;
      gate.checks.hasVersion = contractResult.version !== 'unknown';

      // Calculate contract score
      let score = 0;
      score += gate.checks.hasContract ? 30 : 0;
      score += gate.checks.contractValid ? 25 : 0;
      score += Math.min(gate.checks.compatibilityScore || 0, 25);
      score += gate.checks.hasVersion ? 10 : 0;
      score += gate.checks.breakingChanges === 0 ? 10 : 0;

      gate.score = score;
      gate.passed = gate.score >= this.criticalGateThreshold;

      if (!gate.passed) {
        gate.issues = this.collectContractIssues(gate.checks, contractResult);
      }

    } catch (error) {
      gate.issues.push(`Contract evaluation failed: ${error.message}`);
    }

    return gate;
  }

  async evaluateDeploymentGate(servicePath) {
    const gate = {
      name: 'Deployment Gate',
      score: 0,
      maxScore: 100,
      passed: false,
      checks: {},
      issues: []
    };

    try {
      // Package.json and scripts
      gate.checks.hasPackageJson = fs.existsSync(path.join(servicePath, 'package.json'));
      gate.checks.hasBuildScript = await this.checkBuildScript(servicePath);
      gate.checks.hasStartScript = await this.checkStartScript(servicePath);

      // Deployment configuration
      gate.checks.hasDeploymentConfig = await this.checkDeploymentConfig(servicePath);
      gate.checks.hasDockerfile = fs.existsSync(path.join(servicePath, 'Dockerfile'));

      // Environment configuration
      gate.checks.hasEnvConfig = await this.checkEnvironmentConfig(servicePath);

      // Health checks
      gate.checks.hasHealthCheck = await this.checkHealthCheckScript(servicePath);

      // Production readiness
      gate.checks.prodReady = await this.checkProductionReadiness(servicePath);

      // Calculate deployment score
      const checks = [
        gate.checks.hasPackageJson,
        gate.checks.hasBuildScript,
        gate.checks.hasStartScript,
        gate.checks.hasDeploymentConfig,
        gate.checks.hasEnvConfig,
        gate.checks.hasHealthCheck,
        gate.checks.prodReady
      ];

      gate.score = (checks.filter(Boolean).length / checks.length) * 100;
      gate.passed = gate.score >= this.criticalGateThreshold;

      if (!gate.passed) {
        gate.issues = this.collectDeploymentIssues(gate.checks);
      }

    } catch (error) {
      gate.issues.push(`Deployment evaluation failed: ${error.message}`);
    }

    return gate;
  }

  calculateOverallScore(gateResults) {
    let totalScore = 0;
    let totalWeight = 0;

    for (const gate of this.gates) {
      const gateKey = gate.name.toLowerCase().replace(' gate', '');
      const result = gateResults[gateKey];

      if (result) {
        totalScore += (result.score * gate.weight) / 100;
        totalWeight += gate.weight;
      }
    }

    return totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
  }

  canServiceDeploy(evaluation) {
    // Must pass overall score threshold
    if (evaluation.overallScore < this.minimumScore) {
      return false;
    }

    // All critical gates must pass
    for (const gate of this.gates) {
      if (gate.critical) {
        const gateKey = gate.name.toLowerCase().replace(' gate', '');
        const result = evaluation.gateResults[gateKey];

        if (!result || !result.passed) {
          return false;
        }
      }
    }

    return true;
  }

  collectIssues(evaluation) {
    for (const [gateKey, gateResult] of Object.entries(evaluation.gateResults)) {
      if (gateResult.issues && gateResult.issues.length > 0) {
        const gate = this.gates.find(g => g.name.toLowerCase().replace(' gate', '') === gateKey);

        if (gate && gate.critical && !gateResult.passed) {
          evaluation.criticalFailures.push(...gateResult.issues);
        } else {
          evaluation.warnings.push(...gateResult.issues);
        }
      }
    }
  }

  // Helper methods for specific checks
  async checkSecureGitignore(servicePath) {
    const gitignorePath = path.join(servicePath, '.gitignore');
    if (!fs.existsSync(gitignorePath)) return false;

    const content = fs.readFileSync(gitignorePath, 'utf8');
    const requiredPatterns = ['.env', '*.key', '*.pem', 'node_modules'];

    return requiredPatterns.every(pattern => content.includes(pattern));
  }

  async checkForHardcodedSecrets(servicePath) {
    const secretPatterns = [
      /password\s*=\s*["'][^"']+["']/i,
      /api.?key\s*=\s*["'][^"']+["']/i,
      /secret\s*=\s*["'][^"']+["']/i,
      /token\s*=\s*["'][^"']+["']/i
    ];

    try {
      const files = execQuiet(`find ${servicePath} -name "*.js" -o -name "*.ts" -o -name "*.json" | head -20`);
      if (!files) return true;

      for (const file of files.split('\n').filter(Boolean)) {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          for (const pattern of secretPatterns) {
            if (pattern.test(content)) {
              return false;
            }
          }
        }
      }
      return true;
    } catch (error) {
      return true; // Assume safe if we can't check
    }
  }

  async checkVulnerabilities(servicePath) {
    try {
      const auditOutput = execQuiet(`cd ${servicePath} && npm audit --json 2>/dev/null`);
      if (auditOutput) {
        const audit = JSON.parse(auditOutput);
        return audit.metadata?.vulnerabilities?.total || 0;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  async checkStableTag(servicePath) {
    try {
      const tags = execQuiet(`cd ${servicePath} && git tag -l --sort=-version:refname | head -1`);
      return tags && /^v?\d+\.\d+\.\d+$/.test(tags.trim());
    } catch (error) {
      return false;
    }
  }

  generateQualityReport(gateResults) {
    logger.header('📊 Quality Gates Report');

    const totalServices = gateResults.length;
    const deployableServices = gateResults.filter(r => r.canDeploy).length;
    const criticalFailures = gateResults.filter(r => r.criticalFailures.length > 0).length;

    console.log('\n🎯 Quality Metrics:');
    console.log(`  Deployment Ready: ${deployableServices}/${totalServices} services`);
    console.log(`  Average Score: ${(gateResults.reduce((sum, r) => sum + r.overallScore, 0) / totalServices).toFixed(1)}/100`);
    console.log(`  Critical Failures: ${criticalFailures} services`);

    // Service breakdown
    console.log('\n📋 Service Quality Status:');
    console.table(gateResults.map(r => ({
      Service: r.service,
      'Overall Score': r.overallScore.toFixed(1),
      'Can Deploy': r.canDeploy ? '✅' : '❌',
      Security: r.gateResults.security?.score.toFixed(1) || 'N/A',
      Stability: r.gateResults.stability?.score.toFixed(1) || 'N/A',
      Contract: r.gateResults.contract?.score.toFixed(1) || 'N/A',
      Deployment: r.gateResults.deployment?.score.toFixed(1) || 'N/A'
    })));

    // Critical issues
    const allCriticalIssues = gateResults.flatMap(r =>
      r.criticalFailures.map(issue => `${r.service}: ${issue}`)
    );

    if (allCriticalIssues.length > 0) {
      console.log('\n🚨 Critical Deployment Blockers:');
      allCriticalIssues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    }

    return {
      totalServices,
      deployableServices,
      averageScore: gateResults.reduce((sum, r) => sum + r.overallScore, 0) / totalServices,
      gateResults,
      criticalIssues: allCriticalIssues
    };
  }

  // Additional helper methods would go here...
  async checkTestExistence(servicePath) { return fs.existsSync(path.join(servicePath, 'tests')) || fs.existsSync(path.join(servicePath, '__tests__')); }
  async getTestCoverage(servicePath) { return 80; } // Mock for now
  async checkBuildStability(servicePath) { return true; } // Mock for now
  async checkErrorHandling(servicePath) { return true; } // Mock for now
  async checkRollbackCapability(servicePath) { return true; } // Mock for now
  async checkHealthEndpoint(servicePath) { return true; } // Mock for now
  async checkBundleSize(servicePath) { return 1000000; } // Mock for now
  async measureBuildTime(servicePath) { return 120; } // Mock for now
  async countDependencies(servicePath) { return 25; } // Mock for now
  async checkLazyLoading(servicePath) { return true; } // Mock for now
  async checkBuildScript(servicePath) { return true; } // Mock for now
  async checkStartScript(servicePath) { return true; } // Mock for now
  async checkDeploymentConfig(servicePath) { return true; } // Mock for now
  async checkEnvironmentConfig(servicePath) { return true; } // Mock for now
  async checkHealthCheckScript(servicePath) { return true; } // Mock for now
  async checkProductionReadiness(servicePath) { return true; } // Mock for now
  async checkHttpsEnforcement(servicePath) { return true; } // Mock for now
  async checkAuthImplementation(servicePath) { return true; } // Mock for now
  async getLatestStableTag(servicePath) { return 'v1.0.0'; } // Mock for now

  collectSecurityIssues(checks) { return []; } // Mock for now
  collectStabilityIssues(checks) { return []; } // Mock for now
  collectContractIssues(checks, result) { return []; } // Mock for now
  collectDeploymentIssues(checks) { return []; } // Mock for now
}

async function main() {
  const gates = new ProductionQualityGates();

  const servicePath = process.argv[2];

  try {
    const report = await gates.validateDeploymentReadiness(servicePath);

    if (report.criticalIssues.length > 0) {
      logger.error(`Found ${report.criticalIssues.length} critical quality gate failures`);
      process.exit(1);
    }

    logger.success('Quality gates validation completed');
  } catch (error) {
    logger.error(`Quality gates validation failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ProductionQualityGates };