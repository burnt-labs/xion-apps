#!/usr/bin/env node
const { execCommand, logger, handleError, validators, icons } = require('./utils');

function addSubmodule() {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    logger.info('Usage: npm run submodules:add <repo-url> <local-path>');
    logger.info('Example: npm run submodules:add https://github.com/burnt-labs/new-app new-app');
    process.exit(1);
  }

  const [repoUrl, localPath] = args;

  try {
    // Validate inputs
    validators.required(repoUrl, 'Repository URL');
    validators.required(localPath, 'Local path');

    logger.step('Adding new submodule', icons.package);
    logger.substep(`Repository: ${repoUrl}`);
    logger.substep(`Local path: ${localPath}`);

    // Add the submodule
    execCommand(`git submodule add "${repoUrl}" "${localPath}"`);

    // Initialize and update the new submodule
    execCommand(`git submodule update --init --recursive "${localPath}"`);

    logger.success('Submodule added successfully!');

    logger.info('📝 Next steps:');
    logger.substep('1. Review the changes: git status');
    logger.substep(`2. Commit the changes: git commit -m "Add ${localPath} submodule"`);
    logger.substep('3. Push to remote: git push');

  } catch (error) {
    handleError(error, 'Adding submodule');
  }
}

if (require.main === module) {
  addSubmodule();
}