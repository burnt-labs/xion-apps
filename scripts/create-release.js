#!/usr/bin/env node
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function execCommand(command, options = {}) {
  try {
    return execSync(command, { encoding: 'utf8', ...options });
  } catch (error) {
    throw error;
  }
}

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createRelease() {
  const args = process.argv.slice(2);

  if (args.length !== 1) {
    console.log('Usage: npm run release <tag-name>');
    console.log('Example: npm run release v1.0.0');
    process.exit(1);
  }

  const tagName = args[0];

  try {
    console.log(`🏷️  Creating release ${tagName}...`);

    // Validate tag format
    if (!tagName.match(/^v?\d+\.\d+\.\d+/)) {
      console.log('⚠️  Warning: Tag name doesn\'t follow semantic versioning (e.g., v1.0.0)');
      const proceed = await question('Continue anyway? (y/N): ');
      if (proceed.toLowerCase() !== 'y') {
        console.log('ℹ️  Operation cancelled');
        rl.close();
        return;
      }
    }

    // Check if tag already exists
    try {
      execCommand(`git rev-parse ${tagName}`, { stdio: 'pipe' });
      console.error(`❌ Tag '${tagName}' already exists`);
      rl.close();
      return;
    } catch (error) {
      // Tag doesn't exist, continue
    }

    // Check if working directory is clean
    try {
      execCommand('git diff --quiet HEAD', { stdio: 'pipe' });
    } catch (error) {
      console.log('⚠️  Working directory has uncommitted changes');
      const proceed = await question('Continue anyway? (y/N): ');
      if (proceed.toLowerCase() !== 'y') {
        console.log('ℹ️  Operation cancelled - commit changes first');
        rl.close();
        return;
      }
    }

    // Get release message
    const message = await question(`📝 Enter release message for ${tagName} (or press Enter for default): `);
    const releaseMessage = message.trim() || `Release ${tagName}`;

    console.log('\n🔄 Creating release...');

    // Create the tag
    execCommand(`git tag -a ${tagName} -m "${releaseMessage}"`, { stdio: 'inherit' });
    console.log(`✅ Created tag ${tagName}`);

    // Push the tag
    execCommand(`git push origin ${tagName}`, { stdio: 'inherit' });
    console.log(`🚀 Pushed tag ${tagName} to origin`);

    console.log('\n🏷️  Replicating tag to all submodules...');

    // Replicate to all submodules
    const submodules = execCommand('git submodule status', { stdio: 'pipe' })
      .trim()
      .split('\n')
      .map(line => line.split(' ')[1])
      .filter(path => path);

    let successCount = 0;
    let errorCount = 0;

    for (const submodule of submodules) {
      try {
        process.chdir(submodule);

        // Check if submodule has a remote
        try {
          execCommand('git remote get-url origin', { stdio: 'pipe' });
        } catch (error) {
          console.log(`  ⚠️  Skipping ${submodule} (no remote origin)`);
          process.chdir('..');
          continue;
        }

        // Get the current commit
        const currentCommit = execCommand('git rev-parse HEAD', { stdio: 'pipe' }).trim();

        // Create and push the tag
        execCommand(`git tag -a ${tagName} -m "${releaseMessage}" ${currentCommit}`, { stdio: 'pipe' });
        execCommand(`git push origin ${tagName}`, { stdio: 'pipe' });

        console.log(`  ✅ Tagged ${submodule}`);
        successCount++;

      } catch (error) {
        console.log(`  ❌ Failed to tag ${submodule}: ${error.message}`);
        errorCount++;
      } finally {
        process.chdir('..');
      }
    }

    console.log('\n🎉 Release created successfully!');
    console.log(`📊 Summary:`);
    console.log(`  🏷️  Main repo: Tagged and pushed ${tagName}`);
    console.log(`  ✅ Submodules tagged: ${successCount}`);
    if (errorCount > 0) {
      console.log(`  ❌ Submodule errors: ${errorCount}`);
    }

  } catch (error) {
    console.error('❌ Error creating release:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

createRelease();