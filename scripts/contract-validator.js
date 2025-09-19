#!/usr/bin/env node
/**
 * Service Contract Validator - Production API contract validation
 * Ensures service compatibility before deployment
 */

const { execCommand, execQuiet, logger, fileUtils, icons } = require('./utils');
const fs = require('fs');
const path = require('path');

class ContractValidator {
  constructor() {
    this.contractTypes = [
      'openapi.yml',
      'swagger.json',
      'api.contract.ts',
      'contracts/api.json',
      'src/contracts/index.ts'
    ];
  }

  async validateAllContracts() {
    logger.header('🔗 Service Contract Validation');

    const services = this.getServices();
    const validationResults = [];

    for (const service of services) {
      const result = await this.validateServiceContract(service);
      validationResults.push(result);
    }

    return this.generateValidationReport(validationResults);
  }

  getServices() {
    const gitmodulesPath = '.gitmodules';
    if (!fs.existsSync(gitmodulesPath)) {
      logger.warning('No .gitmodules file found');
      return [];
    }

    const gitmodules = fs.readFileSync(gitmodulesPath, 'utf8');
    const services = [];

    const matches = gitmodules.matchAll(/\[submodule "(.+?)"\]\s*path = (.+?)(?:\n|$)/g);
    for (const match of matches) {
      const servicePath = match[2].trim();
      if (fs.existsSync(servicePath)) {
        services.push(servicePath);
      }
    }

    return services;
  }

  async validateServiceContract(servicePath) {
    logger.step(`Validating contracts for ${servicePath}`, icons.package);

    const validation = {
      service: servicePath,
      hasContract: false,
      contractType: null,
      isValid: false,
      compatibilityScore: 0,
      breakingChanges: [],
      warnings: [],
      version: null,
      lastValidated: new Date().toISOString()
    };

    try {
      // Find contract files
      const contractFile = this.findContractFile(servicePath);
      if (!contractFile) {
        validation.warnings.push('No API contract found');
        return validation;
      }

      validation.hasContract = true;
      validation.contractType = path.basename(contractFile);

      // Validate contract syntax
      const syntaxValidation = await this.validateContractSyntax(contractFile);
      validation.isValid = syntaxValidation.isValid;
      validation.warnings.push(...syntaxValidation.warnings);

      // Check for versioning
      validation.version = await this.extractContractVersion(contractFile);

      // Backward compatibility check
      const compatibilityCheck = await this.checkBackwardCompatibility(servicePath, contractFile);
      validation.compatibilityScore = compatibilityCheck.score;
      validation.breakingChanges = compatibilityCheck.breakingChanges;

      // Production readiness checks
      const readinessChecks = await this.checkProductionReadiness(servicePath, contractFile);
      validation.warnings.push(...readinessChecks.warnings);

    } catch (error) {
      validation.warnings.push(`Validation error: ${error.message}`);
    }

    return validation;
  }

