import { buildIndex, saveIndex } from '../core/indexer.js';
import { getDefaultIndexPath } from '../config.js';

export interface BuildOptions {
  force?: boolean;
  output?: string;
  paths?: string[];
}

/**
 * Build command - scans skill directories and creates index
 */
export function buildCommand(options: BuildOptions = {}): void {
  const indexPath = options.output ?? getDefaultIndexPath();

  console.log('Building skill index...');

  if (options.paths && options.paths.length > 0) {
    console.log(`Additional paths: ${options.paths.join(', ')}`);
  }

  const index = buildIndex(options.paths);

  if (index.skills.length === 0) {
    console.log('No skills found in any skill directory.');
    console.log('Checked directories:');
    console.log('  - ~/.openclaw/workspace/skills/');
    console.log('  - ~/.openclaw/managed-skills/');
    if (options.paths) {
      for (const p of options.paths) {
        console.log(`  - ${p}`);
      }
    }
    return;
  }

  saveIndex(index, indexPath);

  console.log(`\nIndex built successfully!`);
  console.log(`  Skills indexed: ${index.skills.length}`);
  console.log(`  Unique terms: ${Object.keys(index.documentFrequency).length}`);
  console.log(`  Avg doc length: ${index.avgDocLength.toFixed(1)}`);
  console.log(`  Output: ${indexPath}`);
  console.log(`\nIndexed skills:`);

  for (const skill of index.skills) {
    const alwaysTag = skill.alwaysInclude ? ' [always]' : '';
    console.log(`  - ${skill.name}${alwaysTag}: ${skill.keywords.length} keywords`);
  }
}
