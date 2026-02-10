import { loadIndex } from '../core/indexer.js';
import { scoreQuery } from '../core/scorer.js';
import { writeContextFile } from '../core/injector.js';
import { getConfig, getDefaultIndexPath, getDefaultContextPath } from '../config.js';

export interface MatchOptions {
  index?: string;
  output?: string;
  maxResults?: number;
  threshold?: number;
  json?: boolean;
}

/**
 * Match command - scores a message against the index and writes context
 */
export function matchCommand(message: string, options: MatchOptions = {}): void {
  const config = getConfig();
  const indexPath = options.index ?? getDefaultIndexPath();
  const contextPath = options.output ?? getDefaultContextPath();

  // Load index
  const index = loadIndex(indexPath);

  if (!index) {
    console.error(`Error: Index not found at ${indexPath}`);
    console.error('Run "skill-router build" first to create the index.');
    process.exit(1);
  }

  // Score the message
  const results = scoreQuery(index, message, {
    maxResults: options.maxResults ?? config.maxResults,
    threshold: options.threshold ?? config.threshold,
    bm25K1: config.bm25K1,
    bm25B: config.bm25B,
    alwaysInclude: config.alwaysInclude,
  });

  // Write context file
  writeContextFile(results, contextPath);

  // Output results
  if (options.json) {
    console.log(
      JSON.stringify(
        {
          query: message,
          contextFile: contextPath,
          results: results.map((r) => ({
            name: r.skill.name,
            score: r.score,
            matchedKeywords: r.matchedKeywords,
            location: r.skill.location,
          })),
        },
        null,
        2
      )
    );
  } else {
    if (results.length === 0) {
      console.log('No skills matched.');
    } else {
      console.log(`Matched ${results.length} skill(s):`);
      for (const result of results) {
        const scoreStr = result.score > 0 ? ` (score: ${result.score.toFixed(2)})` : ' (always)';
        const matchStr =
          result.matchedKeywords.length > 0
            ? ` [${result.matchedKeywords.join(', ')}]`
            : '';
        console.log(`  - ${result.skill.name}${scoreStr}${matchStr}`);
      }
    }
    console.log(`\nContext written to: ${contextPath}`);
  }
}