  findContractFile(servicePath) {
    for (const contractFile of this.contractTypes) {
      const fullPath = path.join(servicePath, contractFile);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
    return null;
  }

  async validateContractSyntax(contractFile) {
    const result = { isValid: true, warnings: [] };

    try {
      const content = fs.readFileSync(contractFile, 'utf8');
      const ext = path.extname(contractFile);

      switch (ext) {
        case '.json':
          JSON.parse(content);
          break;
        case '.yml':
        case '.yaml':
          // Basic YAML validation
          if (content.includes('\t')) {
            result.warnings.push('YAML contains tabs, should use spaces');
          }
          break;
        case '.ts':
          // Check TypeScript contract structure
          if (!content.includes('interface') && !content.includes('type')) {
            result.warnings.push('TypeScript contract missing interface/type definitions');
          }
          break;
      }

      // Check for required fields
      if (!content.includes('version') && !content.includes('Version')) {
        result.warnings.push('Contract missing version information');
      }

    } catch (error) {
      result.isValid = false;
      result.warnings.push(`Syntax error: ${error.message}`);
    }

    return result;
  }

  async extractContractVersion(contractFile) {
    try {
      const content = fs.readFileSync(contractFile, 'utf8');

      // Look for version patterns
      const versionMatches = [
        /version["\s]*:["\s]*([^"'\s]+)/i,
        /Version["\s]*=["\s]*([^"'\s]+)/i,
        /"version":\s*"([^"]+)"/i,
        /version:\s*['"]([^'"]+)['"]/i
      ];

      for (const pattern of versionMatches) {
        const match = content.match(pattern);
        if (match) {
          return match[1];
        }
      }

      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  async checkBackwardCompatibility(servicePath, contractFile) {
    const result = {
      score: 100,
      breakingChanges: []
    };

    try {
      // Get previous version of contract from git
      const relativePath = path.relative('.', contractFile);
      const previousContent = execQuiet(`git show HEAD~1:${relativePath} 2>/dev/null`);

      if (!previousContent) {
        result.score = 90; // New contract, assume compatible
        return result;
      }

      const currentContent = fs.readFileSync(contractFile, 'utf8');
      const changes = this.detectContractChanges(previousContent, currentContent);

      result.breakingChanges = changes.breaking;
      result.score = Math.max(0, 100 - (changes.breaking.length * 20));

    } catch (error) {
      // If we can't check compatibility, assume it's risky
      result.score = 70;
      result.breakingChanges.push('Unable to validate backward compatibility');
    }

    return result;
  }

  detectContractChanges(oldContent, newContent) {
    const changes = {
      breaking: [],
      additions: [],
      modifications: []
    };

    // Simple heuristics for breaking changes
    const breakingPatterns = [
      { pattern: /required:\s*true/g, description: 'New required field added' },
      { pattern: /type:\s*["']?(\w+)["']?/g, description: 'Field type changed' },
      { pattern: /enum:\s*\[([^\]]+)\]/g, description: 'Enum values changed' }
    ];

    for (const { pattern, description } of breakingPatterns) {
      const oldMatches = [...(oldContent.matchAll(pattern) || [])];
      const newMatches = [...(newContent.matchAll(pattern) || [])];

      if (newMatches.length > oldMatches.length) {
        changes.breaking.push(description);
      }
    }

    // Check for removed endpoints (basic check)
    const pathPattern = /path[s]?[:\s]*["']([^"']+)["']/gi;
    const oldPaths = [...(oldContent.matchAll(pathPattern) || [])].map(m => m[1]);
    const newPaths = [...(newContent.matchAll(pathPattern) || [])].map(m => m[1]);

    const removedPaths = oldPaths.filter(path => !newPaths.includes(path));
    if (removedPaths.length > 0) {
      changes.breaking.push(`Removed endpoints: ${removedPaths.join(', ')}`);
    }

    return changes;
  }

  async checkProductionReadiness(servicePath, contractFile) {
    const warnings = [];

    // Check for required production fields
    const content = fs.readFileSync(contractFile, 'utf8');

    const requiredFields = [
      { pattern: /security|auth/i, name: 'Security definitions' },
      { pattern: /error|errors/i, name: 'Error handling' },
      { pattern: /rate.?limit/i, name: 'Rate limiting' },
      { pattern: /health|status/i, name: 'Health checks' }
    ];

    for (const { pattern, name } of requiredFields) {
      if (!pattern.test(content)) {
        warnings.push(`Missing ${name} in contract`);
      }
    }

    // Check for API documentation
    if (!content.includes('description') && !content.includes('summary')) {
      warnings.push('Contract lacks documentation');
    }

    // Check for versioning strategy
    if (!content.includes('/v1/') && !content.includes('/v2/') && !content.includes('version')) {
      warnings.push('No API versioning strategy detected');
    }

    return { warnings };
  }

  generateValidationReport(validationResults) {
    logger.header('📋 Contract Validation Report');

    const totalServices = validationResults.length;
    const servicesWithContracts = validationResults.filter(v => v.hasContract).length;
    const validContracts = validationResults.filter(v => v.isValid).length;
    const servicesWithBreaking = validationResults.filter(v => v.breakingChanges.length > 0).length;

    const metrics = {
      contractCoverage: ((servicesWithContracts / totalServices) * 100).toFixed(1),
      contractValidity: servicesWithContracts > 0 ? ((validContracts / servicesWithContracts) * 100).toFixed(1) : '0',
      compatibilityScore: validationResults.reduce((sum, v) => sum + v.compatibilityScore, 0) / totalServices,
      breakingServices: servicesWithBreaking
    };

    console.log('\n📊 Contract Metrics:');
    console.log(`  Contract Coverage: ${metrics.contractCoverage}% (${servicesWithContracts}/${totalServices} services)`);
    console.log(`  Contract Validity: ${metrics.contractValidity}% (${validContracts}/${servicesWithContracts} valid)`);
    console.log(`  Compatibility Score: ${metrics.compatibilityScore.toFixed(1)}/100`);
    console.log(`  Breaking Changes: ${servicesWithBreaking} services affected`);

    // Detailed breakdown
    console.log('\n📋 Service Contract Details:');
    console.table(validationResults.map(v => ({
      Service: v.service,
      Contract: v.hasContract ? '✅' : '❌',
      Type: v.contractType || 'None',
      Valid: v.isValid ? '✅' : '❌',
      Version: v.version || 'N/A',
      'Compat Score': v.compatibilityScore,
      'Breaking Changes': v.breakingChanges.length
    })));

    // Critical issues
    const criticalIssues = this.identifyCriticalIssues(validationResults);
    if (criticalIssues.length > 0) {
      console.log('\n🚨 Critical Contract Issues:');
      criticalIssues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    }

    return {
      metrics,
      validationResults,
      criticalIssues
    };
  }

  identifyCriticalIssues(validationResults) {
    const issues = [];

    // Services without contracts
    const noContractServices = validationResults.filter(v => !v.hasContract);
    if (noContractServices.length > 0) {
      issues.push(`${noContractServices.length} services missing API contracts: ${noContractServices.map(s => s.service).join(', ')}`);
    }

    // Services with breaking changes
    const breakingServices = validationResults.filter(v => v.breakingChanges.length > 0);
    if (breakingServices.length > 0) {
      issues.push(`${breakingServices.length} services have breaking changes requiring coordination`);
    }

    // Invalid contracts
    const invalidServices = validationResults.filter(v => v.hasContract && !v.isValid);
    if (invalidServices.length > 0) {
      issues.push(`${invalidServices.length} services have invalid contracts: ${invalidServices.map(s => s.service).join(', ')}`);
    }

    // Low compatibility scores
    const lowCompatServices = validationResults.filter(v => v.compatibilityScore < 70);
    if (lowCompatServices.length > 0) {
      issues.push(`${lowCompatServices.length} services have low compatibility scores (< 70)`);
    }

    return issues;
  }
}

async function main() {
  const validator = new ContractValidator();

  try {
    const report = await validator.validateAllContracts();

    // Exit with error if critical issues found
    if (report.criticalIssues.length > 0) {
      logger.error(`Found ${report.criticalIssues.length} critical contract issues`);
      process.exit(1);
    }

    logger.success('Contract validation completed successfully');
  } catch (error) {
    logger.error(`Contract validation failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { ContractValidator };