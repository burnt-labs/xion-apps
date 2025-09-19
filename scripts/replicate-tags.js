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

async function replicateTags() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: npm run tags:replicate [tag-name]');
    console.log('  tag-name: Specific tag to replicate (optional, replicates all if not specified)');
    console.log('');
    console.log('Examples:');
    console.log('  npm run tags:replicate v1.0.0     # Replicate specific tag');
    console.log('  npm run tags:replicate            # Replicate all tags');
    process.exit(1);
  }

  const specificTag = args[0];

  try {
    console.log('🏷️  Replicating tags to all submodules...');

    // Get all tags from main repo
    const allTags = execCommand('git tag --list', { stdio: 'pipe' }).trim().split('\n').filter(tag => tag);

    if (allTags.length === 0) {
      console.log('ℹ️  No tags found in main repository');
      rl.close();
      return;
    }

    const tagsToReplicate = specificTag ? [specificTag] : allTags;

    if (specificTag && !allTags.includes(specificTag)) {
      console.error(`❌ Tag '${specificTag}' not found in main repository`);
      console.log('Available tags:', allTags.join(', '));
      rl.close();
      return;
    }

    console.log(`📋 Tags to replicate: ${tagsToReplicate.join(', ')}`);

    // Get list of submodules
    const submodules = execCommand('git submodule status', { stdio: 'pipe' })
      .trim()
      .split('\n')
      .map(line => line.split(' ')[1])
      .filter(path => path);

    console.log(`📦 Found ${submodules.length} submodules`);

    const shouldProceed = await question(`\n🚀 Replicate ${tagsToReplicate.length} tag(s) to ${submodules.length} submodule(s)? (y/N): `);

    if (shouldProceed.toLowerCase() !== 'y') {
      console.log('ℹ️  Operation cancelled');
      rl.close();
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const submodule of submodules) {
      console.log(`\n📦 Processing ${submodule}...`);

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

        for (const tag of tagsToReplicate) {
          try {
            // Check if tag already exists
            try {
              execCommand(`git rev-parse ${tag}`, { stdio: 'pipe' });
              console.log(`  ✅ Tag ${tag} already exists`);
              continue;
            } catch (error) {
              // Tag doesn't exist, create it
            }

            // Get the current commit
            const currentCommit = execCommand('git rev-parse HEAD', { stdio: 'pipe' }).trim();

            // Create the tag
            execCommand(`git tag ${tag} ${currentCommit}`, { stdio: 'pipe' });
            console.log(`  🏷️  Created tag ${tag}`);

            // Push the tag
            execCommand(`git push origin ${tag}`, { stdio: 'pipe' });
            console.log(`  🚀 Pushed tag ${tag}`);

          } catch (error) {
            console.log(`  ❌ Failed to create/push tag ${tag}: ${error.message}`);
            errorCount++;
          }
        }

        successCount++;

      } catch (error) {
        console.log(`  ❌ Error processing ${submodule}: ${error.message}`);
        errorCount++;
      } finally {
        process.chdir('..');
      }
    }

    console.log('\n📊 Summary:');
    console.log(`  ✅ Successful: ${successCount} submodules`);
    if (errorCount > 0) {
      console.log(`  ❌ Errors: ${errorCount} submodules`);
    }

  } catch (error) {
    console.error('❌ Error replicating tags:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

replicateTags();