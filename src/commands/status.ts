import { loadIndex } from '../core/indexer.js';
import { getConfig, getDefaultIndexPath } from '../config.js';

export interface StatusOptions {
  index?: string;
  json?: boolean;
}

/**
 * Status command - shows index health and statistics
 */
export function statusCommand(options: StatusOptions = {}): void {
  const config = getConfig();
  const indexPath = options.index ?? getDefaultIndexPath();

  const index = loadIndex(indexPath);

  if (!index) {
    if (options.json) {
      console.log(
        JSON.stringify({
          status: 'missing',
          indexPath,
          message: 'Index not found. Run "skill-router build" to create it.',
        })
      );
    } else {
      console.log('Status: Index not found');
      console.log(`  Path: ${indexPath}`);
      console.log('  Run "skill-router build" to create the index.');
    }
    return;
  }

  const stats = {
    status: 'ok',
    indexPath,
    version: index.version,
    generated: index.generated,
    skillCount: index.skills.length,
    uniqueTerms: Object.keys(index.documentFrequency).length,
    avgDocLength: index.avgDocLength,
    alwaysIncludeSkills: index.skills.filter((s) => s.alwaysInclude).map((s) => s.name),
    config: {
      maxResults: config.maxResults,
      threshold: config.threshold,
      alwaysInclude: config.alwaysInclude,
    },
  };

  if (options.json) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  console.log('SkillRouter Status: OK');
  console.log('');
  console.log('Index:');
  console.log(`  Path: ${indexPath}`);
  console.log(`  Version: ${index.version}`);
  console.log(`  Generated: ${index.generated}`);
  console.log('');
  console.log('Statistics:');
  console.log(`  Skills indexed: ${index.skills.length}`);
  console.log(`  Unique terms: ${Object.keys(index.documentFrequency).length}`);
  console.log(`  Avg doc length: ${index.avgDocLength.toFixed(1)}`);
  console.log('');
  console.log('Configuration:');
  console.log(`  Max results: ${config.maxResults}`);
  console.log(`  Threshold: ${config.threshold}`);
  console.log(`  Always include: ${config.alwaysInclude.join(', ')}`);

  if (stats.alwaysIncludeSkills.length > 0) {
    console.log('');
    console.log('Always-include skills (from metadata):');
    for (const name of stats.alwaysIncludeSkills) {
      console.log(`  - ${name}`);
    }
  }

  console.log('');
  console.log('Indexed skills:');
  for (const skill of index.skills) {
    console.log(`  - ${skill.name} (${skill.keywords.length} keywords, ${skill.tokens.length} tokens)`);
  }
}
