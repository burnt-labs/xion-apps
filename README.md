# XION Apps Monorepo

Production-ready monorepo using Git submodules for deployment independence and service isolation. Each application deploys independently to Cloudflare Workers while maintaining coordinated development workflows.

## 🚀 Quick Start

### Prerequisites

```bash
# Install direnv for automatic environment management
brew install direnv          # macOS
# or
apt install direnv           # Ubuntu

# Add to your shell profile
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc    # for bash
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc      # for zsh

# Restart terminal or reload profile
source ~/.bashrc  # or ~/.zshrc
```

### First Time Setup

```bash
# Clone the repository
git clone https://github.com/burnt-labs/xion-apps.git
cd xion-apps

# Setup everything
npm install
npm run setup:env

# Allow direnv (if not auto-prompted)
direnv allow .
```

This will:
- Install dependencies and Git hooks
- Initialize all submodules
- Create directory environments for automatic Git operations
- Setup production-ready quality gates

## 🏗️ Architecture

This monorepo uses **Git submodules** for true deployment independence:

- **Independent Deployment**: Each service deploys separately to Cloudflare Workers
- **Service Isolation**: No shared build artifacts or coordinated releases
- **Production Focus**: Health monitoring, quality gates, and rollback capabilities
- **Automatic Operations**: Directory-based environment automation

## 📦 Project Structure

```
xion-apps/
├── account-lookup/           # Account lookup service
├── authz-viewer/            # Authorization viewer
├── bluecheck/               # BlueCheck verification
├── crossmint-frontend/      # Crossmint integration
├── dashboard/               # Main dashboard
├── developer-portal/        # Developer documentation
├── explorer/                # Blockchain explorer
├── faucet/                  # Token faucet
├── staking/                 # Staking interface
├── xion.js/                 # JavaScript SDK
├── scripts/                 # Automation and helpers
│   ├── git-helpers/         # Auto-commit, push, sync
│   ├── production/          # Quality gates, health checks
│   └── automation.js        # Main automation script
└── .envrc                   # Root environment config
```

## 🔧 Daily Development

### Automatic Environment

When you enter any service directory, the environment automatically:
- Loads service-specific settings
- Shows Git status and uncommitted changes
- Installs dependencies if missing
- Provides helper aliases

```bash
cd dashboard
# 🚀 Service environment loaded: dashboard
# ⚠️ dashboard has uncommitted changes
# 💡 Use: commit, push, sync, deploy

# Simple commands available:
commit "fix: button styling"    # Standardized commits
push                           # Safe push with validation
sync                          # Pull latest changes
deploy                        # Deploy to Cloudflare Workers
```

### Service Development

```bash
# Enter any service directory
cd staking

# Work normally
npm run dev
# make changes...

# Use helper commands
commit "feat: add new staking reward calculation"
push
```

### Cross-Service Operations

```bash
# From root directory
npm run production:health     # Check all services health
npm run production:validate   # Full production readiness
npm run workspace:test        # Run tests across all services
npm run automate daily        # Daily maintenance tasks
```

## 🚦 Production Quality Gates

Every service is validated against production standards:

### Security Gate (Critical)
- ✅ Security policy and .gitignore configuration
- ✅ No hardcoded secrets or credentials
- ✅ Dependency vulnerability scanning
- ✅ HTTPS enforcement and authentication

### Stability Gate (Critical)
- ✅ Stable release tags and version management
- ✅ Test coverage and build stability
- ✅ Error handling and health endpoints
- ✅ Rollback capability

### Contract Gate (Critical)
- ✅ API contract definitions (OpenAPI/Swagger)
- ✅ Backward compatibility validation
- ✅ Breaking change detection
- ✅ Contract versioning

### Deployment Gate (Critical)
- ✅ Cloudflare Workers configuration
- ✅ Build scripts and dependencies
- ✅ Environment configuration
- ✅ Health check endpoints

### Performance Gate
- ✅ Bundle size optimization
- ✅ Build time efficiency
- ✅ Dependency management

## 🚀 Deployment

### Individual Service Deployment

```bash
# Manual deployment workflow
gh workflow run "Independent Submodule Deployment" \
  -f service=dashboard \
  -f version=v1.2.3
```

### Deployment Process

1. **Validation**: Quality gates and contract checks
2. **Compatibility**: API compatibility testing
3. **Deployment**: Cloudflare Workers via Wrangler
4. **Verification**: Health checks and rollback if needed

### Safe Updates

```bash
# Update a service safely
npm run production:update dashboard v1.2.3

# This includes:
# - Pre-update validation
# - Rollback point creation
# - Quality gate checking
# - Parent repository update
```

## 🔍 Monitoring & Health

### Service Health Monitoring

```bash
npm run production:health
```

Provides:
- Deployment readiness scoring
- Security posture assessment
- Vulnerability exposure
- Rollback capability status

### Contract Validation

```bash
npm run production:contracts
```

Validates:
- API contract existence and validity
- Backward compatibility
- Breaking change detection
- Production readiness

### Quality Gates

```bash
npm run production:gates [service-name]
```

Comprehensive validation of all production standards.

## 🛠️ Available Commands

### Production Operations
```bash
npm run production:health        # Service health monitoring
npm run production:contracts     # Contract validation
npm run production:gates        # Quality gates validation
npm run production:update       # Safe service updates
npm run production:validate     # Full production check
npm run production:deploy-check # Pre-deployment validation
```

### Development
```bash
npm run workspace:doctor        # Workspace health check
npm run workspace:build         # Build all services
npm run workspace:test          # Test all services
npm run workspace:lint          # Lint all services
```

### Submodule Management
```bash
npm run submodules:status       # Check all submodule status
npm run submodules:update       # Update to committed versions
npm run submodules:pull         # Pull latest for all
npm run submodules:sync         # Sync configurations
```

### Automation
```bash
npm run automate daily          # Daily maintenance
npm run automate update         # Update checks
npm run automate security       # Security scanning
npm run automate health         # Health monitoring
```

### Environment Setup
```bash
npm run setup:env              # Setup directory environments
npm run direnv:setup           # Create .envrc files
npm run direnv:allow           # Allow root .envrc
```

## 🔒 Security & Governance

### Code Ownership

Governed by `.github/CODEOWNERS`:
- **Platform Team** (`@burnt-labs/burnt_devops`): Infrastructure, workflows, root configs
- **Frontend Team** (`@burnt-labs/burnt_frontend`): All application services
- **Security Team**: Security-sensitive files and patterns

### Quality Enforcement

- **Pre-commit hooks**: Submodule validation and linting
- **Quality gates**: Production readiness validation
- **GitHub Actions**: Automated CI/CD with matrix builds
- **Contract validation**: API compatibility checking

## 🚨 Troubleshooting

### Environment Issues

```bash
# Direnv not working
direnv allow .                  # Allow current directory
eval "$(direnv export bash)"    # Manual load

# Environment not loading
npm run setup:env              # Recreate environment files
```

### Service Issues

```bash
# Service health problems
npm run production:health dashboard

# Build or deployment failures
cd dashboard
npm run production:gates       # Check quality gates
```

### Git/Submodule Issues

```bash
# Submodule problems
npm run submodules:status      # Check status
npm run submodules:sync        # Sync configuration

# Reset submodules
git submodule update --init --recursive --force
```

## 🤝 Contributing

### Adding a New Service

1. **Add submodule**:
   ```bash
   git submodule add https://github.com/burnt-labs/new-service new-service
   ```

2. **Setup environment**:
   ```bash
   npm run direnv:setup
   ```

3. **Update configurations**:
   - Add to `.github/workflows/submodule-deployment.yml` options
   - Update `.github/CODEOWNERS`
   - Add to workspace configuration

### Working on Services

1. **Enter service directory** - environment auto-loads
2. **Make changes** - use normal Git workflow
3. **Use helpers** - `commit`, `push`, `sync`, `deploy`
4. **Return to root** - commit submodule updates if needed

### Production Deployment

1. **Validate readiness**: `npm run production:validate`
2. **Create release tag** in service repository
3. **Deploy via GitHub Actions** with service and version
4. **Monitor health** post-deployment

## 📚 Philosophy

This architecture prioritizes:

- **Deployment Independence** over build performance
- **Service Stability** over development velocity
- **Production Safety** over convenience
- **Operational Metrics** over vanity metrics

Each service is treated as an independent production system with its own lifecycle, while maintaining coordinated development workflows through automation and quality gates.